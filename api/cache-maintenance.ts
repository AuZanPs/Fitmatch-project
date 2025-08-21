import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

/**
 * Cache maintenance function - runs daily via cron job
 * Cleans up old cache entries and maintains database performance
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests (cron jobs use POST)
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed. Use POST.",
    });
  }

  const startTime = Date.now();

  try {
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

    console.log("🧹 Starting cache maintenance...");

    // Clean up old cache entries (older than 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: deletedEntries, error: deleteError } = await supabase
      .from("gemini_cache")
      .delete()
      .lt("created_at", sevenDaysAgo.toISOString())
      .select("id");

    if (deleteError) {
      console.error("Error deleting old cache entries:", deleteError);
      throw new Error(`Cache cleanup failed: ${deleteError.message}`);
    }

    const deletedCount = deletedEntries?.length || 0;
    console.log(`🗑️ Deleted ${deletedCount} old cache entries`);

    // Get cache statistics
    const { data: cacheStats, error: statsError } = await supabase
      .from("gemini_cache")
      .select("id, created_at")
      .order("created_at", { ascending: false });

    if (statsError) {
      console.error("Error getting cache stats:", statsError);
    }

    const totalEntries = cacheStats?.length || 0;
    const recentEntries = cacheStats?.filter(entry => {
      const entryDate = new Date(entry.created_at);
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      return entryDate > oneDayAgo;
    }).length || 0;

    // Log maintenance results
    const maintenanceResult = {
      timestamp: new Date().toISOString(),
      deleted_entries: deletedCount,
      total_entries: totalEntries,
      recent_entries: recentEntries,
      execution_time_ms: Date.now() - startTime,
    };

    console.log("✅ Cache maintenance completed:", maintenanceResult);

    // Store maintenance log (optional - only if maintenance_logs table exists)
    try {
      await supabase
        .from("maintenance_logs")
        .insert({
          operation_type: "cache_cleanup",
          details: maintenanceResult,
          created_at: new Date().toISOString(),
        });
    } catch (logError) {
      // Ignore if maintenance_logs table doesn't exist
      console.log("Note: maintenance_logs table not available for logging");
    }

    return res.status(200).json({
      success: true,
      message: "Cache maintenance completed successfully",
      results: maintenanceResult,
    });

  } catch (error) {
    console.error("Cache maintenance error:", error);
    return res.status(500).json({
      success: false,
      error: `Cache maintenance failed: ${error.message}`,
      execution_time_ms: Date.now() - startTime,
    });
  }
}