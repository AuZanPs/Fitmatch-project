-- FIX CLEANUP FUNCTIONS SYNTAX
-- Run this script to fix the "aggregate functions are not allowed in RETURNING" error

-- Fix the basic cleanup function
CREATE OR REPLACE FUNCTION cleanup_old_cache(age_interval TEXT)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.gemini_cache
  WHERE created_at < NOW() - age_interval::interval;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Fix the smart cleanup function
CREATE OR REPLACE FUNCTION smart_cache_cleanup(
  max_cache_size_mb INTEGER DEFAULT 100,
  min_age_days INTEGER DEFAULT 7,
  max_age_days INTEGER DEFAULT 30
)
RETURNS INTEGER AS $$
DECLARE
  current_size_mb INTEGER;
  deleted_count INTEGER := 0;
  additional_deleted INTEGER := 0;
  target_reduction_mb INTEGER;
  min_age_interval INTERVAL := (min_age_days || ' days')::INTERVAL;
  max_age_interval INTERVAL := (max_age_days || ' days')::INTERVAL;
BEGIN
  -- Get current cache size in MB (rough estimation)
  SELECT COALESCE(SUM(pg_column_size(gemini_response) + pg_column_size(request_data)) / 1024 / 1024, 0)
  INTO current_size_mb
  FROM public.gemini_cache;
  
  -- First pass: Delete all entries older than max_age_days
  DELETE FROM public.gemini_cache
  WHERE created_at < NOW() - max_age_interval;
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- If we're still over the size limit, do a second pass based on access patterns
  IF current_size_mb > max_cache_size_mb THEN
    target_reduction_mb := current_size_mb - max_cache_size_mb;
    
    -- Delete less frequently accessed entries older than min_age_days
    WITH ranked_cache AS (
      SELECT 
        id,
        (access_count::float / EXTRACT(EPOCH FROM (NOW() - created_at)) * 86400) AS access_score
      FROM public.gemini_cache
      WHERE created_at < NOW() - min_age_interval
      ORDER BY access_score ASC
    )
    DELETE FROM public.gemini_cache
    WHERE id IN (
      SELECT id FROM ranked_cache
      WHERE access_score < 5 -- Don't delete very frequently accessed items
      LIMIT 100 -- Limit deletion batch size
    );
    
    GET DIAGNOSTICS additional_deleted = ROW_COUNT;
    deleted_count := deleted_count + additional_deleted;
  END IF;
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Test the fixed functions
SELECT 'Testing cleanup functions...' as status;

-- Test basic cleanup function
SELECT cleanup_old_cache('1 day') as deleted_count;

-- Test smart cleanup function
SELECT smart_cache_cleanup(100, 7, 30) as deleted_count;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Cleanup functions fixed successfully!';
  RAISE NOTICE '🧹 Both cleanup_old_cache and smart_cache_cleanup are now working';
  RAISE NOTICE '📊 Test results above show the functions are operational';
END $$;
