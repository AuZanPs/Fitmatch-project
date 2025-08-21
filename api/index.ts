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
    return res.status(200).json({
      message: "FitMatch API is running on Vercel with Gemini AI",
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "production",
      aiProvider: "Gemini",
      available_endpoints: [
        "POST /api/generate-outfits",
        "POST /api/styling-advice",
        "POST /api/wardrobe-analysis",
        "POST /api/analyze-item",
      ],
    });
  }

  res.status(404).json({ error: "API endpoint not found" });
}
