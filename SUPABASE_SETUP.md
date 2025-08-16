# 🗄️ Supabase Database Setup for FitMatch AI

## Overview
FitMatch requires a Supabase database with specific tables for managing users, clothing items, categories, and style tags.

## Quick Setup Checklist
- ✅ Supabase project created
- ✅ Environment variables configured
- ⏳ Database schema setup (run SQL below)
- ⏳ Row Level Security (RLS) policies
- ⏳ Test the connection

## 🔧 Database Schema

Run this SQL in your Supabase SQL Editor to create all required tables:

```sql
-- Enable Row Level Security
ALTER DATABASE postgres SET row_security = on;

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create style_tags table
CREATE TABLE IF NOT EXISTS style_tags (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create clothing_items table
CREATE TABLE IF NOT EXISTS clothing_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    name VARCHAR(200) NOT NULL,
    brand VARCHAR(100),
    color VARCHAR(50),
    size VARCHAR(20),
    price DECIMAL(10,2),
    purchase_date DATE,
    image_url TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create clothing_item_style_tags junction table
CREATE TABLE IF NOT EXISTS clothing_item_style_tags (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    clothing_item_id UUID REFERENCES clothing_items(id) ON DELETE CASCADE,
    style_tag_id UUID REFERENCES style_tags(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(clothing_item_id, style_tag_id)
);

-- Create user_profiles table (optional, for enhanced features)
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT,
    avatar_url TEXT,
    style_preference TEXT,
    age INTEGER,
    gender TEXT,
    lifestyle TEXT,
    body_type TEXT,
    budget_range TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create outfit_suggestions table (for saving AI-generated outfits)
CREATE TABLE IF NOT EXISTS outfit_suggestions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    occasion VARCHAR(100),
    weather VARCHAR(50),
    confidence DECIMAL(3,2),
    clothing_item_ids UUID[] NOT NULL,
    styling_tips TEXT[],
    color_analysis TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert default categories
INSERT INTO categories (name, description) VALUES
    ('Tops', 'Shirts, blouses, t-shirts, sweaters'),
    ('Bottoms', 'Pants, jeans, skirts, shorts'),
    ('Dresses', 'Casual and formal dresses'),
    ('Outerwear', 'Jackets, coats, blazers'),
    ('Shoes', 'Sneakers, boots, heels, flats'),
    ('Accessories', 'Bags, jewelry, scarves, belts'),
    ('Activewear', 'Gym clothes, sports wear'),
    ('Sleepwear', 'Pajamas, nightgowns'),
    ('Undergarments', 'Bras, underwear, shapewear'),
    ('Swimwear', 'Bikinis, swimsuits, cover-ups')
ON CONFLICT (name) DO NOTHING;

-- Insert default style tags
INSERT INTO style_tags (name, description) VALUES
    ('Casual', 'Relaxed, everyday wear'),
    ('Formal', 'Business or evening formal wear'),
    ('Bohemian', 'Free-spirited, artistic style'),
    ('Minimalist', 'Clean, simple, understated'),
    ('Vintage', 'Retro or classic styles'),
    ('Edgy', 'Bold, unconventional style'),
    ('Romantic', 'Feminine, soft, flowing'),
    ('Sporty', 'Athletic, comfortable'),
    ('Preppy', 'Classic, clean-cut style'),
    ('Trendy', 'Current fashion trends'),
    ('Classic', 'Timeless, traditional style'),
    ('Streetwear', 'Urban, hip-hop inspired'),
    ('Elegant', 'Sophisticated, refined'),
    ('Artsy', 'Creative, unique style'),
    ('Comfortable', 'Prioritizes comfort and ease')
ON CONFLICT (name) DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_clothing_items_user_id ON clothing_items(user_id);
CREATE INDEX IF NOT EXISTS idx_clothing_items_category_id ON clothing_items(category_id);
CREATE INDEX IF NOT EXISTS idx_clothing_item_style_tags_clothing_item_id ON clothing_item_style_tags(clothing_item_id);
CREATE INDEX IF NOT EXISTS idx_clothing_item_style_tags_style_tag_id ON clothing_item_style_tags(style_tag_id);
CREATE INDEX IF NOT EXISTS idx_outfit_suggestions_user_id ON outfit_suggestions(user_id);
```

## 🔐 Row Level Security (RLS) Policies

Run this SQL to enable RLS policies:

```sql
-- Enable RLS on all tables
ALTER TABLE clothing_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE clothing_item_style_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE outfit_suggestions ENABLE ROW LEVEL SECURITY;

-- Categories and style_tags are public (read-only for all users)
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE style_tags ENABLE ROW LEVEL SECURITY;

-- Policies for clothing_items
CREATE POLICY "Users can view their own clothing items" ON clothing_items
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own clothing items" ON clothing_items
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own clothing items" ON clothing_items
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own clothing items" ON clothing_items
    FOR DELETE USING (auth.uid() = user_id);

-- Policies for clothing_item_style_tags
CREATE POLICY "Users can manage style tags for their clothing items" ON clothing_item_style_tags
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM clothing_items 
            WHERE clothing_items.id = clothing_item_style_tags.clothing_item_id 
            AND clothing_items.user_id = auth.uid()
        )
    );

-- Policies for user_profiles
CREATE POLICY "Users can view their own profile" ON user_profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON user_profiles
    FOR ALL USING (auth.uid() = id);

-- Policies for outfit_suggestions
CREATE POLICY "Users can manage their own outfit suggestions" ON outfit_suggestions
    FOR ALL USING (auth.uid() = user_id);

-- Public read access for categories and style_tags
CREATE POLICY "Categories are viewable by everyone" ON categories
    FOR SELECT USING (true);

CREATE POLICY "Style tags are viewable by everyone" ON style_tags
    FOR SELECT USING (true);
```

## ✅ Test Your Setup

After running the SQL above, test your setup:

1. **Start your development server:**
   ```bash
   npm run dev
   ```

2. **Open the app:**
   ```
   http://localhost:8080
   ```

3. **Sign up/Sign in:**
   - Create a test account
   - Verify you can access the dashboard

4. **Test functionality:**
   - Try uploading a clothing item
   - Check if categories and style tags load
   - Test the AI stylist (after adding your Hugging Face API key)

## 🔧 Troubleshooting

### "Failed to load style tags" error:
- Ensure the SQL schema has been run
- Check RLS policies are correctly applied
- Verify your Supabase credentials in `.env.local`

### Authentication issues:
- Check if email confirmation is required in Supabase auth settings
- Verify redirect URLs in Supabase dashboard

### API connection errors:
- Double-check your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Ensure your Supabase project is not paused

## 🎯 Next Steps

Once your database is set up:
1. Add your Hugging Face API key to `.env.local`
2. Start uploading clothing items
3. Try the AI stylist features
4. Generate outfit suggestions

Your FitMatch AI database is now ready! 🚀
