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
  handleItemAnalysis, 
  handleWardrobeAnalysis 
} from "./routes/ai-stylist";
import { rateLimit } from "./middleware/validation";

// Load server-specific environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Force load from server/.env directory
const envPath = join(process.cwd(), 'server', '.env');
const envResult = dotenv.config({ path: envPath });

// Also load from root .env.local as fallback
const rootEnvPath = join(process.cwd(), '.env.local');
dotenv.config({ path: rootEnvPath });

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

  // AI API routes with generous rate limiting for development
  app.post("/api/generate-outfits", rateLimit(100, 60000), handleGenerateOutfits);
  app.post("/api/styling-advice", rateLimit(100, 60000), handleStylingAdvice);
  app.post("/api/analyze-item", rateLimit(100, 60000), handleItemAnalysis);
  app.post("/api/wardrobe-analysis", rateLimit(100, 60000), handleWardrobeAnalysis);
  
  return app;
}

// Start the development server
const app = createServer();
const port = process.env.PORT || 3001;

app.listen(port, () => {
  console.log(`🚀 Express server running on http://localhost:${port}`);
  console.log(`📡 API endpoints available at http://localhost:${port}/api/*`);
  console.log(`🎯 Frontend running on http://localhost:8080`);
});
