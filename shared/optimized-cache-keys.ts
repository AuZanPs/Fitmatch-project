import crypto from "crypto";

/**
 * Optimized cache key generation with intelligent context fingerprinting
 * Implements advanced algorithms for efficient cache key generation and context analysis
 */

interface OptimizedCacheKeyOptions {
  includeTimestamp?: boolean;
  granularity?: "fine" | "medium" | "coarse";
  contextWeight?: number;
  seasonalSensitivity?: boolean;
  evolutionTracking?: boolean;
}

interface ContextFingerprint {
  core: string; // Essential context elements
  style: string; // Style-related context
  temporal: string; // Time-sensitive context
  behavioral: string; // User behavior patterns
  environmental: string; // Environmental factors
}

interface CacheKeyMetrics {
  complexity: number;
  specificity: number;
  stability: number;
  hitProbability: number;
}

/**
 * Generate optimized cache key with intelligent fingerprinting
 */
export function generateOptimizedCacheKey(
  userId: string,
  items: any[],
  context: any,
  promptType: string,
  userContext?: any,
  options: OptimizedCacheKeyOptions = {},
): { key: string; metrics: CacheKeyMetrics; fingerprint: ContextFingerprint } {
  const opts = {
    includeTimestamp: false,
    granularity: "medium" as const,
    contextWeight: 1.0,
    seasonalSensitivity: true,
    evolutionTracking: true,
    ...options,
  };

  // Generate intelligent context fingerprint
  const fingerprint = generateContextFingerprint(context, userContext, opts);

  // Create optimized item signature
  const itemSignature = generateOptimizedItemSignature(items, opts.granularity);

  // Generate user behavior signature
  const behaviorSignature = generateBehaviorSignature(userId, userContext);

  // Create temporal signature if needed
  const temporalSignature = opts.includeTimestamp
    ? generateTemporalSignature(opts.seasonalSensitivity)
    : "";

  // Combine components with intelligent weighting
  const components = [
    userId.substring(0, 8), // Truncate for efficiency
    promptType,
    itemSignature,
    fingerprint.core,
    fingerprint.style,
    behaviorSignature,
    temporalSignature,
  ].filter(Boolean);

  // Generate final cache key
  const key = crypto
    .createHash("sha256")
    .update(components.join(":"))
    .digest("hex")
    .substring(0, 32); // Truncate for efficiency

  // Calculate cache key metrics
  const metrics = calculateCacheKeyMetrics(fingerprint, items, context, opts);

  return { key, metrics, fingerprint };
}

/**
 * Generate intelligent context fingerprint with multiple dimensions
 */
function generateContextFingerprint(
  context: any,
  userContext?: any,
  options: OptimizedCacheKeyOptions = {},
): ContextFingerprint {
  // Core context elements (always included)
  const coreElements = extractCoreContext(context);
  const core = hashObject(coreElements, "md5", 8);

  // Style-related context
  const styleElements = extractStyleContext(context, userContext);
  const style = hashObject(styleElements, "md5", 6);

  // Temporal context (season, time-sensitive preferences)
  const temporalElements = options.seasonalSensitivity
    ? extractTemporalContext(userContext)
    : {};
  const temporal = hashObject(temporalElements, "md5", 4);

  // Behavioral patterns
  const behavioralElements = extractBehavioralContext(userContext);
  const behavioral = hashObject(behavioralElements, "md5", 6);

  // Environmental factors
  const environmentalElements = extractEnvironmentalContext(
    context,
    userContext,
  );
  const environmental = hashObject(environmentalElements, "md5", 4);

  return { core, style, temporal, behavioral, environmental };
}

/**
 * Extract core context elements that are essential for cache differentiation
 */
function extractCoreContext(context: any): Record<string, any> {
  const coreKeys = ["occasion", "weather", "formality", "activity", "purpose"];
  const core: Record<string, any> = {};

  for (const key of coreKeys) {
    if (context[key] !== undefined) {
      core[key] = normalizeContextValue(context[key]);
    }
  }

  return core;
}

/**
 * Extract style-related context elements
 */
function extractStyleContext(
  context: any,
  userContext?: any,
): Record<string, any> {
  const styleContext: Record<string, any> = {};

  // From immediate context
  if (context.style)
    styleContext.requestedStyle = normalizeContextValue(context.style);
  if (context.colors)
    styleContext.requestedColors = normalizeArray(context.colors);
  if (context.aesthetic)
    styleContext.aesthetic = normalizeContextValue(context.aesthetic);

  // From user preferences
  if (userContext?.preferences?.style) {
    styleContext.preferredStyle = normalizeContextValue(
      userContext.preferences.style,
    );
  }
  if (userContext?.preferences?.colors) {
    styleContext.preferredColors = normalizeArray(
      userContext.preferences.colors,
    );
  }

  return styleContext;
}

/**
 * Extract temporal context elements
 */
function extractTemporalContext(userContext?: any): Record<string, any> {
  const temporal: Record<string, any> = {};

  // Current season
  const currentSeason = getCurrentSeason();
  temporal.season = currentSeason;

  // User's seasonal context
  if (userContext?.seasonalContext) {
    temporal.userSeason = userContext.seasonalContext.season;
    temporal.climate = userContext.seasonalContext.climate;
  }

  // Time-based granularity (week of year for seasonal transitions)
  const weekOfYear = getWeekOfYear();
  temporal.timeGranularity = Math.floor(weekOfYear / 4); // Monthly granularity

  return temporal;
}

/**
 * Extract behavioral context elements
 */
function extractBehavioralContext(userContext?: any): Record<string, any> {
  const behavioral: Record<string, any> = {};

  if (userContext?.preferences) {
    behavioral.lifestyle = userContext.preferences.lifestyle;
    behavioral.occasions = normalizeArray(userContext.preferences.occasions);
    behavioral.budget = userContext.preferences.budget;
  }

  if (userContext?.wardrobeEvolution) {
    behavioral.styleShifts = normalizeArray(
      userContext.wardrobeEvolution.styleShifts,
    );
    behavioral.recentActivity =
      userContext.wardrobeEvolution.recentAdditions?.length || 0;
  }

  return behavioral;
}

/**
 * Extract environmental context elements
 */
function extractEnvironmentalContext(
  context: any,
  userContext?: any,
): Record<string, any> {
  const environmental: Record<string, any> = {};

  if (context.location)
    environmental.location = normalizeContextValue(context.location);
  if (context.climate)
    environmental.climate = normalizeContextValue(context.climate);
  if (userContext?.seasonalContext?.location) {
    environmental.userLocation = normalizeContextValue(
      userContext.seasonalContext.location,
    );
  }

  return environmental;
}

/**
 * Generate optimized item signature based on granularity level
 */
function generateOptimizedItemSignature(
  items: any[],
  granularity: "fine" | "medium" | "coarse",
): string {
  if (!items || items.length === 0) return "no-items";

  // Sort items for consistency
  const sortedItems = items.sort((a, b) =>
    (a.id || "").localeCompare(b.id || ""),
  );

  let itemData: string[];

  switch (granularity) {
    case "fine":
      // Include all details
      itemData = sortedItems.map((item) => {
        const category = getItemCategory(item);
        const styleTags = getItemStyleTags(item);
        const color = item.color || "unknown";
        const brand = item.brand || "unknown";
        return `${item.id}:${category}:${color}:${brand}:${styleTags}`;
      });
      break;

    case "medium":
      // Include essential details
      itemData = sortedItems.map((item) => {
        const category = getItemCategory(item);
        const styleTags = getItemStyleTags(item, 3); // Limit to top 3 style tags
        const color = item.color || "unknown";
        return `${item.id}:${category}:${color}:${styleTags}`;
      });
      break;

    case "coarse":
      // Include only basic details
      itemData = sortedItems.map((item) => {
        const category = getItemCategory(item);
        return `${item.id}:${category}`;
      });
      break;
  }

  return crypto
    .createHash("md5")
    .update(itemData.join("|"))
    .digest("hex")
    .substring(0, 12);
}

/**
 * Generate user behavior signature
 */
function generateBehaviorSignature(userId: string, userContext?: any): string {
  const behaviorElements = [];

  // User ID prefix for personalization
  behaviorElements.push(userId.substring(0, 6));

  // Recent activity level
  if (userContext?.wardrobeEvolution?.recentAdditions) {
    const activityLevel = Math.min(
      userContext.wardrobeEvolution.recentAdditions.length,
      10,
    );
    behaviorElements.push(`activity:${activityLevel}`);
  }

  // Style consistency score
  if (userContext?.preferences?.style) {
    const styleHash = crypto
      .createHash("md5")
      .update(userContext.preferences.style)
      .digest("hex")
      .substring(0, 4);
    behaviorElements.push(`style:${styleHash}`);
  }

  return behaviorElements.join("-");
}

/**
 * Generate temporal signature for time-sensitive caching
 */
function generateTemporalSignature(seasonalSensitivity: boolean): string {
  const elements = [];

  if (seasonalSensitivity) {
    elements.push(getCurrentSeason());
    elements.push(Math.floor(getWeekOfYear() / 4).toString()); // Monthly granularity
  }

  return elements.join("-");
}

/**
 * Calculate cache key metrics for optimization insights
 */
function calculateCacheKeyMetrics(
  fingerprint: ContextFingerprint,
  items: any[],
  context: any,
  options: OptimizedCacheKeyOptions,
): CacheKeyMetrics {
  // Complexity: How many factors influence the cache key
  const complexity =
    [
      fingerprint.core,
      fingerprint.style,
      fingerprint.temporal,
      fingerprint.behavioral,
      fingerprint.environmental,
    ].filter(Boolean).length / 5;

  // Specificity: How specific the cache key is
  const contextSize = Object.keys(context).length;
  const itemCount = items.length;
  const specificity = Math.min((contextSize + itemCount) / 20, 1);

  // Stability: How likely the cache key is to remain valid
  const hasTemporalElements = Boolean(fingerprint.temporal);
  const hasBehavioralElements = Boolean(fingerprint.behavioral);
  const stability = hasTemporalElements
    ? 0.6
    : hasBehavioralElements
      ? 0.8
      : 0.9;

  // Hit Probability: Estimated likelihood of cache hits
  const granularity = options.granularity || "medium";
  const granularityScore =
    granularity === "coarse" ? 0.8 : granularity === "medium" ? 0.6 : 0.4;
  const hitProbability = granularityScore * stability;

  return {
    complexity: Math.round(complexity * 100) / 100,
    specificity: Math.round(specificity * 100) / 100,
    stability: Math.round(stability * 100) / 100,
    hitProbability: Math.round(hitProbability * 100) / 100,
  };
}

/**
 * Utility functions
 */
function hashObject(
  obj: Record<string, any>,
  algorithm: string = "md5",
  length: number = 8,
): string {
  if (Object.keys(obj).length === 0) return "";

  const sortedKeys = Object.keys(obj).sort();
  const sortedObj = sortedKeys.reduce(
    (result, key) => {
      result[key] = obj[key];
      return result;
    },
    {} as Record<string, any>,
  );

  return crypto
    .createHash(algorithm)
    .update(JSON.stringify(sortedObj))
    .digest("hex")
    .substring(0, length);
}

function normalizeContextValue(value: any): string {
  if (typeof value === "string") return value.toLowerCase().trim();
  if (typeof value === "number") return value.toString();
  if (typeof value === "boolean") return value.toString();
  return JSON.stringify(value);
}

function normalizeArray(arr: any[]): string {
  if (!Array.isArray(arr)) return "";
  return arr.map(normalizeContextValue).sort().join(",");
}

function getItemCategory(item: any): string {
  return typeof item.category === "string"
    ? item.category
    : item.category?.name || "unknown";
}

function getItemStyleTags(item: any, limit?: number): string {
  const tags =
    item.clothing_item_style_tags?.map((tag: any) => tag.style_tag?.name) || [];
  const sortedTags = tags.sort();
  const limitedTags = limit ? sortedTags.slice(0, limit) : sortedTags;
  return limitedTags.join(",");
}

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

function getWeekOfYear(): number {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const diff = now.getTime() - start.getTime();
  return Math.ceil(diff / (7 * 24 * 60 * 60 * 1000));
}

/**
 * Cache key optimization strategies
 */
export const CacheKeyStrategies = {
  // High cache hit rate, lower specificity
  PERFORMANCE_OPTIMIZED: {
    granularity: "coarse" as const,
    contextWeight: 0.7,
    seasonalSensitivity: false,
    evolutionTracking: false,
  },

  // Balanced approach
  BALANCED: {
    granularity: "medium" as const,
    contextWeight: 1.0,
    seasonalSensitivity: true,
    evolutionTracking: true,
  },

  // High specificity, lower cache hit rate
  PRECISION_OPTIMIZED: {
    granularity: "fine" as const,
    contextWeight: 1.2,
    seasonalSensitivity: true,
    evolutionTracking: true,
    includeTimestamp: true,
  },
};

/**
 * Analyze cache key effectiveness
 */
export function analyzeCacheKeyEffectiveness(
  keys: string[],
  hitRates: number[],
): {
  averageHitRate: number;
  keyDistribution: number;
  recommendations: string[];
} {
  const averageHitRate =
    hitRates.reduce((sum, rate) => sum + rate, 0) / hitRates.length;

  // Calculate key distribution (uniqueness)
  const uniqueKeys = new Set(keys).size;
  const keyDistribution = uniqueKeys / keys.length;

  const recommendations: string[] = [];

  if (averageHitRate < 0.3) {
    recommendations.push(
      "Consider using PERFORMANCE_OPTIMIZED strategy for higher cache hit rates",
    );
  }

  if (keyDistribution > 0.9) {
    recommendations.push(
      "Cache keys are too specific, consider coarser granularity",
    );
  }

  if (keyDistribution < 0.5) {
    recommendations.push(
      "Cache keys may be too generic, consider finer granularity",
    );
  }

  return {
    averageHitRate: Math.round(averageHitRate * 100) / 100,
    keyDistribution: Math.round(keyDistribution * 100) / 100,
    recommendations,
  };
}
