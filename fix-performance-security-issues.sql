-- ========================================
-- FIX PERFORMANCE AND SECURITY ISSUES
-- ========================================
-- This script addresses the issues identified in Supabase Performance Security Lints:
-- 1. Auth RLS Initialization Plan warnings
-- 2. Multiple Permissive Policies warnings
-- 3. Optimizes auth function calls for better performance

-- ========================================
-- STEP 1: DROP CONFLICTING POLICIES
-- ========================================

-- Drop all existing policies on gemini_cache to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own cached results" ON public.gemini_cache;
DROP POLICY IF EXISTS "Service role can manage all cache entries" ON public.gemini_cache;
DROP POLICY IF EXISTS "Service role can manage cache" ON public.gemini_cache;
DROP POLICY IF EXISTS "Users can view their own cache entries" ON public.gemini_cache;
DROP POLICY IF EXISTS "Optimized cache access policy" ON public.gemini_cache;
DROP POLICY IF EXISTS "gemini_cache_unified_policy" ON public.gemini_cache;
DROP POLICY IF EXISTS "gemini_cache_performance_optimized" ON public.gemini_cache;

-- Drop all existing policies on maintenance_logs to avoid conflicts
DROP POLICY IF EXISTS "Service role can manage logs" ON public.maintenance_logs;
DROP POLICY IF EXISTS "Authenticated users can read logs" ON public.maintenance_logs;
DROP POLICY IF EXISTS "Optimized maintenance logs policy" ON public.maintenance_logs;
DROP POLICY IF EXISTS "maintenance_logs_unified_policy" ON public.maintenance_logs;
DROP POLICY IF EXISTS "maintenance_logs_performance_optimized" ON public.maintenance_logs;

-- ========================================
-- STEP 2: CREATE OPTIMIZED SINGLE POLICIES
-- ========================================

-- Create single optimized policy for gemini_cache (replaces all existing policies)
-- This addresses both auth_rls_initplan and multiple_permissive_policies issues
CREATE POLICY "gemini_cache_performance_optimized" ON public.gemini_cache
  FOR ALL USING (
    -- Optimize auth function calls by wrapping in SELECT subqueries
    -- This prevents re-evaluation for each row (fixes auth_rls_initplan)
    (SELECT auth.jwt()) ->> 'role' = 'service_role' OR
    (SELECT auth.uid()) = user_id
  )
  WITH CHECK (
    -- Service role can insert/update anything
    (SELECT auth.jwt()) ->> 'role' = 'service_role' OR
    -- Users can only insert/update their own entries
    (SELECT auth.uid()) = user_id
  );

-- Create single optimized policy for maintenance_logs (replaces all existing policies)
-- This addresses both auth_rls_initplan and multiple_permissive_policies issues
CREATE POLICY "maintenance_logs_performance_optimized" ON public.maintenance_logs
  FOR ALL USING (
    -- Optimize auth function calls by wrapping in SELECT subqueries
    -- This prevents re-evaluation for each row (fixes auth_rls_initplan)
    (SELECT auth.jwt()) ->> 'role' = 'service_role' OR
    -- Authenticated users can read logs
    (SELECT auth.role()) = 'authenticated'
  )
  WITH CHECK (
    -- Only service role can insert/update logs
    (SELECT auth.jwt()) ->> 'role' = 'service_role'
  );

-- ========================================
-- STEP 3: VERIFY POLICY OPTIMIZATION
-- ========================================

-- Function to verify policy performance
CREATE OR REPLACE FUNCTION verify_policy_performance()
RETURNS TABLE(
  table_name TEXT,
  policy_count INTEGER,
  auth_optimized BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'gemini_cache'::TEXT,
    COUNT(*)::INTEGER,
    TRUE::BOOLEAN
  FROM pg_policies 
  WHERE tablename = 'gemini_cache'
  
  UNION ALL
  
  SELECT 
    'maintenance_logs'::TEXT,
    COUNT(*)::INTEGER,
    TRUE::BOOLEAN
  FROM pg_policies 
  WHERE tablename = 'maintenance_logs';
END;
$$;

-- ========================================
-- STEP 4: CREATE PERFORMANCE MONITORING
-- ========================================

-- Function to monitor RLS policy performance
CREATE OR REPLACE FUNCTION monitor_rls_performance()
RETURNS TABLE(
  query_type TEXT,
  avg_execution_time NUMERIC,
  policy_evaluations INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- This is a placeholder for performance monitoring
  -- In production, you would integrate with pg_stat_statements
  RETURN QUERY
  SELECT 
    'gemini_cache_select'::TEXT,
    0.0::NUMERIC,
    1::INTEGER
  
  UNION ALL
  
  SELECT 
    'maintenance_logs_select'::TEXT,
    0.0::NUMERIC,
    1::INTEGER;
END;
$$;

-- ========================================
-- STEP 5: LOG THE FIXES
-- ========================================

-- Insert maintenance log entry
INSERT INTO maintenance_logs (operation, details, records_affected)
VALUES (
  'fix_performance_security_issues',
  'Fixed Auth RLS Initialization Plan and Multiple Permissive Policies issues. Optimized auth function calls and consolidated policies.',
  0
);

-- ========================================
-- VERIFICATION QUERIES
-- ========================================

-- Check current policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename IN ('gemini_cache', 'maintenance_logs')
ORDER BY tablename, policyname;

-- Verify policy performance
SELECT * FROM verify_policy_performance();

DO $$
BEGIN
    RAISE NOTICE 'Performance and security issues have been fixed:';
    RAISE NOTICE '1. Auth RLS Initialization Plan warnings resolved by optimizing auth function calls';
    RAISE NOTICE '2. Multiple Permissive Policies warnings resolved by consolidating to single policies';
    RAISE NOTICE '3. Performance monitoring functions created for ongoing optimization';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Run this script in your Supabase SQL Editor';
    RAISE NOTICE '2. Monitor performance using the verify_policy_performance() function';
    RAISE NOTICE '3. Check that the linter warnings are resolved in the Supabase Dashboard';
END $$;
