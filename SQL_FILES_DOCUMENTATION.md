# SQL Files Documentation - FitMatch Database

This document provides a comprehensive overview of the SQL database setup for the FitMatch project after the removal of caching functionality.

## Overview

The FitMatch project uses SQL files to manage the core database functionality:
- **Main database setup** with all core tables and security
- **Row Level Security (RLS)** for data protection
- **Performance optimizations** for clothing item retrieval
- **Storage policies** for image uploads

## Core SQL Files

### 1. `complete-database-setup.sql` (Main Database Schema)
**Purpose**: Complete database setup with all core tables, RLS policies, and performance optimizations

**Key Features**:
- Creates all main tables: `clothing_items`, `categories`, `style_tags`, `clothing_item_style_tags`
- Sets up Row Level Security (RLS) policies for data protection
- Creates optimized database functions for clothing item retrieval
- Includes storage policies for image uploads
- **PERFORMANCE**: Addresses Auth RLS Initialization Plan and Multiple Permissive Policies issues

**Tables Created**:
- `clothing_items` - User's clothing with images and metadata
- `categories` - Clothing categories (shirts, pants, etc.)
- `style_tags` - Style descriptors (casual, formal, etc.)
- `clothing_item_style_tags` - Many-to-many relationships

**Functions Created**:
- `get_user_clothing_items_with_tags(user_uuid UUID)` - Optimized clothing retrieval
- `get_user_clothing_items_by_style(user_uuid UUID, style_tag_id INTEGER)` - Style-filtered retrieval

---

### 2. `remove-cache-database.sql` (Cache Cleanup Script)
**Purpose**: Removes all cache-related database structures from existing installations

**Key Features**:
- Drops cache-related functions (`cleanup_old_cache`, `smart_cache_cleanup`)
- Removes cache-related indexes
- Drops cache tables (`gemini_cache`, `maintenance_logs`)
- Includes instructions for manual cron job removal

**Use Case**: Run this script on existing databases to clean up cache-related structures after cache removal

---

## Database Architecture Overview

### Core Tables Relationship
```
auth.users (Supabase Auth)
    ↓
clothing_items
    ↓
clothing_item_style_tags ←→ style_tags
    ↓
categories
```

### Security Model
- **Row Level Security (RLS)** enabled on all tables
- **User Isolation**: Users can only access their own data
- **Service Role Access**: Admin functions for maintenance
- **Optimized Auth Calls**: Uses `(SELECT auth.uid())` pattern for performance

## Performance Optimizations

### RLS Policy Optimizations
- **Single Comprehensive Policies**: Avoids multiple permissive policies performance issue
- **Cached Auth Calls**: Uses `(SELECT auth.uid())` to prevent re-evaluation per row
- **Role-Based Access**: Efficient service role detection

## Deployment Strategy

### Standard Setup (Recommended)
1. Run `complete-database-setup.sql` in Supabase SQL Editor
2. This includes everything: core tables + security + optimizations

### Cleanup Existing Cache Installation
1. Run `remove-cache-database.sql` to clean up cache-related structures
2. Manually remove any associated cron jobs in Supabase
3. Optionally delete old cache-related SQL files

## Environment Variables Required

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AI Configuration
GEMINI_API_KEY=your_gemini_api_key

# Environment
NODE_ENV=production
```

## Monitoring and Maintenance

### Database Health Queries
```sql
-- Check total clothing items
SELECT COUNT(*) as total_items FROM clothing_items;

-- Check items by category
SELECT c.name, COUNT(ci.id) as item_count 
FROM categories c 
LEFT JOIN clothing_items ci ON c.id = ci.category_id 
GROUP BY c.name;

-- Check user activity
SELECT COUNT(DISTINCT user_id) as active_users FROM clothing_items;
```

## Troubleshooting

### Common Issues and Solutions

1. **"Policy already exists" error**
   - Drop existing policies before recreating
   - Use `DROP POLICY IF EXISTS` statements

2. **Performance issues with RLS policies**
   - Already fixed in `complete-database-setup.sql`
   - Uses optimized auth patterns

3. **UUID parameter mismatch errors**
   - Already fixed in client code
   - Functions use `user_uuid` parameter naming

4. **Storage policy errors**
   - Ensure storage bucket exists in Supabase
   - Check storage policies are properly configured

## Next Steps After Database Setup

1. **Deploy Vercel Functions**: Ensure API endpoints are working
2. **Test Core Functionality**: Verify clothing item CRUD operations
3. **Configure Storage**: Set up image upload and retrieval
4. **Performance Testing**: Monitor query performance and optimize as needed
5. **Security Review**: Ensure RLS policies are working correctly

---

*This documentation reflects the current state of the FitMatch database after the removal of caching functionality. The focus is now on core clothing management features with optimized performance and security.*