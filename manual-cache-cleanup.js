/**
 * Manual Cache Cleanup Script
 * 
 * This script can be used to manually trigger the cache cleanup endpoint.
 * Run it with Node.js when you need to clean up the cache outside of scheduled times.
 * 
 * Usage:
 *   node manual-cache-cleanup.js [environment]
 * 
 * Example:
 *   node manual-cache-cleanup.js production
 *   node manual-cache-cleanup.js development
 */

const fetch = require('node-fetch');
require('dotenv').config();

// Configuration
const config = {
  development: {
    url: 'http://localhost:3000/api/cache-maintenance',
    secretKey: process.env.MAINTENANCE_SECRET_KEY || 'dev-secret-key'
  },
  production: {
    url: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}/api/cache-maintenance` : 'https://your-app-url.vercel.app/api/cache-maintenance',
    secretKey: process.env.MAINTENANCE_SECRET_KEY
  }
};

async function runCacheCleanup() {
  // Determine environment
  const env = process.argv[2] || 'development';
  if (!['development', 'production'].includes(env)) {
    console.error('Invalid environment. Use "development" or "production"');
    process.exit(1);
  }
  
  const { url, secretKey } = config[env];
  
  if (!secretKey) {
    console.error('MAINTENANCE_SECRET_KEY is not defined in environment variables');
    process.exit(1);
  }
  
  console.log(`Running cache cleanup in ${env} environment...`);
  console.log(`URL: ${url}`);
  
  try {
    const startTime = Date.now();
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${secretKey}`
      }
    });
    
    const result = await response.json();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`\nCache cleanup completed in ${duration} seconds\n`);
    
    if (response.ok) {
      console.log('✅ Cleanup successful!');
      console.log('Timestamp:', result.timestamp);
      
      if (result.basicCleanupResult) {
        console.log(`Basic cleanup: Removed ${result.basicCleanupResult.deletedEntries || 0} old entries`);
      }
      
      if (result.smartCleanupResult) {
        if (result.smartCleanupResult.error) {
          console.log(`Smart cleanup: Failed - ${result.smartCleanupResult.error}`);
        } else {
          console.log(`Smart cleanup: Removed ${result.smartCleanupResult.additionalDeletedEntries || 0} additional entries`);
        }
      }
      
      if (result.currentCacheStats) {
        console.log('\nCurrent cache statistics:');
        console.log(`Entries: ${result.currentCacheStats.entryCount}`);
        console.log(`Size: ${result.currentCacheStats.estimatedSize}`);
      }
    } else {
      console.error('❌ Cleanup failed!');
      console.error('Status:', response.status);
      console.error('Error:', result.error || 'Unknown error');
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
  }
}

runCacheCleanup().catch(err => {
  console.error('Unhandled error:', err);
  process.exit(1);
});