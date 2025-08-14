import { z } from 'zod';
import { RequestHandler } from 'express';

// Input validation schemas
export const outfitGenerationSchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    category: z.string(),
    color: z.string(),
    brand: z.string().optional(),
    image_url: z.string().url().optional()
  })).min(3, 'At least 3 items required'),
  preferences: z.object({
    occasion: z.string(),
    weather: z.string().optional(),
    style: z.string().optional()
  }),
  userProfile: z.object({
    age: z.number().optional(),
    gender: z.string().optional(),
    style_preference: z.string().optional()
  }).optional(),
  maxOutfits: z.number().min(1).max(5).default(1)
});

export const stylingAdviceSchema = z.object({
  query: z.string().min(1, 'Query is required').max(500, 'Query too long'),
  question: z.string().optional(), // Backward compatibility
  wardrobe: z.array(z.any()).optional(),
  userProfile: z.object({
    age: z.number().optional(),
    gender: z.string().optional(),
    style_preference: z.string().optional()
  }).optional(),
  preferences: z.object({
    occasion: z.string().optional(),
    weather: z.string().optional()
  }).optional()
});

export const itemAnalysisSchema = z.object({
  imageUrl: z.string().url('Valid image URL required'),
  existingData: z.object({
    category: z.string().optional(),
    color: z.string().optional(),
    brand: z.string().optional()
  }).optional()
});

export const wardrobeAnalysisSchema = z.object({
  wardrobe: z.array(z.any()).min(1, 'At least one item required'),
  preferences: z.object({
    focus: z.string().optional(),
    style_goals: z.array(z.string()).optional()
  }).optional()
});

// Validation middleware factory
export const validateBody = (schema: z.ZodSchema) => {
  const middleware: RequestHandler = (req, res, next) => {
    try {
      const validated = schema.parse(req.body);
      req.body = validated;
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: 'Validation failed',
          details: error.errors.map(err => ({
            field: err.path.join('.'),
            message: err.message
          }))
        });
      }
      return res.status(400).json({ error: 'Invalid request data' });
    }
  };
  return middleware;
};

// Rate limiting helper (basic implementation)
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export const rateLimit = (maxRequests: number, windowMs: number) => {
  const middleware: RequestHandler = (req, res, next) => {
    const clientId = req.ip || 'unknown';
    const now = Date.now();
    
    const clientData = rateLimitMap.get(clientId);
    
    if (!clientData || now > clientData.resetTime) {
      rateLimitMap.set(clientId, { count: 1, resetTime: now + windowMs });
      return next();
    }
    
    if (clientData.count >= maxRequests) {
      return res.status(429).json({ 
        error: 'Too many requests',
        message: 'Please try again later'
      });
    }
    
    clientData.count++;
    next();
  };
  return middleware;
};
