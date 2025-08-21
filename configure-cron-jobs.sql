-- CONFIGURE CRON JOBS FOR CACHE MANAGEMENT
-- Run this script in the Supabase SQL Editor to set up scheduled cleanup jobs

-- IMPORTANT NOTE: This script requires the pg_cron extension, which is not available
-- in all Supabase tiers or projects.
--
-- If you get the error: "ERROR: schema "cron" does not exist"
-- Please refer to the alternative solutions in "manual-cleanup-solution.md"
-- which provides several options that don't require pg_cron.

-- First, check if pg_cron extension is available
SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_cron';

-- ** ONLY PROCEED PAST THIS POINT IF THE ABOVE QUERY RETURNS A RESULT **
-- If it returns no rows, pg_cron is not available - use manual-cleanup-solution.md instead

-- Remove any existing jobs with the same names (to avoid duplicates)
-- These commands will fail if pg_cron is not available
DO $$
BEGIN
  -- Use exception handling to prevent script failure
  BEGIN
    PERFORM cron.unschedule('daily-smart-cache-cleanup');
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not unschedule daily job (may not exist yet)';
  END;
  
  BEGIN
    PERFORM cron.unschedule('weekly-basic-cache-cleanup');
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Could not unschedule weekly job (may not exist yet)';
  END;
END $$;

-- Schedule primary smart cleanup job to run daily at 3 AM UTC
-- This job uses the smart_cache_cleanup function that considers usage patterns
SELECT cron.schedule(
  'daily-smart-cache-cleanup',       -- name of the job
  '0 3 * * *',                       -- cron schedule (3 AM UTC daily)
  $$SELECT smart_cache_cleanup(
    100,                             -- Max cache size in MB (adjust based on your Supabase plan)
    7,                               -- Min age in days (don't delete newer than this)
    30                               -- Max age in days (always delete older than this)
  )$$
);

-- Schedule backup weekly cleanup job in case the smart cleanup fails
-- This is a simpler, more robust job that just removes old entries
SELECT cron.schedule(
  'weekly-basic-cache-cleanup',      -- name of the job
  '0 4 * * 0',                       -- cron schedule (4 AM UTC every Sunday)
  $$SELECT cleanup_old_cache('21 days')$$  -- Remove entries older than 3 weeks
);

-- Display all scheduled jobs to verify configuration
SELECT 
  jobid,
  jobname,
  schedule,
  command,
  nodename,
  nodeport,
  database,
  username,
  active
FROM cron.job
ORDER BY jobname;

-- MONITORING QUERY - Run this to check job history
/*
SELECT 
  jobid,
  jobname,
  start_time,
  end_time,
  status,
  return_message,
  error_message
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 10;
*/

-- NOTES:
-- 1. These jobs run automatically according to the schedule (if pg_cron is available)
-- 2. You can manually trigger a cleanup with: SELECT smart_cache_cleanup();
-- 3. Monitor job status with the query above
-- 4. Adjust the max_cache_size_mb parameter based on your Supabase plan:
--    - Free tier: 100-200 MB recommended
--    - Pro tier: 500-1000 MB recommended
--    - Team/Enterprise: 1000+ MB as needed
--
-- ALTERNATIVE SOLUTIONS (If pg_cron is not available):
-- 1. See manual-cleanup-solution.md for:
--    - SQL script for manual execution
--    - Vercel Cron Job implementation
--    - GitHub Actions scheduler approach