# Vercel Deployment Guide

## Environment Variables Setup

The FUNCTION_INVOCATION_FAILED error is typically caused by missing environment variables in your Vercel deployment. Here are all the required environment variables that need to be configured in your Vercel dashboard:

### Required Environment Variables

1. **GEMINI_API_KEY**
   - Get from: https://aistudio.google.com/app/apikey
   - Required for AI outfit generation
   - Example: `AIzaSyC...` (starts with AIzaSy)

2. **SUPABASE_URL**
   - Your Supabase project URL for API functions (server-side)
   - Found in: Supabase Dashboard > Settings > API
   - Example: `https://your-project.supabase.co`
   - **Note**: This is different from `VITE_SUPABASE_URL` used by the client

3. **SUPABASE_SERVICE_ROLE_KEY**
   - Your Supabase service role key (secret key)
   - Found in: Supabase Dashboard > Settings > API
   - **Important**: Use the service_role key, NOT the anon key
   - Example: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`



### Client vs Server Environment Variables

**Important**: The client and server use different Supabase environment variables:
- **Client** (browser): `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- **Server** (API functions): `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`

Both sets are required for full functionality.

### How to Set Environment Variables in Vercel

1. Go to your Vercel dashboard
2. Select your project
3. Go to Settings > Environment Variables
4. Add each variable:
   - **Key**: Variable name (e.g., `GEMINI_API_KEY`)
   - **Value**: Your actual key/URL
   - **Environments**: Select Production, Preview, and Development

### Vercel Configuration

The `vercel.json` file has been updated to include all API functions with proper memory and timeout settings:

```json
{
  "functions": {

    "api/generate-outfits.ts": {
      "memory": 1024,
      "maxDuration": 15
    },
    "api/analyze-item.ts": {
      "memory": 512,
      "maxDuration": 10
    },
    "api/wardrobe-analysis.ts": {
      "memory": 1024,
      "maxDuration": 15
    },
    "api/health.ts": {
      "memory": 256,
      "maxDuration": 5
    }
  }
}
```

### Troubleshooting Steps

1. **Check Environment Variables**:
   - Visit `/api/health` on your deployed site
   - It will show which environment variables are configured

2. **Redeploy After Setting Variables**:
   - After adding environment variables, trigger a new deployment
   - You can do this by pushing a new commit or manually redeploying

3. **Check Function Logs**:
   - Go to Vercel Dashboard > Functions tab
   - Click on the failing function to see detailed logs

4. **Verify Supabase Connection**:
   - Make sure your Supabase project is active
   - Verify the URL and service role key are correct
   - Check that your database has the required tables

### Security Vulnerabilities

The project currently has 3 npm security vulnerabilities:

- **esbuild** (moderate): Development server vulnerability - affects local development only
- **path-to-regexp** (high): Backtracking regex vulnerability in @vercel/node dependency

These vulnerabilities are in dependencies of `@vercel/node` and cannot be automatically fixed. They primarily affect:
- Local development environment (esbuild)
- Vercel's internal routing (path-to-regexp)

**Mitigation**:
- Vulnerabilities don't affect production runtime security
- Monitor for updates to `@vercel/node` package
- Consider using `npm audit --production` to check production-only dependencies

### Vercel Configuration Updates

**Memory Settings Removed**: The `memory` settings have been removed from `vercel.json` as they are ignored on Active CPU billing plans. Functions now use Vercel's automatic memory allocation.

**Shared Module Structure**: The `shared` folder is located at the project root to avoid Vercel treating shared modules as serverless functions. API functions use relative imports (`../shared/module`) to access shared utilities.

### Common Issues

- **Wrong Supabase Key**: Make sure you're using the `service_role` key, not the `anon` key
- **Missing GEMINI_API_KEY**: The app will fall back to basic recommendations without AI
- **Incorrect SUPABASE_URL**: Should include `https://` and end with `.supabase.co`
- **Function Timeout**: Large requests might need longer timeout (already configured)
- **Module not found errors**: If you see `Cannot find module '/var/task/shared/...'` errors, ensure shared modules are in the project root `shared/` directory and use relative imports (`../shared/module`) from API functions. Vercel doesn't support TypeScript path mappings in serverless functions

### Testing the Deployment

1. **Check Health Endpoint First**:
   - Visit `https://your-app.vercel.app/api/health`
   - This will show you which environment variables are configured
   - All services should show `configured: true`

2. **Expected Health Response**:
   ```json
   {
     "status": "healthy",
     "services": {
       "gemini": {
         "configured": true,
         "keyLength": 39,
         "keyPrefix": "AIzaS"
       },
       "supabase": {
         "url_configured": true,
         "service_key_configured": true,
         "url_prefix": "https://your-project"
       },
       "vercel": {
         "url_configured": true,
         "url": "your-app.vercel.app"
       }
     }
   }
   ```

3. **Test AI Features**:
   - Visit your deployed site
   - Try using the AI outfit generation feature
   - Check the browser console for any errors

### Fixing FUNCTION_INVOCATION_FAILED Error

This error typically occurs when:

1. **Missing Environment Variables**:
   - Check `/api/health` to see which variables are missing
   - Add them in Vercel Dashboard > Settings > Environment Variables
   - Redeploy after adding variables

2. **Wrong Supabase Configuration**:
   - Ensure you're using the `service_role` key, not `anon` key
   - Verify the SUPABASE_URL is correct

3. **Function Timeout**:
   - The `vercel.json` has been updated with proper timeouts
   - Large requests should now work within the 15-second limit

4. **Internal API Call Issues**:
   - Fixed URL construction issues in the code
   - Functions now properly call each other on Vercel

### Debugging Steps

1. **Check Function Logs**:
   - Go to Vercel Dashboard > Functions tab
   - Click on the failing function to see detailed logs
   - Look for specific error messages

2. **Test Individual Endpoints**:
   - `/api/health` - Check environment variables
   - `/api/generate-outfits` - Test AI generation


3. **Common Error Messages**:
   - `"Gemini not configured"` → Add GEMINI_API_KEY
   - `"Supabase client initialization failed"` → Check Supabase variables


If you continue to experience issues, check the Vercel function logs for specific error messages and compare with the health endpoint output.