import {
  batchAIRequest as processBatchRequest,
  getBatchProcessorStatus,
} from "./batch-processor";
import crypto from "crypto";

/**
 * Smart request batching system for AI responses
 * Implements request deduplication, batching, and intelligent prompt optimization
 */

interface BatchRequest {
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
  resolve: (result: any) => void;
  reject: (error: any) => void;
}

interface BatchGroup {
  promptType: string;
  requests: BatchRequest[];
  combinedPrompt?: string;
  estimatedTokens: number;
}

class SmartRequestBatcher {
  /**
   * Add request to batch queue
   */
  async addRequest(
    userId: string,
    promptType:
      | "outfit-generation"
      | "wardrobe-analysis"
      | "styling-advice"
      | "item-analysis",
    items: any[],
    context: any,
    priority: "high" | "medium" | "low" = "medium",
  ): Promise<any> {
    console.log(
      `📥 Adding request to smart batch processor: ${promptType} for user ${userId.substring(0, 8)}...`,
    );

    return processBatchRequest(userId, promptType, items, context, priority);
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
      .map((item) => item.id)
      .sort()
      .join(",");
    const contextStr = JSON.stringify(context, Object.keys(context).sort());
    const input = `${userId}:${promptType}:${itemIds}:${contextStr}`;
    return crypto.createHash("md5").update(input).digest("hex");
  }

  /**
   * Get current batch processor status
   */
  getStatus(): { queueSize: number; processing: boolean } {
    return getBatchProcessorStatus();
  }

  /**
   * Get current batch statistics
   */
  getStats(): {
    queueSize: number;
    processing: boolean;
  } {
    return this.getStatus();
  }
}

// Global batcher instance
export const requestBatcher = new SmartRequestBatcher();

/**
 * Convenience function to add request to batch queue
 */
export async function batchAIRequest(
  userId: string,
  promptType:
    | "outfit-generation"
    | "wardrobe-analysis"
    | "styling-advice"
    | "item-analysis",
  items: any[],
  context: any,
  priority: "high" | "medium" | "low" = "medium",
): Promise<any> {
  return requestBatcher.addRequest(
    userId,
    promptType,
    items,
    context,
    priority,
  );
}

/**
 * Get batching statistics
 */
export function getBatchingStats() {
  return requestBatcher.getStats();
}

/**
 * Get current batch processor status
 */
export function getBatchStatus(): { queueSize: number; processing: boolean } {
  return requestBatcher.getStatus();
}
