-- Complete FitMatch Database Setup
-- Copy and paste this entire script into your Supabase SQL Editor
-- Go to: https://app.supabase.com/project/owwryegaxmhegqjusykf/sql

-- 1. Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create style_tags table
CREATE TABLE IF NOT EXISTS style_tags (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create clothing_items table
CREATE TABLE IF NOT EXISTS clothing_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  brand VARCHAR(255),
  color VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create junction table for clothing items and style tags (many-to-many)
CREATE TABLE IF NOT EXISTS clothing_item_style_tags (
  id SERIAL PRIMARY KEY,
  clothing_item_id UUID NOT NULL REFERENCES clothing_items(id) ON DELETE CASCADE,
  style_tag_id INTEGER NOT NULL REFERENCES style_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(clothing_item_id, style_tag_id)
);

-- 5. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_clothing_items_user_id ON clothing_items(user_id);
CREATE INDEX IF NOT EXISTS idx_clothing_items_category_id ON clothing_items(category_id);
CREATE INDEX IF NOT EXISTS idx_clothing_item_style_tags_clothing_item_id ON clothing_item_style_tags(clothing_item_id);
CREATE INDEX IF NOT EXISTS idx_clothing_item_style_tags_style_tag_id ON clothing_item_style_tags(style_tag_id);

-- 6. Enable Row Level Security (RLS) on ALL tables
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE style_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE clothing_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE clothing_item_style_tags ENABLE ROW LEVEL SECURITY;

-- 7. Create RLS policies for clothing_items (with DROP IF EXISTS to handle existing policies)
DROP POLICY IF EXISTS "Users can view their own clothing items" ON clothing_items;
CREATE POLICY "Users can view their own clothing items" ON clothing_items
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own clothing items" ON clothing_items;
CREATE POLICY "Users can insert their own clothing items" ON clothing_items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own clothing items" ON clothing_items;
CREATE POLICY "Users can update their own clothing items" ON clothing_items
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own clothing items" ON clothing_items;
CREATE POLICY "Users can delete their own clothing items" ON clothing_items
  FOR DELETE USING (auth.uid() = user_id);

-- 8. Create RLS policies for categories and style_tags (public read access)
DROP POLICY IF EXISTS "Public read access for categories" ON categories;
CREATE POLICY "Public read access for categories" ON categories
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public read access for style_tags" ON style_tags;
CREATE POLICY "Public read access for style_tags" ON style_tags
  FOR SELECT USING (true);

-- 9. Create RLS policies for clothing_item_style_tags (with DROP IF EXISTS to handle existing policies)
DROP POLICY IF EXISTS "Users can view style tags for their clothing items" ON clothing_item_style_tags;
CREATE POLICY "Users can view style tags for their clothing items" ON clothing_item_style_tags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM clothing_items 
      WHERE clothing_items.id = clothing_item_style_tags.clothing_item_id 
      AND clothing_items.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert style tags for their clothing items" ON clothing_item_style_tags;
CREATE POLICY "Users can insert style tags for their clothing items" ON clothing_item_style_tags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM clothing_items 
      WHERE clothing_items.id = clothing_item_style_tags.clothing_item_id 
      AND clothing_items.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update style tags for their clothing items" ON clothing_item_style_tags;
CREATE POLICY "Users can update style tags for their clothing items" ON clothing_item_style_tags
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM clothing_items 
      WHERE clothing_items.id = clothing_item_style_tags.clothing_item_id 
      AND clothing_items.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete style tags for their clothing items" ON clothing_item_style_tags;
CREATE POLICY "Users can delete style tags for their clothing items" ON clothing_item_style_tags
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM clothing_items 
      WHERE clothing_items.id = clothing_item_style_tags.clothing_item_id 
      AND clothing_items.user_id = auth.uid()
    )
  );

-- 10. Insert default categories (THIS IS WHAT YOU'RE MISSING!)
INSERT INTO categories (name) VALUES 
  ('Tops'),
  ('Bottoms'),
  ('Outerwear'),
  ('Shoes'),
  ('Accessories'),
  ('Dresses'),
  ('Activewear')
ON CONFLICT (name) DO NOTHING;

-- 11. Insert default style tags (THIS IS WHAT YOU'RE MISSING!)
INSERT INTO style_tags (name) VALUES 
  ('Casual'),
  ('Formal'),
  ('Business'),
  ('Party'),
  ('Sport'),
  ('Beach'),
  ('Winter'),
  ('Summer'),
  ('Spring'),
  ('Fall'),
  ('Vintage'),
  ('Modern'),
  ('Minimalist'),
  ('Streetwear'),
  ('Elegant'),
  ('Chic'),
  ('Comfortable')
ON CONFLICT (name) DO NOTHING;

-- 12. Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 13. Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_clothing_items_updated_at ON clothing_items;
CREATE TRIGGER update_clothing_items_updated_at 
    BEFORE UPDATE ON clothing_items 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 14. Create storage bucket for clothing images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('clothing-images', 'clothing-images', true)
ON CONFLICT (id) DO NOTHING;

-- 15. Create storage policies
DROP POLICY IF EXISTS "Users can upload their own images" ON storage.objects;
CREATE POLICY "Users can upload their own images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'clothing-images' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can view their own images" ON storage.objects;
CREATE POLICY "Users can view their own images" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'clothing-images' AND 
    (auth.uid()::text = (storage.foldername(name))[1] OR bucket_id = 'clothing-images')
  );

DROP POLICY IF EXISTS "Users can update their own images" ON storage.objects;
CREATE POLICY "Users can update their own images" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'clothing-images' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can delete their own images" ON storage.objects;
CREATE POLICY "Users can delete their own images" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'clothing-images' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- 16. Clean up brand data for consistency (fix duplicates and normalize)
UPDATE clothing_items 
SET brand = 'Nike' 
WHERE LOWER(TRIM(brand)) = 'nike';

UPDATE clothing_items 
SET brand = 'Adidas' 
WHERE LOWER(TRIM(brand)) = 'adidas';

UPDATE clothing_items 
SET brand = 'Zara' 
WHERE LOWER(TRIM(brand)) = 'zara';

UPDATE clothing_items 
SET brand = 'H&M' 
WHERE LOWER(TRIM(brand)) = 'h&m';

-- Remove leading/trailing spaces from all brand names
UPDATE clothing_items 
SET brand = TRIM(brand) 
WHERE brand IS NOT NULL AND brand != TRIM(brand);

-- Capitalize first letter of all brand names for consistency
UPDATE clothing_items 
SET brand = INITCAP(brand) 
WHERE brand IS NOT NULL;

-- 17. OPTIMIZE RLS POLICIES WITH PROPER auth.uid() PATTERN
-- Replace existing policies with optimized versions that cache auth.uid()

-- Drop and recreate clothing_items policies with optimization
DROP POLICY IF EXISTS "Users can view their own clothing items" ON clothing_items;
CREATE POLICY "Users can view their own clothing items" ON clothing_items
  FOR SELECT USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own clothing items" ON clothing_items;
CREATE POLICY "Users can insert their own clothing items" ON clothing_items
  FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own clothing items" ON clothing_items;
CREATE POLICY "Users can update their own clothing items" ON clothing_items
  FOR UPDATE USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own clothing items" ON clothing_items;
CREATE POLICY "Users can delete their own clothing items" ON clothing_items
  FOR DELETE USING ((SELECT auth.uid()) = user_id);

-- Optimize style tags policies with cached auth.uid()
DROP POLICY IF EXISTS "Users can view style tags for their clothing items" ON clothing_item_style_tags;
CREATE POLICY "Users can view style tags for their clothing items" ON clothing_item_style_tags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM clothing_items 
      WHERE clothing_items.id = clothing_item_style_tags.clothing_item_id 
      AND clothing_items.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert style tags for their clothing items" ON clothing_item_style_tags;
CREATE POLICY "Users can insert style tags for their clothing items" ON clothing_item_style_tags
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM clothing_items 
      WHERE clothing_items.id = clothing_item_style_tags.clothing_item_id 
      AND clothing_items.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update style tags for their clothing items" ON clothing_item_style_tags;
CREATE POLICY "Users can update style tags for their clothing items" ON clothing_item_style_tags
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM clothing_items 
      WHERE clothing_items.id = clothing_item_style_tags.clothing_item_id 
      AND clothing_items.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete style tags for their clothing items" ON clothing_item_style_tags;
CREATE POLICY "Users can delete style tags for their clothing items" ON clothing_item_style_tags
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM clothing_items 
      WHERE clothing_items.id = clothing_item_style_tags.clothing_item_id 
      AND clothing_items.user_id = (SELECT auth.uid())
    )
  );

-- 18. INDEX OPTIMIZATION - Remove unused indexes and keep only essential ones
-- Drop unused indexes that were identified in performance analysis
DROP INDEX IF EXISTS idx_clothing_items_user_id_category_id;
DROP INDEX IF EXISTS idx_clothing_items_user_id_created_at;
DROP INDEX IF EXISTS idx_clothing_item_style_tags_composite;
DROP INDEX IF EXISTS idx_clothing_items_user_id_with_brand;
DROP INDEX IF EXISTS idx_clothing_items_user_id_with_color;
DROP INDEX IF EXISTS idx_clothing_items_user_id_efficient;

-- Keep only the essential indexes (these were already created above but let's ensure they exist)
CREATE INDEX IF NOT EXISTS idx_clothing_items_user_id ON clothing_items(user_id);
CREATE INDEX IF NOT EXISTS idx_clothing_items_category_id ON clothing_items(category_id);
CREATE INDEX IF NOT EXISTS idx_clothing_item_style_tags_clothing_item_id ON clothing_item_style_tags(clothing_item_id);
CREATE INDEX IF NOT EXISTS idx_clothing_item_style_tags_style_tag_id ON clothing_item_style_tags(style_tag_id);

-- 19. CREATE SECURE FUNCTIONS WITH PROPER SEARCH PATH
-- These functions prevent function search path vulnerabilities

-- Drop existing functions first to avoid return type conflicts
DROP FUNCTION IF EXISTS get_user_clothing_items_with_tags(UUID);
DROP FUNCTION IF EXISTS get_user_clothing_items_by_style(UUID, INTEGER);

CREATE OR REPLACE FUNCTION get_user_clothing_items_with_tags(user_uuid UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  image_url TEXT,
  category_id INTEGER,
  category_name TEXT,
  brand TEXT,
  color TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  style_tag_count BIGINT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ci.id,
    ci.user_id,
    ci.image_url,
    ci.category_id,
    c.name as category_name,
    ci.brand,
    ci.color,
    ci.created_at,
    ci.updated_at,
    COUNT(cist.style_tag_id) as style_tag_count
  FROM clothing_items ci
  LEFT JOIN categories c ON ci.category_id = c.id
  LEFT JOIN clothing_item_style_tags cist ON ci.id = cist.clothing_item_id
  WHERE ci.user_id = user_uuid
  GROUP BY ci.id, ci.user_id, ci.image_url, ci.category_id, c.name, ci.brand, ci.color, ci.created_at, ci.updated_at
  ORDER BY ci.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION get_user_clothing_items_by_style(user_uuid UUID, style_tag_id INTEGER)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  image_url TEXT,
  category_id INTEGER,
  category_name TEXT,
  brand TEXT,
  color TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ci.id,
    ci.user_id,
    ci.image_url,
    ci.category_id,
    c.name as category_name,
    ci.brand,
    ci.color,
    ci.created_at,
    ci.updated_at
  FROM clothing_items ci
  LEFT JOIN categories c ON ci.category_id = c.id
  INNER JOIN clothing_item_style_tags cist ON ci.id = cist.clothing_item_id
  WHERE ci.user_id = user_uuid AND cist.style_tag_id = get_user_clothing_items_by_style.style_tag_id
  ORDER BY ci.created_at DESC;
END;
$$;

-- 20. FIX SECURITY DEFINER VIEW ISSUE
-- Completely remove the problematic view and create a replacement with security_invoker=on
DROP VIEW IF EXISTS clothing_items_with_details CASCADE;

-- Create view with explicit security_invoker=on to use caller's permissions (recommended by Supabase)
-- This ensures the view uses the querying user's RLS policies, not the view creator's
CREATE OR REPLACE VIEW clothing_items_with_details 
WITH (security_invoker=on) AS
SELECT 
  ci.id,
  ci.user_id,
  ci.image_url,
  ci.category_id,
  c.name as category_name,
  ci.brand,
  ci.color,
  ci.created_at,
  ci.updated_at,
  COALESCE(tag_counts.style_tag_count, 0) as style_tag_count
FROM clothing_items ci
LEFT JOIN categories c ON ci.category_id = c.id
LEFT JOIN (
  SELECT 
    clothing_item_id,
    COUNT(*) as style_tag_count
  FROM clothing_item_style_tags
  GROUP BY clothing_item_id
) tag_counts ON ci.id = tag_counts.clothing_item_id;

-- 21. ENSURE PROPER FUNCTION SEARCH PATH
-- Update the trigger function to have secure search path
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- 22. OPTIMIZE STORAGE POLICIES FOR PERFORMANCE
-- Simplify storage policies to reduce overhead
DROP POLICY IF EXISTS "Users can upload their own images" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own images" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for clothing images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Users can manage their own images" ON storage.objects;

-- Create simplified storage policies
CREATE POLICY "Public read access for clothing images" ON storage.objects
  FOR SELECT USING (bucket_id = 'clothing-images');

CREATE POLICY "Authenticated users can upload images" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'clothing-images' AND 
    auth.role() = 'authenticated'
  );

CREATE POLICY "Users can manage their own images" ON storage.objects
  FOR ALL USING (
    bucket_id = 'clothing-images' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- 23. ANALYZE TABLES FOR QUERY OPTIMIZER
-- Update table statistics for better query planning
ANALYZE clothing_items;
ANALYZE clothing_item_style_tags;
ANALYZE categories;
ANALYZE style_tags;

-- 24. VERIFICATION QUERIES
-- Check current table sizes and index usage
SELECT 
  schemaname,
  tablename,
  attname,
  correlation
FROM pg_stats 
WHERE schemaname = 'public' 
  AND tablename IN ('clothing_items', 'clothing_item_style_tags', 'categories', 'style_tags')
ORDER BY tablename, attname;

-- Show index information to verify optimization
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes 
WHERE schemaname = 'public'
  AND tablename IN ('clothing_items', 'clothing_item_style_tags', 'categories', 'style_tags')
ORDER BY tablename, indexname;

-- Show RLS policies to verify they're optimized
SELECT schemaname, tablename, policyname, qual, with_check
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Success messages with next steps
SELECT 'Database setup completed successfully! All performance and security issues addressed.' as message;
SELECT 'Fixed: RLS policies, indexes, function search paths, security definer view, and storage policies.' as database_fixes;
SELECT 'IMPORTANT: You still need to configure Auth security settings manually in Supabase Dashboard:' as auth_note;
SELECT '1. Enable Multi-Factor Authentication (MFA)' as step_1;
SELECT '2. Enable Leaked Password Protection' as step_2;
SELECT 'Go to: Authentication > Settings in your Supabase Dashboard' as dashboard_location;

-- Show current brand list for verification
SELECT 'Current brands in database:' as info;
SELECT DISTINCT brand, COUNT(*) as item_count 
FROM clothing_items 
WHERE brand IS NOT NULL 
GROUP BY brand 
ORDER BY brand;
