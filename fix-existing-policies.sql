-- FIX EXISTING POLICY CONFLICTS
-- Run this script to resolve the "policy already exists" error

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own cached results" ON public.gemini_cache;
DROP POLICY IF EXISTS "Service role can manage all cache entries" ON public.gemini_cache;

-- Recreate the policies
CREATE POLICY "Users can view their own cached results" ON public.gemini_cache
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all cache entries" ON public.gemini_cache
  USING (auth.jwt() ->> 'role' = 'service_role');

-- Verify the policies were created
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
WHERE tablename = 'gemini_cache';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Policy conflicts resolved successfully!';
  RAISE NOTICE '📋 Policies recreated for gemini_cache table';
END $$;

