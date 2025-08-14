import { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Import your existing route handlers
import { handleDemo } from '../server/routes/demo';
import { handleHealthCheck } from '../server/routes/health';
import { 
  handleGenerateOutfits, 
  handleStylingAdvice, 
  handleAnalyzeItem, 
  handleWardrobeAnalysis 
} from '../server/routes/ai-stylist';
import { rateLimit } from '../server/middleware/validation';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();

// CORS configuration for Vercel
const corsOptions = {
  origin: [
    'http://localhost:8080',
    'http://localhost:3000',
    'http://localhost:5173',
    /\.vercel\.app$/,
    process.env.FRONTEND_URL
  ].filter(origin => origin !== undefined),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// API Routes
app.get('/api/ping', (req, res) => {
  res.json({ 
    message: 'FitMatch API is running on Vercel',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

app.get('/api/health', handleHealthCheck);
app.get('/api/demo', handleDemo);

// AI Stylist routes with rate limiting
app.post('/api/ai-stylist/generate-outfits', rateLimit(10, 60000), handleGenerateOutfits); // 10 requests per minute
app.post('/api/ai-stylist/styling-advice', rateLimit(15, 60000), handleStylingAdvice); // 15 requests per minute
app.post('/api/ai-stylist/analyze-item', rateLimit(20, 60000), handleAnalyzeItem); // 20 requests per minute
app.post('/api/ai-stylist/wardrobe-analysis', rateLimit(10, 60000), handleWardrobeAnalysis); // 10 requests per minute

// Handle 404 for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

// Export for Vercel
export default (req: VercelRequest, res: VercelResponse) => {
  return app(req, res);
};
