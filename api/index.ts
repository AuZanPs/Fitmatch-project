import { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,OPTIONS,PATCH,DELETE,POST,PUT",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization",
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method === "GET") {
    // Check if health check is requested
    const isHealthCheck = req.url?.includes('health') || req.query.health === 'true';
    
    if (isHealthCheck) {
      return res.status(200).json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || "development",
        version: "1.0.0",
        services: {
          gemini: {
            configured: !!process.env.GEMINI_API_KEY,
            keyLength: process.env.GEMINI_API_KEY?.length || 0,
            keyPrefix: process.env.GEMINI_API_KEY?.substring(0, 5) || "none",
          },
          supabase: {
            url_configured: !!process.env.SUPABASE_URL,
            service_key_configured: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
            url_prefix: process.env.SUPABASE_URL?.substring(0, 20) || "none",
          },
          vercel: {
            url_configured: !!process.env.VERCEL_URL,
            url: process.env.VERCEL_URL || "none",
          },
          maintenance: {
            secret_configured: !!process.env.MAINTENANCE_SECRET_KEY,
          },
        },
        deployment_info: {
          vercel_url: process.env.VERCEL_URL,
          region: process.env.VERCEL_REGION,
          git_commit_sha: process.env.VERCEL_GIT_COMMIT_SHA,
        },
      });
    }
    
    return res.status(200).json({
      message: "FitMatch API is running on Vercel with Gemini AI",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "production",
      aiProvider: "Gemini",
      available_endpoints: [
        "POST /api/generate-outfits",
        "POST /api/wardrobe-analysis",
        "POST /api/analyze-item",
        "GET /api/?health=true - Health check",
      ],
    });
  }

  res.status(404).json({ error: "API endpoint not found" });
}
