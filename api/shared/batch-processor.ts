import { createClient } from "@supabase/supabase-js";
import {
  generateWithGemini,
  buildOutfitGenerationPrompt,
  buildWardrobeAnalysisPrompt,
  buildFashionPrompt,
} from "./gemini";
import {
  validateAIResponse,
  STRUCTURED_PROMPT_TEMPLATES,
} from "./response-schemas";
import {
  generateContextAwareCacheKey,
  storeContextAwareCache,
} from "./context-aware-cache";

/**
 * Interface for batch request items
 */
interface BatchRequestItem {
  id: string;
  userId: string;
  promptType:
    | "outfit-generation"
    | "wardrobe-analysis"
    | "styling-advice"
    | "item-analysis";
  items: any[];
  context: any;
  priority: "high" | "medium" | "low";
  timestamp: number;
  userContext?: any;
  resolve: (result: any) => void;
  reject: (error: any) => void;
}

/**
 * Interface for batch processing results
 */
interface BatchResult {
  requestId: string;
  success: boolean;
  data?: any;
  error?: string;
  cached?: boolean;
}

/**
 * Smart batch processor for AI requests
 * Handles request queuing, deduplication, and intelligent batching
 */
export class SmartBatchProcessor {
  private requestQueue: Map<string, BatchRequestItem> = new Map();
  private processingBatch: boolean = false;
  private batchTimeout: NodeJS.Timeout | null = null;
  private readonly BATCH_SIZE = 5; // Maximum requests per batch
  private readonly BATCH_TIMEOUT = 2000; // 2 seconds max wait time
  private readonly MAX_TOKENS_PER_BATCH = 4000; // Token limit per batch

  /**
   * Add a request to the batch queue
   */
  async addRequest(
    userId: string,
    promptType: string,
    items: any[],
    context: any,
    priority: "high" | "medium" | "low" = "medium",
    userContext?: any,
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      // Generate unique request ID for deduplication
      const requestId = this.generateRequestId(
        userId,
        promptType,
        items,
        context,
      );

      // Check if identical request is already queued
      if (this.requestQueue.has(requestId)) {
        console.log(
          `🔄 Duplicate request detected, reusing existing: ${requestId.substring(0, 8)}...`,
        );
        const existingRequest = this.requestQueue.get(requestId)!;

        // Chain the promise to the existing request
        const originalResolve = existingRequest.resolve;
        const originalReject = existingRequest.reject;

        existingRequest.resolve = (result) => {
          originalResolve(result);
          resolve(result);
        };

        existingRequest.reject = (error) => {
          originalReject(error);
          reject(error);
        };

        return;
      }

      // Add new request to queue
      const batchRequest: BatchRequestItem = {
        id: requestId,
        userId,
        promptType: promptType as any,
        items,
        context,
        priority,
        timestamp: Date.now(),
        userContext,
        resolve,
        reject,
      };

      this.requestQueue.set(requestId, batchRequest);
      console.log(
        `📥 Added request to batch queue: ${requestId.substring(0, 8)}... (Queue size: ${this.requestQueue.size})`,
      );

      // Schedule batch processing
      this.scheduleBatchProcessing();
    });
  }

  /**
   * Generate unique request ID for deduplication
   */
  private generateRequestId(
    userId: string,
    promptType: string,
    items: any[],
    context: any,
  ): string {
    const itemIds = items
      .map((item) => item.id || item._id || JSON.stringify(item))
      .sort();
    const contextStr = JSON.stringify(context, Object.keys(context).sort());
    const combined = `${userId}:${promptType}:${itemIds.join(",")}:${contextStr}`;

    return require("crypto")
      .createHash("sha256")
      .update(combined)
      .digest("hex");
  }

  /**
   * Schedule batch processing with intelligent timing
   */
  private scheduleBatchProcessing(): void {
    // Clear existing timeout
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
    }

    // Process immediately if high priority requests or queue is full
    const hasHighPriority = Array.from(this.requestQueue.values()).some(
      (req) => req.priority === "high",
    );
    const queueFull = this.requestQueue.size >= this.BATCH_SIZE;

    if (hasHighPriority || queueFull) {
      console.log(
        `⚡ Processing batch immediately (High priority: ${hasHighPriority}, Queue full: ${queueFull})`,
      );
      this.processBatch();
      return;
    }

    // Otherwise, wait for more requests or timeout
    this.batchTimeout = setTimeout(() => {
      if (this.requestQueue.size > 0) {
        console.log(
          `⏰ Processing batch after timeout (${this.requestQueue.size} requests)`,
        );
        this.processBatch();
      }
    }, this.BATCH_TIMEOUT);
  }

  /**
   * Process the current batch of requests
   */
  private async processBatch(): Promise<void> {
    if (this.processingBatch || this.requestQueue.size === 0) {
      return;
    }

    this.processingBatch = true;

    try {
      // Get requests from queue
      const requests = Array.from(this.requestQueue.values());
      this.requestQueue.clear();

      // Clear timeout
      if (this.batchTimeout) {
        clearTimeout(this.batchTimeout);
        this.batchTimeout = null;
      }

      console.log(`🚀 Processing batch of ${requests.length} requests`);

      // Group requests by type and compatibility
      const batches = this.groupRequestsIntoBatches(requests);

      // Process each batch
      const results = await Promise.allSettled(
        batches.map((batch) => this.processSingleBatch(batch)),
      );

      // Handle results
      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          console.log(`✅ Batch ${index + 1} completed successfully`);
        } else {
          console.error(`❌ Batch ${index + 1} failed:`, result.reason);
        }
      });
    } catch (error) {
      console.error("❌ Batch processing failed:", error);
    } finally {
      this.processingBatch = false;
    }
  }

  /**
   * Group requests into optimal batches
   */
  private groupRequestsIntoBatches(
    requests: BatchRequestItem[],
  ): BatchRequestItem[][] {
    // Sort by priority and timestamp
    const sortedRequests = requests.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff =
        priorityOrder[b.priority] - priorityOrder[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.timestamp - b.timestamp;
    });

    const batches: BatchRequestItem[][] = [];
    let currentBatch: BatchRequestItem[] = [];
    let currentTokens = 0;

    for (const request of sortedRequests) {
      const estimatedTokens = this.estimateTokens(request);

      // Check if we can add this request to current batch
      if (
        currentBatch.length === 0 ||
        (currentBatch.length < this.BATCH_SIZE &&
          currentTokens + estimatedTokens <= this.MAX_TOKENS_PER_BATCH &&
          this.canBatchTogether(currentBatch[0], request))
      ) {
        currentBatch.push(request);
        currentTokens += estimatedTokens;
      } else {
        // Start new batch
        if (currentBatch.length > 0) {
          batches.push(currentBatch);
        }
        currentBatch = [request];
        currentTokens = estimatedTokens;
      }
    }

    // Add final batch
    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    return batches;
  }

  /**
   * Estimate token count for a request
   */
  private estimateTokens(request: BatchRequestItem): number {
    const baseTokens = {
      "outfit-generation": 800,
      "wardrobe-analysis": 1200,
      "styling-advice": 600,
      "item-analysis": 400,
    };

    const itemTokens = request.items.length * 50;
    const contextTokens = JSON.stringify(request.context).length / 4;

    return (baseTokens[request.promptType] || 600) + itemTokens + contextTokens;
  }

  /**
   * Check if two requests can be batched together
   */
  private canBatchTogether(
    req1: BatchRequestItem,
    req2: BatchRequestItem,
  ): boolean {
    // Same prompt type
    if (req1.promptType !== req2.promptType) return false;

    // Same user (for privacy)
    if (req1.userId !== req2.userId) return false;

    // Similar context
    const context1 = JSON.stringify(
      req1.context,
      Object.keys(req1.context).sort(),
    );
    const context2 = JSON.stringify(
      req2.context,
      Object.keys(req2.context).sort(),
    );

    return context1 === context2;
  }

  /**
   * Process a single batch of compatible requests
   */
  private async processSingleBatch(batch: BatchRequestItem[]): Promise<void> {
    if (batch.length === 1) {
      // Single request - process normally
      await this.processSingleRequest(batch[0]);
      return;
    }

    // Multiple requests - try to batch them
    console.log(`🔄 Processing batch of ${batch.length} similar requests`);

    try {
      // Create combined prompt for batch processing
      const combinedPrompt = this.createBatchPrompt(batch);

      // Generate response
      const response = await generateWithGemini(combinedPrompt, {
        temperature: 0.7,
        maxOutputTokens: Math.min(4000, batch.length * 1500),
      });

      // Parse batch response
      const results = this.parseBatchResponse(response, batch);

      // Resolve individual requests
      for (let i = 0; i < batch.length; i++) {
        const request = batch[i];
        const result = results[i] || results[0]; // Fallback to first result

        // Validate result
        const validation = validateAIResponse(
          JSON.stringify(result),
          request.promptType,
        );
        const finalResult = validation.success
          ? validation.data
          : validation.fallback;

        // Store in cache
        await this.cacheResult(request, finalResult);

        // Resolve promise
        request.resolve(finalResult);
      }
    } catch (error) {
      console.error(
        "❌ Batch processing failed, falling back to individual processing:",
        error,
      );

      // Fallback: process each request individually
      await Promise.allSettled(
        batch.map((request) => this.processSingleRequest(request)),
      );
    }
  }

  /**
   * Create a combined prompt for batch processing
   */
  private createBatchPrompt(batch: BatchRequestItem[]): string {
    const firstRequest = batch[0];
    const promptType = firstRequest.promptType;

    let basePrompt = "";

    switch (promptType) {
      case "outfit-generation":
        basePrompt = `You are a professional fashion stylist. Create outfit recommendations for ${batch.length} different wardrobes.\n\n`;
        batch.forEach((request, index) => {
          basePrompt += `WARDROBE ${index + 1}:\n`;
          basePrompt += buildOutfitGenerationPrompt(
            request.items,
            request.context.occasion || "casual",
            request.context.weather || "mild",
            request.context.style || "comfortable",
          );
          basePrompt += "\n\n";
        });
        break;

      case "wardrobe-analysis":
        basePrompt = `You are a professional wardrobe consultant. Analyze ${batch.length} different wardrobes.\n\n`;
        batch.forEach((request, index) => {
          basePrompt += `WARDROBE ${index + 1}:\n`;
          basePrompt += buildWardrobeAnalysisPrompt(
            request.items,
            request.context,
          );
          basePrompt += "\n\n";
        });
        break;

      default:
        // For other types, process individually
        throw new Error(`Batch processing not supported for ${promptType}`);
    }

    basePrompt +=
      STRUCTURED_PROMPT_TEMPLATES[
        promptType.replace("-", "_") as keyof typeof STRUCTURED_PROMPT_TEMPLATES
      ];
    basePrompt += `\n\nProvide ${batch.length} separate responses, clearly labeled as RESPONSE 1, RESPONSE 2, etc.`;

    return basePrompt;
  }

  /**
   * Parse batch response into individual results
   */
  private parseBatchResponse(
    response: string,
    batch: BatchRequestItem[],
  ): any[] {
    const results: any[] = [];

    try {
      // Try to split by response markers
      const responseSections = response
        .split(/RESPONSE \d+/i)
        .filter((section) => section.trim());

      if (responseSections.length >= batch.length) {
        // Parse each section
        for (let i = 0; i < batch.length; i++) {
          const section = responseSections[i];
          const validation = validateAIResponse(section, batch[i].promptType);
          results.push(
            validation.success ? validation.data : validation.fallback,
          );
        }
      } else {
        // Fallback: try to parse as single response and duplicate
        const validation = validateAIResponse(response, batch[0].promptType);
        const singleResult = validation.success
          ? validation.data
          : validation.fallback;

        for (let i = 0; i < batch.length; i++) {
          results.push(singleResult);
        }
      }
    } catch (error) {
      console.error("Failed to parse batch response:", error);

      // Ultimate fallback
      for (let i = 0; i < batch.length; i++) {
        const validation = validateAIResponse("{}", batch[i].promptType);
        results.push(validation.fallback);
      }
    }

    return results;
  }

  /**
   * Process a single request
   */
  private async processSingleRequest(request: BatchRequestItem): Promise<void> {
    try {
      let prompt = "";
      let options = { temperature: 0.7, maxOutputTokens: 1500 };

      // Build prompt based on type
      switch (request.promptType) {
        case "outfit-generation":
          prompt =
            buildOutfitGenerationPrompt(
              request.items,
              request.context.occasion || "casual",
              request.context.weather || "mild",
              request.context.style || "comfortable",
            ) + STRUCTURED_PROMPT_TEMPLATES.outfit_generation;
          break;

        case "wardrobe-analysis":
          prompt =
            buildWardrobeAnalysisPrompt(request.items, request.context) +
            STRUCTURED_PROMPT_TEMPLATES.wardrobe_analysis;
          options.maxOutputTokens = 2000;
          break;

        case "styling-advice":
          prompt =
            buildFashionPrompt(
              request.context.question || "Provide styling advice",
              { wardrobe: request.items, ...request.context },
            ) + STRUCTURED_PROMPT_TEMPLATES.styling_advice;
          break;

        case "item-analysis":
          prompt =
            buildFashionPrompt("Analyze this clothing item in detail", {
              wardrobe: request.items,
              ...request.context,
            }) + STRUCTURED_PROMPT_TEMPLATES.item_analysis;
          break;
      }

      // Generate response
      const response = await generateWithGemini(prompt, options);

      // Validate response
      const validation = validateAIResponse(response, request.promptType);
      const result = validation.success ? validation.data : validation.fallback;

      // Store in cache
      await this.cacheResult(request, result);

      // Resolve promise
      request.resolve(result);
    } catch (error) {
      console.error(
        `❌ Single request processing failed for ${request.id}:`,
        error,
      );
      request.reject(error);
    }
  }

  /**
   * Cache the result for future use
   */
  private async cacheResult(
    request: BatchRequestItem,
    result: any,
  ): Promise<void> {
    try {
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseServiceKey) {
        console.warn("⚠️ Supabase not configured, skipping cache storage");
        return;
      }

      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const cacheKey = generateContextAwareCacheKey(
        request.userId,
        request.items,
        request.context,
        request.promptType,
        request.userContext,
      );

      await storeContextAwareCache(
        supabase,
        cacheKey,
        request.userId,
        request.promptType,
        request.items,
        request.context,
        result,
        request.userContext,
      );
    } catch (error) {
      console.error("Failed to cache batch result:", error);
    }
  }

  /**
   * Get queue status for monitoring
   */
  getQueueStatus(): { queueSize: number; processing: boolean } {
    return {
      queueSize: this.requestQueue.size,
      processing: this.processingBatch,
    };
  }
}

// Global batch processor instance
const globalBatchProcessor = new SmartBatchProcessor();

/**
 * Main function to add AI requests to the batch queue
 */
export async function batchAIRequest(
  userId: string,
  promptType: string,
  items: any[],
  context: any,
  priority: "high" | "medium" | "low" = "medium",
  userContext?: any,
): Promise<any> {
  return globalBatchProcessor.addRequest(
    userId,
    promptType,
    items,
    context,
    priority,
    userContext,
  );
}

/**
 * Get current batch processor status
 */
export function getBatchProcessorStatus(): {
  queueSize: number;
  processing: boolean;
} {
  return globalBatchProcessor.getQueueStatus();
}
