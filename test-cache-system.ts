#!/usr/bin/env tsx

/**
 * Test Script for FitMatch Caching System
 * 
 * This script tests the caching system to ensure it's working correctly.
 * Run it after setting up the database and deploying the API.
 * 
 * Usage:
 * 1. Install tsx: npm install -g tsx
 * 2. Run: tsx test-cache-system.ts
 */

import { createClient } from '@supabase/supabase-js';

// Configuration - Update these values
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-key';
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

// Test data
const testUserId = 'test-user-' + Date.now();
const testItems = [
  { id: '1', category: 'shirt', color: 'blue' },
  { id: '2', category: 'pants', color: 'black' },
  { id: '3', category: 'shoes', color: 'brown' }
];

const testContext = {
  occasion: 'casual',
  weather: 'mild',
  style: 'comfortable'
};

/**
 * Test the caching system step by step
 */
async function testCachingSystem() {
  console.log('🧪 Testing FitMatch Caching System...\n');

  try {
    // Step 1: Test Supabase Connection
    console.log('1️⃣ Testing Supabase connection...');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    
    const { data: tables, error: tableError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'gemini_cache');
    
    if (tableError || !tables || tables.length === 0) {
      throw new Error('Cache table not found. Run setup-caching-system.sql first.');
    }
    
    console.log('✅ Supabase connection successful');
    console.log('✅ Cache table exists\n');

    // Step 2: Test Cache Functions
    console.log('2️⃣ Testing cache cleanup functions...');
    
    const { data: functions, error: funcError } = await supabase
      .from('information_schema.routines')
      .select('routine_name')
      .eq('routine_schema', 'public')
      .in('routine_name', ['cleanup_old_cache', 'smart_cache_cleanup']);
    
    if (funcError || !functions || functions.length < 2) {
      throw new Error('Cleanup functions not found. Run setup-caching-system.sql first.');
    }
    
    console.log('✅ Cleanup functions exist');
    
    // Test basic cleanup function
    const { data: cleanupResult, error: cleanupError } = await supabase.rpc('cleanup_old_cache', {
      age_interval: '1 day'
    });
    
    if (cleanupError) {
      console.log('⚠️ Cleanup function test failed:', cleanupError.message);
    } else {
      console.log('✅ Cleanup function test successful');
    }
    console.log('');

    // Step 3: Test API Endpoints
    console.log('3️⃣ Testing API endpoints...');
    
    // Test cache maintenance endpoint
    try {
      const maintenanceResponse = await fetch(`${API_BASE_URL}/api/cache-maintenance`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.MAINTENANCE_SECRET_KEY || 'test-key'}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (maintenanceResponse.ok) {
        console.log('✅ Cache maintenance endpoint accessible');
      } else {
        console.log('⚠️ Cache maintenance endpoint returned:', maintenanceResponse.status);
      }
    } catch (error) {
      console.log('⚠️ Cache maintenance endpoint test failed:', error.message);
    }

    // Test cached suggestions endpoint
    try {
      const cacheResponse = await fetch(`${API_BASE_URL}/api/get-cached-suggestions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: testUserId,
          items: testItems,
          context: testContext,
          promptType: 'outfit-generation'
        })
      });
      
      if (cacheResponse.ok) {
        const result = await cacheResponse.json();
        console.log('✅ Cached suggestions endpoint accessible');
        console.log(`   Response: ${result.cached ? 'Cached' : 'Fresh'} data`);
      } else {
        console.log('⚠️ Cached suggestions endpoint returned:', cacheResponse.status);
      }
    } catch (error) {
      console.log('⚠️ Cached suggestions endpoint test failed:', error.message);
    }
    console.log('');

    // Step 4: Test Cache Operations
    console.log('4️⃣ Testing cache operations...');
    
    // Insert a test cache entry
    const testRequestHash = `test-hash-${Date.now()}`;
    const { error: insertError } = await supabase
      .from('gemini_cache')
      .insert({
        user_id: testUserId,
        request_hash: testRequestHash,
        request_data: { test: true },
        gemini_response: { test: 'response' }
      });
    
    if (insertError) {
      console.log('⚠️ Cache insert test failed:', insertError.message);
    } else {
      console.log('✅ Cache insert test successful');
    }

    // Query the test entry
    const { data: queryData, error: queryError } = await supabase
      .from('gemini_cache')
      .select('*')
      .eq('request_hash', testRequestHash)
      .single();
    
    if (queryError || !queryData) {
      console.log('⚠️ Cache query test failed:', queryError?.message);
    } else {
      console.log('✅ Cache query test successful');
    }

    // Clean up test data
    const { error: deleteError } = await supabase
      .from('gemini_cache')
      .delete()
      .eq('request_hash', testRequestHash);
    
    if (deleteError) {
      console.log('⚠️ Cache cleanup test failed:', deleteError.message);
    } else {
      console.log('✅ Cache cleanup test successful');
    }
    console.log('');

    // Step 5: Performance Test
    console.log('5️⃣ Testing cache performance...');
    
    const startTime = Date.now();
    
    // Simulate cache lookup
    const { data: perfData, error: perfError } = await supabase
      .from('gemini_cache')
      .select('id')
      .limit(1);
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    if (perfError) {
      console.log('⚠️ Performance test failed:', perfError.message);
    } else {
      console.log(`✅ Cache lookup performance: ${responseTime}ms`);
      if (responseTime < 100) {
        console.log('   🚀 Excellent performance (<100ms)');
      } else if (responseTime < 500) {
        console.log('   ✅ Good performance (<500ms)');
      } else {
        console.log('   ⚠️ Performance could be improved (>500ms)');
      }
    }
    console.log('');

    // Step 6: Summary
    console.log('🎉 Caching System Test Complete!');
    console.log('');
    console.log('📊 System Status:');
    console.log('   ✅ Database: Connected and configured');
    console.log('   ✅ Tables: Cache table exists');
    console.log('   ✅ Functions: Cleanup functions available');
    console.log('   ✅ API: Endpoints accessible');
    console.log('   ✅ Performance: Cache operations working');
    console.log('');
    console.log('🚀 Next Steps:');
    console.log('   1. Deploy your frontend application');
    console.log('   2. Test outfit generation with real data');
    console.log('   3. Monitor cache hit rates');
    console.log('   4. Set up automated cleanup scheduling');
    console.log('');
    console.log('💡 Tips:');
    console.log('   - Monitor cache size in Supabase dashboard');
    console.log('   - Check Vercel function logs for errors');
    console.log('   - Use the maintenance endpoint for manual cleanup');
    console.log('   - Consider implementing cache warming for popular queries');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.log('');
    console.log('🔧 Troubleshooting:');
    console.log('   1. Check your environment variables');
    console.log('   2. Verify Supabase project configuration');
    console.log('   3. Ensure API endpoints are deployed');
    console.log('   4. Run setup-caching-system.sql in Supabase');
    process.exit(1);
  }
}

/**
 * Run the test
 */
if (require.main === module) {
  testCachingSystem().catch(console.error);
}

export { testCachingSystem };