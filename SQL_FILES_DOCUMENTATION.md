# SQL Files Documentation - FitMatch Database

This document provides a comprehensive overview of all SQL files in the FitMatch project, their purposes, and how they work together to create a robust database system with AI caching capabilities.

## Overview

The FitMatch project uses multiple SQL files to manage different aspects of the database:
- **Main database setup** with all core tables and security
- **AI caching system** for Gemini API responses
- **Performance optimizations** and cleanup functions
- **Maintenance and monitoring** capabilities

## Core SQL Files

### 1. `complete-database-setup.sql` (Main Database Schema)
**Purpose**: Complete database setup with all core tables, RLS policies, and performance optimizations

**Key Features**:
- Creates all main tables: `clothing_items`, `categories`, `style_tags`, `clothing_item_style_tags`
- Sets up Row Level Security (RLS) policies for data protection
- Creates optimized database functions for clothing item retrieval
- Includes storage policies for image uploads
- **NEW**: Now includes `gemini_cache` and `maintenance_logs` tables with optimized RLS policies
- **PERFORMANCE**: Addresses Auth RLS Initialization Plan and Multiple Permissive Policies issues

**Tables Created**:
- `clothing_items` - User's clothing with images and metadata
- `categories` - Clothing categories (shirts, pants, etc.)
- `style_tags` - Style descriptors (casual, formal, etc.)
- `clothing_item_style_tags` - Many-to-many relationships
- `gemini_cache` - AI response caching (NEW)
- `maintenance_logs` - System maintenance tracking (NEW)

**Functions Created**:
- `get_user_clothing_items_with_tags(user_uuid UUID)` - Optimized clothing retrieval
- `get_user_clothing_items_by_style(user_uuid UUID, style_tag_id INTEGER)` - Style-filtered retrieval
- `cleanup_old_cache(age_interval TEXT)` - Basic cache cleanup
- `smart_cache_cleanup(max_cache_size_mb, min_age_days, max_age_days)` - Intelligent cache management

---

### 2. `setup-caching-system.sql` (Complete Caching Setup)
**Purpose**: Comprehensive setup for the AI caching system

**Key Features**:
- Creates `gemini_cache` table for storing AI responses
- Creates `maintenance_logs` table for tracking operations
- Sets up RLS policies for security
- Includes cleanup functions for cache management
- Provides verification and testing steps

**Use Case**: Run this if you only need the caching system without the main database tables

**Cache Table Structure**:
```sql
gemini_cache (
  id BIGINT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  request_hash TEXT UNIQUE,
  request_data JSONB,
  gemini_response JSONB,
  created_at TIMESTAMPTZ,
  last_accessed_at TIMESTAMPTZ,
  access_count INTEGER
)
```

---

### 3. `gemini-cache-schema.sql` (Cache Table Only)
**Purpose**: Creates only the gemini_cache table with basic policies

**Key Features**:
- Minimal cache table setup
- Basic RLS policies
- Essential indexes for performance
- Table and column comments for documentation

**Use Case**: Quick cache table setup without cleanup functions

---

### 4. `cleanup-old-cache.sql` (Advanced Cleanup Functions)
**Purpose**: Sophisticated cache management with smart cleanup algorithms

**Key Features**:
- **Basic Cleanup**: `cleanup_old_cache(age_interval)` - Removes entries older than specified time
- **Smart Cleanup**: `smart_cache_cleanup()` - Considers usage patterns and cache size
- **Maintenance Logs**: Tracks all cleanup operations
- **pg_cron Integration**: Includes cron job setup (commented out)

**Smart Cleanup Algorithm**:
1. Calculates current cache size in MB
2. Removes all entries older than max_age_days
3. If still over size limit, removes less frequently accessed items
4. Uses access score: `access_count / days_since_creation`
5. Preserves frequently accessed items (access_score >= 5)

---

### 5. `configure-cron-jobs.sql` (Automated Cleanup Scheduling)
**Purpose**: Sets up automated cleanup jobs using pg_cron extension

**Key Features**:
- **Daily Smart Cleanup**: Runs at 3 AM UTC daily
- **Weekly Basic Cleanup**: Backup job runs at 4 AM UTC on Sundays
- **Job Management**: Includes job removal and monitoring queries
- **Compatibility Check**: Verifies pg_cron extension availability

**Scheduled Jobs**:
- `daily-smart-cache-cleanup`: `smart_cache_cleanup(100, 7, 30)`
- `weekly-basic-cache-cleanup`: `cleanup_old_cache('21 days')`

**Important Note**: Requires pg_cron extension (not available on all Supabase tiers)

---

### 6. `fix-cleanup-functions.sql` (Bug Fixes)
**Purpose**: Fixes syntax errors in cleanup functions

**Key Features**:
- Fixes "aggregate functions are not allowed in RETURNING" error
- Uses `GET DIAGNOSTICS` instead of `RETURNING COUNT(*)`
- Includes function testing
- Provides success confirmation messages

**Fixed Issues**:
- Proper row count retrieval using `GET DIAGNOSTICS deleted_count = ROW_COUNT`
- Fixed syntax error: `GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT` (invalid)
- Now uses temporary variable: `GET DIAGNOSTICS temp_count = ROW_COUNT; deleted_count := deleted_count + temp_count;`
- Simplified smart cleanup logic
- Added batch size limits for performance

---

### 7. `fix-existing-policies.sql` (Policy Conflict Resolution)
**Purpose**: Resolves RLS policy conflicts during setup

**Key Features**:
- Drops existing policies to avoid "policy already exists" errors
- Recreates policies with proper permissions
- Includes policy verification queries
- Provides success confirmation

**Policies Fixed**:
- `"Users can view their own cached results"` - User data access
- `"Service role can manage all cache entries"` - Admin access

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

### Caching System Architecture
```
User Request → Hash Generation → Cache Lookup
    ↓                              ↓
Gemini API ←→ gemini_cache → maintenance_logs
    ↓                              ↓
Response Storage → Cleanup Jobs → Performance Monitoring
```

### Security Model
- **Row Level Security (RLS)** enabled on all tables
- **User Isolation**: Users can only access their own data
- **Service Role Access**: Admin functions for maintenance
- **Optimized Auth Calls**: Uses `(SELECT auth.uid())` pattern for performance

## Performance Optimizations

### Indexes Created
- `idx_gemini_cache_request_hash` - Fast cache lookups
- `idx_gemini_cache_user_id` - User-specific queries
- `idx_gemini_cache_created_at` - Time-based cleanup
- `idx_gemini_cache_last_accessed_at` - Access pattern analysis

### RLS Policy Optimizations
- **Single Comprehensive Policies**: Avoids multiple permissive policies performance issue
- **Cached Auth Calls**: Uses `(SELECT auth.uid())` to prevent re-evaluation per row
- **Role-Based Access**: Efficient service role detection

## Deployment Strategy

### Option 1: Complete Setup (Recommended)
1. Run `complete-database-setup.sql` in Supabase SQL Editor
2. This includes everything: core tables + caching system + optimizations

### Option 2: Modular Setup
1. Run `complete-database-setup.sql` for core tables
2. Run `setup-caching-system.sql` for caching (if not already included)
3. Run `configure-cron-jobs.sql` for automated cleanup (if pg_cron available)

### Option 3: Minimal Caching Only
1. Run `gemini-cache-schema.sql` for basic cache table
2. Run `cleanup-old-cache.sql` for cleanup functions
3. Manually run cleanup as needed

## Maintenance and Monitoring

### Manual Cleanup Commands
```sql
-- Basic cleanup (remove entries older than 14 days)
SELECT cleanup_old_cache('14 days');

-- Smart cleanup (100MB max, 7-30 day range)
SELECT smart_cache_cleanup(100, 7, 30);
```

### Monitoring Queries
```sql
-- Check cache size and entry count
SELECT 
  COUNT(*) as total_entries,
  SUM(pg_column_size(gemini_response) + pg_column_size(request_data)) / 1024 / 1024 as size_mb
FROM gemini_cache;

-- View recent maintenance operations
SELECT * FROM maintenance_logs ORDER BY executed_at DESC LIMIT 10;
```

## Troubleshooting

### Common Issues and Solutions

1. **"Policy already exists" error**
   - Run `fix-existing-policies.sql`

2. **"Aggregate functions not allowed in RETURNING" error**
   - Run `fix-cleanup-functions.sql`

3. **"Schema cron does not exist" error**
   - pg_cron extension not available
   - Use manual cleanup or alternative scheduling

4. **Performance issues with RLS policies**
   - Already fixed in `complete-database-setup.sql`
   - Uses optimized auth patterns

5. **UUID parameter mismatch errors**
   - Already fixed in client code
   - Functions use `user_uuid` parameter naming

## Environment Variables Required

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# AI Configuration
GEMINI_API_KEY=your_gemini_api_key

# Environment
NODE_ENV=production
```

## Next Steps After Database Setup

1. **Deploy Vercel Functions**: Ensure API endpoints are working
2. **Test Caching System**: Verify cache storage and retrieval
3. **Set Up Monitoring**: Track cache performance and cleanup operations
4. **Configure Automated Cleanup**: Set up cron jobs or manual schedules
5. **Performance Testing**: Monitor query performance and optimize as needed

---

*This documentation covers all SQL files as of the latest update. The main `complete-database-setup.sql` file now includes all necessary components for a fully functional FitMatch database with AI caching capabilities.*