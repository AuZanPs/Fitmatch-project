import "dotenv/config";
import dotenv from "dotenv";
import { join } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import express from "express";
import cors from "cors";
import { handleDemo } from "./routes/demo";
import { handleHealthCheck } from "./routes/health";
import { 
  handleGenerateOutfits, 
  handleStylingAdvice, 
  handleAnalyzeItem, 
  handleWardrobeAnalysis 
} from "./routes/ai-stylist";
import { rateLimit } from "./middleware/validation";

// Load server-specific environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Force load from server/.env directory
const envPath = join(process.cwd(), 'server', '.env');
const envResult = dotenv.config({ path: envPath });

export function createServer() {
  const app = express();

  // Security headers
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    next();
  });

  app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
      ? [
          /\.vercel\.app$/, // Allow any Vercel app domain
          'http://localhost:3000', // Local development
          'http://localhost:5173'  // Vite dev server
        ]
      : true,
    credentials: true
  }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.get("/api/ping", (_req, res) => {
    res.json({ message: "pong" });
  });

  app.get("/api/health", handleHealthCheck);
  app.get("/api/demo", handleDemo);

  // AI API routes with rate limiting (10 requests per minute)
  app.post("/api/ai-stylist/generate-outfits", rateLimit(10, 60000), handleGenerateOutfits);
  app.post("/api/ai-stylist/styling-advice", rateLimit(15, 60000), handleStylingAdvice);
  app.post("/api/ai-stylist/analyze-item", rateLimit(20, 60000), handleAnalyzeItem);
  app.post("/api/ai-stylist/wardrobe-analysis", rateLimit(10, 60000), handleWardrobeAnalysis);
  
  return app;
}
