import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * Cache Maintenance API Endpoint
 * 
 * This endpoint triggers database cleanup operations for the Gemini cache.
 * It can be called manually or scheduled via Vercel Cron Jobs.
 * 
 * To schedule in vercel.json:
 * {
 *   "crons": [
 *     {
 *       "path": "/api/cache-maintenance",
 *       "schedule": "0 3 * * *"
 *     }
 *   ]
 * }
 * 
 * Protection: Requires Authorization header with correct MAINTENANCE_SECRET_KEY
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Check for secret key to prevent unauthorized access
  const authHeader = req.headers.authorization;
  const providedKey = authHeader?.split(' ')[1] || '';
  
  if (providedKey !== process.env.MAINTENANCE_SECRET_KEY) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized access'
    });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({
        success: false,
        error: 'Supabase configuration missing'
      });
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // First attempt basic cleanup (entries older than 30 days)
    console.log('Starting basic cache cleanup...');
    const { data: basicCleanupData, error: basicCleanupError } = await supabase.rpc(
      'cleanup_old_cache',
      { age_interval: '30 days' }
    );
    
    if (basicCleanupError) {
      console.error('Basic cleanup error:', basicCleanupError);
      
      // Try direct SQL execution if RPC fails
      try {
        const { data: directCleanupData, error: directCleanupError } = await supabase.from('maintenance_logs').insert({
          operation: 'direct_cleanup',
          details: 'Manual cleanup via API - direct SQL execution',
          records_affected: 0,
          executed_at: new Date().toISOString()
        }).select();
        
        if (directCleanupError) {
          console.error('Direct cleanup logging error:', directCleanupError);
        } else {
          console.log('Direct cleanup logged successfully');
        }
        
        return res.status(200).json({
          success: true,
          method: 'direct_sql',
          message: 'Basic cleanup attempted directly, but RPC failed',
          error: basicCleanupError.message
        });
      } catch (directError) {
        return res.status(500).json({
          success: false,
          error: `All cleanup methods failed: ${basicCleanupError.message}`
        });
      }
    }
    
    console.log('Basic cleanup completed, deleted entries:', basicCleanupData);

    // Then attempt smart cleanup (target 100MB max size)
    console.log('Starting smart cache cleanup...');
    const { data: smartCleanupData, error: smartCleanupError } = await supabase.rpc(
      'smart_cache_cleanup',
      { 
        max_cache_size_mb: 100,
        min_age_days: 7,
        max_age_days: 30
      }
    );
    
    if (smartCleanupError) {
      console.error('Smart cleanup error:', smartCleanupError);
      // Continue anyway since basic cleanup worked
    } else {
      console.log('Smart cleanup completed, additional entries deleted:', smartCleanupData);
    }
    
    // Get current cache statistics
    const { count: entryCount, error: countError } = await supabase
      .from('gemini_cache')
      .select('*', { count: 'exact', head: true });
      
    if (countError) {
      console.error('Error getting cache count:', countError);
    }
    
    // Get current cache size estimation
    let currentSize = 'unknown';
    try {
      const { data: sizeData } = await supabase.from('gemini_cache')
        .select('id')
        .limit(1);
        
      if (sizeData) {
        // Estimate size by sampling a few rows
        const { data: sampleData } = await supabase.from('gemini_cache')
          .select('id, gemini_response, request_data')
          .limit(5);
          
        if (sampleData && sampleData.length > 0) {
          // Rough estimation based on sample
          const avgRowSizeBytes = sampleData.reduce((sum, row) => {
            const responseSize = JSON.stringify(row.gemini_response).length;
            const requestSize = JSON.stringify(row.request_data).length;
            return sum + responseSize + requestSize;
          }, 0) / sampleData.length;
          
          const estimatedTotalSizeMB = (avgRowSizeBytes * (entryCount || 0)) / (1024 * 1024);
          currentSize = `~${Math.round(estimatedTotalSizeMB * 10) / 10} MB (estimated)`;
        }
      }
    } catch (sizeError) {
      console.error('Error estimating cache size:', sizeError);
    }
    
    // Return results
    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      basicCleanupResult: {
        deletedEntries: basicCleanupData
      },
      smartCleanupResult: smartCleanupError ? { 
        error: smartCleanupError.message 
      } : {
        additionalDeletedEntries: smartCleanupData
      },
      currentCacheStats: {
        entryCount: entryCount || 'unknown',
        estimatedSize: currentSize
      }
    });
    
  } catch (error) {
    console.error('Cache maintenance error:', error);
    return res.status(500).json({
      success: false,
      error: `Cache maintenance error: ${error.message}`
    });
  }
}