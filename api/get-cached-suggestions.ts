import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import {
  generateWithGemini,
  buildOutfitGenerationPrompt,
  buildWardrobeAnalysisPrompt,
  buildFashionPrompt,
} from "../shared/gemini.js";
import {
  generateContextAwareCacheKey,
  getContextAwareCache,
  storeContextAwareCache,
} from "../shared/context-aware-cache.js";
import {
  validateAIResponse,
  STRUCTURED_PROMPT_TEMPLATES,
} from "../shared/response-schemas.js";
import { batchAIRequest } from "../shared/request-batching.js";
import crypto from "crypto";

// Types
interface CacheRequest {
  userId: string;
  items: any[];
  context: {
    occasion?: string;
    weather?: string;
    style?: string;
    colors?: string[];
    [key: string]: any;
  };
  promptType:
    | "outfit-generation"
    | "wardrobe-analysis"
    | "styling-advice"
    | "item-analysis";
  forceRefresh?: boolean;
  priority?: "high" | "medium" | "low";
  userContext?: {
    preferences?: any;
    seasonalContext?: any;
    wardrobeEvolution?: any;
  };
}

interface CacheResponse {
  success: boolean;
  cached: boolean;
  data: any;
  error?: string;
}

/**
 * Get cached suggestions or generate new ones
 * This function provides an abstraction over Gemini API calls with database caching
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed. Use POST.",
    });
  }

  const startTime = Date.now();

  try {
    const requestData: CacheRequest = req.body;
    const {
      userId,
      items = [],
      context = {},
      promptType,
      forceRefresh = false,
    } = requestData;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "userId is required",
      });
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL || "";
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({
        success: false,
        error: "Supabase configuration missing",
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate optimized context-aware cache key
    // Use performance strategy for high-traffic scenarios, balanced for general use
    const requestPriority = requestData.priority || "medium";
    const cacheStrategy =
      requestPriority === "high" ? "performance" : "balanced";

    // Create proper UserContext object
    const userContext = requestData.userContext
      ? {
          userId,
          preferences: requestData.userContext.preferences || {},
          seasonalContext: requestData.userContext.seasonalContext || {
            season: "spring" as const,
            climate: "temperate",
          },
          wardrobeEvolution: requestData.userContext.wardrobeEvolution || {},
        }
      : undefined;

    const cacheKeyResult = generateContextAwareCacheKey(
      userId,
      items,
      context,
      promptType,
      userContext,
      cacheStrategy,
    );
    const requestHash = cacheKeyResult.key;

    console.log(`🔍 Cache key optimization metrics:`, {
      strategy: cacheStrategy,
      complexity: cacheKeyResult.metrics.complexity,
      specificity: cacheKeyResult.metrics.specificity,
      hitProbability: cacheKeyResult.metrics.hitProbability,
      stability: cacheKeyResult.metrics.stability,
    });

    // Check if we should bypass cache
    if (!forceRefresh) {
      // Use enhanced context-aware cache lookup with optimization metrics
      const cacheResult = await getContextAwareCache(
        supabase,
        cacheKeyResult, // Pass full result object for enhanced metrics
        userId,
        userContext,
      );

      if (cacheResult.cached) {
        const responseTime = Date.now() - startTime;
        console.log(
          `⚡ Context-aware cache response served in ${responseTime}ms`,
        );

        return res.status(200).json({
          success: true,
          cached: true,
          data: cacheResult.data,
        });
      }
    } else {
      console.log(`🔄 Cache bypass requested for ${promptType}`);
    }

    // If we get here, we need to generate a new response
    console.log(
      `🤖 Cache miss for ${promptType}, using smart request batching...`,
    );

    // Use smart request batching for optimal performance
    const batchPriority = requestData.priority || "medium";

    try {
      // Add request to batch queue
      const batchResult = await batchAIRequest(
        userId,
        promptType,
        items,
        context,
        batchPriority,
      );

      // If batching returns a result, use it
      if (batchResult && !batchResult.error) {
        const responseTime = Date.now() - startTime;
        console.log(`⚡ Batch response served in ${responseTime}ms`);

        // Store in context-aware cache with optimization metrics
        await storeContextAwareCache(
          supabase,
          cacheKeyResult, // Pass full result object for enhanced metadata
          userId,
          promptType,
          items,
          context,
          batchResult,
          userContext,
        );

        return res.status(200).json({
          success: true,
          cached: false,
          data: batchResult,
        });
      }
    } catch (batchError) {
      console.warn(
        "Batch processing failed, falling back to direct processing:",
        batchError,
      );
    }

    // Fallback to direct processing if batching fails
    console.log(`🔄 Processing ${promptType} request directly...`);

    // Generate the appropriate prompt with structured output requirements
    let prompt: string;
    let geminiOptions = { temperature: 0.7, maxOutputTokens: 1500 };

    switch (promptType) {
      case "outfit-generation":
        prompt =
          buildOutfitGenerationPrompt(
            items,
            context.occasion || "casual",
            context.weather || "mild",
            context.style || "comfortable",
          ) + STRUCTURED_PROMPT_TEMPLATES.outfit_generation;
        break;

      case "wardrobe-analysis":
        prompt =
          buildWardrobeAnalysisPrompt(items, context) +
          STRUCTURED_PROMPT_TEMPLATES.wardrobe_analysis;
        geminiOptions.maxOutputTokens = 2000;
        break;

      case "styling-advice":
        prompt =
          buildFashionPrompt(context.question || "Provide styling advice", {
            wardrobe: items,
            ...context,
          }) + STRUCTURED_PROMPT_TEMPLATES.styling_advice;
        break;

      case "item-analysis":
        prompt =
          buildFashionPrompt("Analyze this clothing item in detail", {
            wardrobe: items,
            ...context,
          }) + STRUCTURED_PROMPT_TEMPLATES.item_analysis;
        break;

      default:
        return res.status(400).json({
          success: false,
          error: "Invalid promptType specified",
        });
    }

    // Call Gemini API
    try {
      const geminiResponse = await generateWithGemini(prompt, geminiOptions);

      // Validate and process the response using structured schemas
      const validation = validateAIResponse(geminiResponse, promptType);

      let processedResponse;
      if (validation.success) {
        processedResponse = validation.data;
        console.log(`✅ Response validation successful for ${promptType}`);
      } else {
        processedResponse = validation.fallback;
        console.warn(
          `⚠️ Response validation failed, using fallback: ${validation.error}`,
        );
      }

      // Store in enhanced context-aware cache with optimization metrics
      const cacheStored = await storeContextAwareCache(
        supabase,
        cacheKeyResult, // Pass full result object for enhanced metadata
        userId,
        promptType,
        items,
        context,
        processedResponse,
        userContext,
      );

      if (!cacheStored) {
        console.warn("Failed to store response in context-aware cache");
      }

      const responseTime = Date.now() - startTime;
      console.log(
        `⚡ Gemini response generated and cached in ${responseTime}ms`,
      );

      return res.status(200).json({
        success: true,
        cached: false,
        data: processedResponse,
      });
    } catch (geminiError) {
      console.error("Gemini API error:", geminiError);
      return res.status(500).json({
        success: false,
        cached: false,
        error: `Failed to generate content with Gemini: ${geminiError.message}`,
      });
    }
  } catch (error) {
    console.error("Cache service error:", error);
    return res.status(500).json({
      success: false,
      error: `Cache service error: ${error.message}`,
    });
  }
}

/**
 * Generates a deterministic hash from the request parameters
 */
function generateRequestHash(
  userId: string,
  items: any[],
  context: any,
  promptType: string,
): string {
  // Create a sorted array of item IDs to ensure consistency
  const itemIds = items.map((item) => item.id).sort();

  // Create a sorted string representation of the context
  const contextStr = JSON.stringify(
    Object.entries(context)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {}),
  );

  // Combine all elements to create a unique but deterministic string
  const hashInput = `${userId}:${promptType}:${itemIds.join(",")}:${contextStr}`;

  // Generate SHA-256 hash
  return crypto.createHash("sha256").update(hashInput).digest("hex");
}
