import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isGeminiConfigured } from '../shared/gemini';
import fetch from 'node-fetch';

interface OutfitRequest {
  userId: string; // New: User ID for cache association
  items: any[];
  preferences: {
    occasion?: string;
    weather?: string;
    style?: string;
    colors?: string[];
  };
  userProfile?: {
    style_inspiration?: string;
    lifestyle?: string;
  };
  maxOutfits?: number;
  bypassCache?: boolean; // New: Option to bypass cache
}

interface OutfitResponse {
  success: boolean;
  outfits?: {
    id: string;
    name: string;
    description: string;
    items: any[];
    occasion: string;
    weather: string;
    confidence: number;
    reasoning: string;
    styling_tips?: string[];
    color_analysis?: string;
    trend_insights?: string;
  }[];
  error?: string;
  rate_limited?: boolean;
  note?: string;
  cached?: boolean; // New: Indicate if response was cached
}

// Enhanced rate limiting
let requestCount = 0;
let lastReset = Date.now();

const checkRateLimit = (): boolean => {
  const now = Date.now();
  const hoursPassed = (now - lastReset) / (1000 * 60 * 60);
  
  if (hoursPassed >= 1) {
    requestCount = 0;
    lastReset = now;
  }
  
  if (requestCount >= 60) { // Optimized limit for better performance
    return false;
  }
  
  requestCount++;
  return true;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed. Use POST.' 
    });
  }

  const startTime = Date.now();

  try {
    const requestData: OutfitRequest = req.body;
    const { userId, items = [], preferences = {}, userProfile = {}, maxOutfits = 1, bypassCache = false } = requestData;

    // Validate input early
    if (!items || !Array.isArray(items) || items.length < 3) {
      return res.status(400).json({
        success: false,
        error: 'At least 3 clothing items are required to generate outfits'
      });
    }

    // Validate userId
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'A valid userId is required'
      });
    }

    // Check API key
    if (!isGeminiConfigured()) {
      console.log('⚠️ Gemini not configured, using smart fallback');
      
      // Use the same fallback as before
      return res.status(200).json({
        success: true,
        outfits: generateSmartFallbackOutfits(items, preferences, userProfile),
        note: 'Using smart recommendations - configure GEMINI_API_KEY for AI-powered suggestions'
      });
    }

    // Check rate limit
    if (!checkRateLimit()) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded. Please wait before generating more outfits.',
        rate_limited: true
      });
    }

    try {
      // Use the caching endpoint instead of direct Gemini API call
      const cacheResponse = await fetch(new URL('/api/get-cached-suggestions', process.env.VERCEL_URL || 'http://localhost:3000'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          items,
          context: {
            ...preferences,
            style_inspiration: userProfile.style_inspiration,
            lifestyle: userProfile.lifestyle
          },
          promptType: 'outfit-generation',
          forceRefresh: bypassCache
        })
      });

      if (!cacheResponse.ok) {
        throw new Error(`Cache service error: ${cacheResponse.status} ${await cacheResponse.text()}`);
      }

      const cacheResult = await cacheResponse.json();
      
      if (!cacheResult.success) {
        throw new Error(`Cache service error: ${cacheResult.error}`);
      }

      // Process the cached result
      let outfits;
      
      if (cacheResult.data && Array.isArray(cacheResult.data)) {
        // Direct array response
        outfits = cacheResult.data;
      } else if (cacheResult.data && cacheResult.data.rawResponse) {
        // Text response that needs parsing
        try {
          const jsonMatch = cacheResult.data.rawResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            outfits = [parsed]; // Wrap in array if single outfit
          } else {
            throw new Error('No valid JSON in response');
          }
        } catch (parseError) {
          console.error('Failed to parse cached response:', parseError);
          throw new Error('Invalid response format from cache');
        }
      } else {
        // Direct object response
        outfits = [cacheResult.data]; // Wrap in array if single outfit
      }

      const endTime = Date.now();
      console.log(`⚡ Outfit generation ${cacheResult.cached ? 'from cache' : 'fresh'} completed in ${endTime - startTime}ms`);

      return res.status(200).json({
        success: true,
        outfits,
        cached: cacheResult.cached
      });

    } catch (error) {
      console.error('Error using cache service:', error);
      
      // Fallback to smart recommendations
      return res.status(200).json({
        success: true,
        outfits: generateSmartFallbackOutfits(items, preferences, userProfile),
        note: 'Using fallback recommendations due to service unavailability'
      });
    }

  } catch (error) {
    const endTime = Date.now();
    console.error(`❌ Outfit generation failed in ${endTime - startTime}ms:`, error);
    
    return res.status(500).json({
      success: false,
      error: `Internal server error: ${error.message}`
    });
  }
}

// Generate fallback outfits when everything fails
function generateSmartFallbackOutfits(items, preferences, userProfile): any[] {
  // This is a placeholder - you should copy the existing fallback logic from generate-outfits.ts
  const occasion = preferences.occasion || userProfile.lifestyle || 'casual';
  const weather = preferences.weather || 'mild';
  const style = preferences.style || userProfile.style_inspiration || 'comfortable';
  
  return [{
    id: `fallback-outfit-${Date.now()}`,
    name: `${style.charAt(0).toUpperCase() + style.slice(1)} ${occasion.charAt(0).toUpperCase() + occasion.slice(1)} Look`,
    description: `A carefully curated ${style} outfit perfect for ${occasion} occasions in ${weather} weather.`,
    items: items.slice(0, 3), // Take first 3 items
    occasion,
    weather,
    confidence: 0.7,
    reasoning: "This outfit combines your items in a complementary way that's appropriate for the occasion.",
    styling_tips: [
      "Ensure all pieces fit well for the most polished look",
      "Consider adding accessories to complete the outfit"
    ],
    color_analysis: "The colors in this outfit create a balanced, cohesive look."
  }];
}