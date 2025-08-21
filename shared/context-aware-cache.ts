import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import {
  generateOptimizedCacheKey,
  CacheKeyStrategies,
  analyzeCacheKeyEffectiveness,
} from "./optimized-cache-keys";

/**
 * Enhanced context-aware caching system for AI responses
 * Implements intelligent cache key generation based on user context,
 * seasonal preferences, and wardrobe evolution patterns
 */

interface UserContext {
  userId: string;
  preferences: {
    style?: string;
    colors?: string[];
    occasions?: string[];
    lifestyle?: string;
    bodyType?: string;
    budget?: string;
  };
  seasonalContext: {
    season: "spring" | "summer" | "fall" | "winter";
    climate: string;
    location?: string;
  };
  wardrobeEvolution: {
    recentAdditions?: any[];
    styleShifts?: string[];
    lastAnalysisDate?: string;
  };
}

interface CacheKeyComponents {
  userId: string;
  promptType: string;
  itemSignature: string;
  contextSignature: string;
  seasonalSignature: string;
  evolutionSignature: string;
}

/**
 * Generate intelligent cache key that considers user context and wardrobe evolution
 * Now uses optimized cache key generation with intelligent fingerprinting
 */
export function generateContextAwareCacheKey(
  userId: string,
  items: any[],
  context: any,
  promptType: string,
  userContext?: UserContext,
  strategy: "performance" | "balanced" | "precision" = "balanced",
): { key: string; metrics: any; fingerprint: any } {
  // Select optimization strategy
  const strategyOptions = {
    performance: CacheKeyStrategies.PERFORMANCE_OPTIMIZED,
    balanced: CacheKeyStrategies.BALANCED,
    precision: CacheKeyStrategies.PRECISION_OPTIMIZED,
  }[strategy];

  // Generate optimized cache key
  const result = generateOptimizedCacheKey(
    userId,
    items,
    context,
    promptType,
    userContext,
    strategyOptions,
  );

  console.log(`🔑 Generated optimized cache key with ${strategy} strategy:`, {
    keyLength: result.key.length,
    complexity: result.metrics.complexity,
    hitProbability: result.metrics.hitProbability,
  });

  return result;
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use generateContextAwareCacheKey with strategy parameter instead
 */
export function generateLegacyCacheKey(
  userId: string,
  items: any[],
  context: any,
  promptType: string,
  userContext?: UserContext,
): string {
  const components: CacheKeyComponents = {
    userId,
    promptType,
    itemSignature: generateItemSignature(items),
    contextSignature: generateContextSignature(context),
    seasonalSignature: generateSeasonalSignature(userContext?.seasonalContext),
    evolutionSignature: generateEvolutionSignature(
      userContext?.wardrobeEvolution,
    ),
  };

  // Create deterministic hash from all components
  const hashInput = Object.values(components).join(":");
  return crypto.createHash("sha256").update(hashInput).digest("hex");
}

/**
 * Generate signature for wardrobe items considering style tags and categories
 */
function generateItemSignature(items: any[]): string {
  if (!items || items.length === 0) return "no-items";

  // Sort items by ID for consistency
  const sortedItems = items.sort((a, b) =>
    (a.id || "").localeCompare(b.id || ""),
  );

  // Create signature including categories, colors, and style tags
  const itemData = sortedItems.map((item) => {
    const category =
      typeof item.category === "string"
        ? item.category
        : item.category?.name || "unknown";
    const styleTags =
      item.clothing_item_style_tags
        ?.map((tag) => tag.style_tag?.name)
        .sort()
        .join(",") || "";
    return `${item.id}:${category}:${item.color || ""}:${item.brand || ""}:${styleTags}`;
  });

  return crypto.createHash("md5").update(itemData.join("|")).digest("hex");
}

/**
 * Generate signature for request context
 */
function generateContextSignature(context: any): string {
  if (!context || Object.keys(context).length === 0) return "no-context";

  // Sort context keys for consistency
  const sortedContext = Object.entries(context)
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
    .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});

  return crypto
    .createHash("md5")
    .update(JSON.stringify(sortedContext))
    .digest("hex");
}

/**
 * Generate signature for seasonal context
 */
function generateSeasonalSignature(
  seasonalContext?: UserContext["seasonalContext"],
): string {
  if (!seasonalContext) {
    // Auto-detect season based on current date
    const month = new Date().getMonth();
    const season =
      month < 3
        ? "winter"
        : month < 6
          ? "spring"
          : month < 9
            ? "summer"
            : "fall";
    return `auto-${season}`;
  }

  return `${seasonalContext.season}:${seasonalContext.climate || "unknown"}:${seasonalContext.location || "unknown"}`;
}

/**
 * Generate signature for wardrobe evolution patterns
 */
function generateEvolutionSignature(
  evolution?: UserContext["wardrobeEvolution"],
): string {
  if (!evolution) return "no-evolution";

  const recentAdditionsCount = evolution.recentAdditions?.length || 0;
  const styleShifts = evolution.styleShifts?.sort().join(",") || "";
  const lastAnalysis = evolution.lastAnalysisDate || "never";

  return `${recentAdditionsCount}:${styleShifts}:${lastAnalysis}`;
}

/**
 * Check if cache entry is still valid based on context evolution
 */
export function isCacheEntryValid(
  cacheEntry: any,
  userContext?: UserContext,
  maxAge: number = 24 * 60 * 60 * 1000, // 24 hours default
): boolean {
  if (!cacheEntry || !cacheEntry.created_at) return false;

  const cacheAge = Date.now() - new Date(cacheEntry.created_at).getTime();

  // Check basic age limit
  if (cacheAge > maxAge) return false;

  // Check if wardrobe has evolved significantly
  if (userContext?.wardrobeEvolution?.recentAdditions?.length > 0) {
    const recentAdditionTime = new Date(
      userContext.wardrobeEvolution.lastAnalysisDate || 0,
    ).getTime();
    const cacheTime = new Date(cacheEntry.created_at).getTime();

    // If wardrobe changed after cache entry, invalidate
    if (recentAdditionTime > cacheTime) return false;
  }

  // Check seasonal relevance
  if (userContext?.seasonalContext) {
    const currentSeason = getCurrentSeason();
    const cacheSeasonMatch = cacheEntry.request_data?.seasonalContext?.season;

    // Invalidate if season changed
    if (cacheSeasonMatch && cacheSeasonMatch !== currentSeason) return false;
  }

  return true;
}

/**
 * Get current season based on date
 */
function getCurrentSeason(): string {
  const month = new Date().getMonth();
  return month < 3
    ? "winter"
    : month < 6
      ? "spring"
      : month < 9
        ? "summer"
        : "fall";
}

/**
 * Enhanced cache lookup with context awareness and optimization metrics
 */
export async function getContextAwareCache(
  supabase: any,
  cacheKey: string | { key: string; metrics: any; fingerprint: any },
  userId: string,
  userContext?: UserContext,
): Promise<{ data: any; cached: boolean; metrics?: any }> {
  // Handle both string keys (legacy) and optimized key objects
  const keyString = typeof cacheKey === "string" ? cacheKey : cacheKey.key;
  const keyMetrics =
    typeof cacheKey === "object" ? cacheKey.metrics : undefined;
  try {
    const { data: cachedData, error } = await supabase
      .from("gemini_cache")
      .select("*")
      .eq("request_hash", keyString)
      .eq("user_id", userId)
      .single();

    if (error && !error.message.includes("No rows found")) {
      console.error("Cache lookup error:", error);
      return { data: null, cached: false, metrics: keyMetrics };
    }

    if (!cachedData) {
      return { data: null, cached: false };
    }

    // Check if cache entry is still valid
    if (!isCacheEntryValid(cachedData, userContext)) {
      console.log("🗑️ Cache entry expired or invalidated by context changes");

      // Optionally clean up expired entry
      await supabase
        .from("gemini_cache")
        .delete()
        .eq("request_hash", keyString);

      return { data: null, cached: false };
    }

    // Update access statistics
    await supabase
      .from("gemini_cache")
      .update({
        last_accessed_at: new Date().toISOString(),
        access_count: (cachedData.access_count || 0) + 1,
      })
      .eq("request_hash", keyString);

    console.log(
      `🎯 Context-aware cache hit for ${keyString.substring(0, 8)}...`,
      {
        hitProbability: keyMetrics?.hitProbability,
        complexity: keyMetrics?.complexity,
      },
    );
    return {
      data: cachedData.gemini_response,
      cached: true,
      metrics: keyMetrics,
    };
  } catch (error) {
    console.error("Context-aware cache lookup failed:", error);
    return { data: null, cached: false };
  }
}

/**
 * Store cache entry with enhanced metadata and optimization metrics
 */
export async function storeContextAwareCache(
  supabase: any,
  cacheKey: string | { key: string; metrics: any; fingerprint: any },
  userId: string,
  promptType: string,
  items: any[],
  context: any,
  response: any,
  userContext?: UserContext,
): Promise<boolean> {
  // Handle both string keys (legacy) and optimized key objects
  const keyString = typeof cacheKey === "string" ? cacheKey : cacheKey.key;
  const keyMetrics =
    typeof cacheKey === "object" ? cacheKey.metrics : undefined;
  const keyFingerprint =
    typeof cacheKey === "object" ? cacheKey.fingerprint : undefined;
  try {
    const { error } = await supabase.from("gemini_cache").insert({
      user_id: userId,
      request_hash: keyString,
      request_data: {
        promptType,
        itemCount: items.length,
        context,
        userContext,
        seasonalContext: userContext?.seasonalContext || {
          season: getCurrentSeason(),
        },
        wardrobeEvolution: userContext?.wardrobeEvolution,
        // Enhanced metadata for optimization
        cacheMetrics: keyMetrics,
        contextFingerprint: keyFingerprint,
        optimizationStrategy: keyMetrics ? "optimized" : "legacy",
      },
      gemini_response: response,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("Failed to store context-aware cache:", error);
      return false;
    }

    console.log(
      `💾 Stored context-aware cache for ${keyString.substring(0, 8)}...`,
      {
        strategy: keyMetrics ? "optimized" : "legacy",
        complexity: keyMetrics?.complexity,
        hitProbability: keyMetrics?.hitProbability,
      },
    );
    return true;
  } catch (error) {
    console.error("Context-aware cache storage failed:", error);
    return false;
  }
}
