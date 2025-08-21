import { createClient } from "@supabase/supabase-js";
import {
  generateContextAwareCacheKey,
  storeContextAwareCache,
} from "./context-aware-cache";
import { batchAIRequest } from "./batch-processor";

/**
 * Proactive cache warming system for common user patterns
 * Implements intelligent pre-generation of likely-to-be-requested AI responses
 */

interface WarmingPattern {
  userId: string;
  promptType: string;
  items: any[];
  context: any;
  userContext?: any;
  frequency: number; // How often this pattern occurs
  lastRequested: Date; // When this pattern was last requested
  priority: "high" | "medium" | "low";
}

interface WarmingJob {
  id: string;
  pattern: WarmingPattern;
  scheduledFor: Date;
  status: "pending" | "processing" | "completed" | "failed";
  attempts: number;
}

interface WarmingStats {
  totalPatterns: number;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
  cacheHitImprovement: number;
  lastWarmingRun: Date;
}

/**
 * Smart Cache Warming Manager
 */
export class CacheWarmingManager {
  private supabase: any;
  private warmingQueue: Map<string, WarmingJob> = new Map();
  private isWarming: boolean = false;
  private warmingInterval: NodeJS.Timeout | null = null;
  private readonly WARMING_INTERVAL = 30 * 60 * 1000; // 30 minutes
  private readonly MAX_CONCURRENT_JOBS = 3;
  private readonly PATTERN_THRESHOLD = 2; // Minimum frequency to consider warming

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Start the cache warming service
   */
  startWarmingService(): void {
    if (this.warmingInterval) {
      console.log("🔥 Cache warming service already running");
      return;
    }

    console.log("🚀 Starting cache warming service...");

    // Run initial warming
    this.runWarmingCycle();

    // Schedule periodic warming
    this.warmingInterval = setInterval(() => {
      this.runWarmingCycle();
    }, this.WARMING_INTERVAL);
  }

  /**
   * Stop the cache warming service
   */
  stopWarmingService(): void {
    if (this.warmingInterval) {
      clearInterval(this.warmingInterval);
      this.warmingInterval = null;
      console.log("🛑 Cache warming service stopped");
    }
  }

  /**
   * Run a complete warming cycle
   */
  private async runWarmingCycle(): Promise<void> {
    if (this.isWarming) {
      console.log("⏳ Cache warming already in progress, skipping cycle");
      return;
    }

    this.isWarming = true;
    console.log("🔥 Starting cache warming cycle...");

    try {
      // Analyze user patterns
      const patterns = await this.analyzeUserPatterns();
      console.log(`📊 Found ${patterns.length} warming patterns`);

      // Generate warming jobs
      const jobs = this.generateWarmingJobs(patterns);
      console.log(`📋 Generated ${jobs.length} warming jobs`);

      // Execute warming jobs
      await this.executeWarmingJobs(jobs);

      // Clean up old cache entries
      await this.cleanupExpiredCache();

      console.log("✅ Cache warming cycle completed");
    } catch (error) {
      console.error("❌ Cache warming cycle failed:", error);
    } finally {
      this.isWarming = false;
    }
  }

  /**
   * Analyze user patterns from cache access logs
   */
  private async analyzeUserPatterns(): Promise<WarmingPattern[]> {
    try {
      // Get recent cache access patterns
      const { data: cacheEntries, error } = await this.supabase
        .from("gemini_cache")
        .select("*")
        .gte(
          "last_accessed_at",
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        ) // Last 7 days
        .gte("access_count", this.PATTERN_THRESHOLD)
        .order("access_count", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Failed to analyze user patterns:", error);
        return [];
      }

      const patterns: WarmingPattern[] = [];

      for (const entry of cacheEntries || []) {
        const requestData = entry.request_data;
        if (!requestData) continue;

        // Extract pattern information
        const pattern: WarmingPattern = {
          userId: entry.user_id,
          promptType: requestData.promptType,
          items: [], // We'll need to reconstruct or store item references
          context: requestData.context || {},
          userContext: requestData.userContext,
          frequency: entry.access_count,
          lastRequested: new Date(entry.last_accessed_at),
          priority: this.calculatePatternPriority(
            entry.access_count,
            entry.last_accessed_at,
          ),
        };

        patterns.push(pattern);
      }

      return patterns;
    } catch (error) {
      console.error("Error analyzing user patterns:", error);
      return [];
    }
  }

  /**
   * Calculate pattern priority based on frequency and recency
   */
  private calculatePatternPriority(
    accessCount: number,
    lastAccessed: string,
  ): "high" | "medium" | "low" {
    const daysSinceAccess =
      (Date.now() - new Date(lastAccessed).getTime()) / (24 * 60 * 60 * 1000);

    if (accessCount >= 10 && daysSinceAccess <= 1) return "high";
    if (accessCount >= 5 && daysSinceAccess <= 3) return "medium";
    return "low";
  }

  /**
   * Generate warming jobs from patterns
   */
  private generateWarmingJobs(patterns: WarmingPattern[]): WarmingJob[] {
    const jobs: WarmingJob[] = [];
    const now = new Date();

    for (const pattern of patterns) {
      // Skip if pattern was recently requested (likely still cached)
      const hoursSinceRequest =
        (now.getTime() - pattern.lastRequested.getTime()) / (60 * 60 * 1000);
      if (hoursSinceRequest < 2) continue;

      // Create warming job
      const job: WarmingJob = {
        id: this.generateJobId(pattern),
        pattern,
        scheduledFor: this.calculateScheduleTime(pattern),
        status: "pending",
        attempts: 0,
      };

      jobs.push(job);
    }

    // Sort by priority and schedule time
    return jobs.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      const priorityDiff =
        priorityOrder[b.pattern.priority] - priorityOrder[a.pattern.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.scheduledFor.getTime() - b.scheduledFor.getTime();
    });
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(pattern: WarmingPattern): string {
    const components = [
      pattern.userId.substring(0, 8),
      pattern.promptType,
      pattern.context.occasion || "general",
      Date.now().toString(36),
    ];
    return components.join("-");
  }

  /**
   * Calculate when to schedule warming based on pattern
   */
  private calculateScheduleTime(pattern: WarmingPattern): Date {
    const now = new Date();

    // High priority patterns: warm immediately
    if (pattern.priority === "high") {
      return now;
    }

    // Medium priority: warm within 15 minutes
    if (pattern.priority === "medium") {
      return new Date(now.getTime() + Math.random() * 15 * 60 * 1000);
    }

    // Low priority: warm within 1 hour
    return new Date(now.getTime() + Math.random() * 60 * 60 * 1000);
  }

  /**
   * Execute warming jobs
   */
  private async executeWarmingJobs(jobs: WarmingJob[]): Promise<void> {
    const activeJobs: Promise<void>[] = [];

    for (const job of jobs) {
      // Limit concurrent jobs
      if (activeJobs.length >= this.MAX_CONCURRENT_JOBS) {
        await Promise.race(activeJobs);
      }

      // Start job
      const jobPromise = this.executeWarmingJob(job)
        .then(() => {
          // Remove from active jobs when completed
          const index = activeJobs.indexOf(jobPromise);
          if (index > -1) activeJobs.splice(index, 1);
        })
        .catch((error) => {
          console.error(`Warming job ${job.id} failed:`, error);
          const index = activeJobs.indexOf(jobPromise);
          if (index > -1) activeJobs.splice(index, 1);
        });

      activeJobs.push(jobPromise);

      // Add job to queue
      this.warmingQueue.set(job.id, job);
    }

    // Wait for all jobs to complete
    await Promise.allSettled(activeJobs);
  }

  /**
   * Execute a single warming job
   */
  private async executeWarmingJob(job: WarmingJob): Promise<void> {
    const now = new Date();

    // Check if it's time to execute
    if (now < job.scheduledFor) {
      const delay = job.scheduledFor.getTime() - now.getTime();
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    job.status = "processing";
    job.attempts++;

    try {
      console.log(
        `🔥 Warming cache for pattern: ${job.pattern.promptType} (${job.pattern.priority} priority)`,
      );

      // Generate cache key for this pattern
      const cacheKeyResult = generateContextAwareCacheKey(
        job.pattern.userId,
        job.pattern.items,
        job.pattern.context,
        job.pattern.promptType,
        job.pattern.userContext,
        "performance", // Use performance strategy for warming
      );

      // Check if already cached
      const { data: existingCache } = await this.supabase
        .from("gemini_cache")
        .select("id")
        .eq("request_hash", cacheKeyResult.key)
        .eq("user_id", job.pattern.userId)
        .single();

      if (existingCache) {
        console.log(`⚡ Pattern already cached, skipping: ${job.id}`);
        job.status = "completed";
        return;
      }

      // Generate AI response using batch processor
      const response = await batchAIRequest(
        job.pattern.userId,
        job.pattern.promptType as any,
        job.pattern.items,
        job.pattern.context,
        "low", // Low priority for warming
      );

      // Store in cache
      await storeContextAwareCache(
        this.supabase,
        cacheKeyResult,
        job.pattern.userId,
        job.pattern.promptType,
        job.pattern.items,
        job.pattern.context,
        response,
        job.pattern.userContext,
      );

      job.status = "completed";
      console.log(`✅ Cache warmed successfully for pattern: ${job.id}`);
    } catch (error) {
      console.error(`❌ Failed to warm cache for pattern ${job.id}:`, error);
      job.status = "failed";

      // Retry logic for failed jobs
      if (job.attempts < 3) {
        job.status = "pending";
        job.scheduledFor = new Date(Date.now() + 5 * 60 * 1000); // Retry in 5 minutes
        console.log(
          `🔄 Retrying warming job ${job.id} (attempt ${job.attempts + 1})`,
        );
      }
    }
  }

  /**
   * Clean up expired cache entries
   */
  private async cleanupExpiredCache(): Promise<void> {
    try {
      const expiredDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

      const { data, error } = await this.supabase
        .from("gemini_cache")
        .delete()
        .lt("created_at", expiredDate.toISOString())
        .eq("access_count", 0); // Only delete unused entries

      if (error) {
        console.error("Failed to cleanup expired cache:", error);
      } else {
        console.log(`🧹 Cleaned up expired cache entries`);
      }
    } catch (error) {
      console.error("Cache cleanup failed:", error);
    }
  }

  /**
   * Get warming statistics
   */
  async getWarmingStats(): Promise<WarmingStats> {
    const jobs = Array.from(this.warmingQueue.values());

    return {
      totalPatterns: jobs.length,
      activeJobs: jobs.filter((job) => job.status === "processing").length,
      completedJobs: jobs.filter((job) => job.status === "completed").length,
      failedJobs: jobs.filter((job) => job.status === "failed").length,
      cacheHitImprovement: await this.calculateCacheHitImprovement(),
      lastWarmingRun: new Date(),
    };
  }

  /**
   * Calculate cache hit improvement from warming
   */
  private async calculateCacheHitImprovement(): Promise<number> {
    try {
      // This would require tracking cache hits before and after warming
      // For now, return a placeholder calculation
      const { data: recentHits } = await this.supabase
        .from("gemini_cache")
        .select("access_count")
        .gte(
          "created_at",
          new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        );

      if (!recentHits || recentHits.length === 0) return 0;

      const totalHits = recentHits.reduce(
        (sum, entry) => sum + (entry.access_count || 0),
        0,
      );
      const averageHits = totalHits / recentHits.length;

      // Estimate improvement (this would be more accurate with proper tracking)
      return Math.min(averageHits * 0.2, 50); // Cap at 50% improvement
    } catch (error) {
      console.error("Failed to calculate cache hit improvement:", error);
      return 0;
    }
  }

  /**
   * Manually trigger warming for specific patterns
   */
  async warmSpecificPatterns(
    userId: string,
    promptTypes: string[],
    contexts: any[],
  ): Promise<void> {
    console.log(
      `🎯 Manual warming triggered for user ${userId.substring(0, 8)}...`,
    );

    const patterns: WarmingPattern[] = [];

    for (let i = 0; i < promptTypes.length; i++) {
      const pattern: WarmingPattern = {
        userId,
        promptType: promptTypes[i],
        items: [], // Would need to be provided or fetched
        context: contexts[i] || {},
        frequency: 1,
        lastRequested: new Date(),
        priority: "high",
      };
      patterns.push(pattern);
    }

    const jobs = this.generateWarmingJobs(patterns);
    await this.executeWarmingJobs(jobs);

    console.log(`✅ Manual warming completed for ${jobs.length} patterns`);
  }
}

/**
 * Global cache warming manager instance
 */
let globalWarmingManager: CacheWarmingManager | null = null;

/**
 * Initialize cache warming service
 */
export function initializeCacheWarming(
  supabaseUrl: string,
  supabaseKey: string,
): CacheWarmingManager {
  if (!globalWarmingManager) {
    globalWarmingManager = new CacheWarmingManager(supabaseUrl, supabaseKey);
    console.log("🔥 Cache warming manager initialized");
  }
  return globalWarmingManager;
}

/**
 * Start cache warming service
 */
export function startCacheWarming(): void {
  if (globalWarmingManager) {
    globalWarmingManager.startWarmingService();
  } else {
    console.warn("⚠️ Cache warming manager not initialized");
  }
}

/**
 * Stop cache warming service
 */
export function stopCacheWarming(): void {
  if (globalWarmingManager) {
    globalWarmingManager.stopWarmingService();
  }
}

/**
 * Get warming statistics
 */
export async function getCacheWarmingStats(): Promise<WarmingStats | null> {
  if (globalWarmingManager) {
    return await globalWarmingManager.getWarmingStats();
  }
  return null;
}

/**
 * Manually warm specific patterns
 */
export async function warmCachePatterns(
  userId: string,
  promptTypes: string[],
  contexts: any[],
): Promise<void> {
  if (globalWarmingManager) {
    await globalWarmingManager.warmSpecificPatterns(
      userId,
      promptTypes,
      contexts,
    );
  } else {
    console.warn("⚠️ Cache warming manager not initialized");
  }
}
