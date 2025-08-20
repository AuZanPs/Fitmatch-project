import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { generateWithGemini, buildFashionPrompt, buildOutfitGenerationPrompt, buildWardrobeAnalysisPrompt } from '../shared/gemini';
import crypto from 'crypto';

// Types
interface CacheRequest {
  userId: string;
  items: any[];
  context: {
    occasion?: string;
    weather?: string;
    style?: string;
    colors?: string[];
    [key: string]: any;
  };
  promptType: 'outfit-generation' | 'wardrobe-analysis' | 'styling-advice';
  forceRefresh?: boolean;
}

interface CacheResponse {
  success: boolean;
  cached: boolean;
  data: any;
  error?: string;
}

/**
 * Get cached suggestions or generate new ones
 * This function provides an abstraction over Gemini API calls with database caching
 */
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
    const requestData: CacheRequest = req.body;
    const { userId, items = [], context = {}, promptType, forceRefresh = false } = requestData;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'userId is required'
      });
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return res.status(500).json({
        success: false,
        error: 'Supabase configuration missing'
      });
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate request hash from the combination of user's items, context, and prompt type
    const requestHash = generateRequestHash(userId, items, context, promptType);
    
    // Check if we should bypass cache
    if (!forceRefresh) {
      // Check cache for existing response
      const { data: cachedData, error: cacheError } = await supabase
        .from('gemini_cache')
        .select('gemini_response, access_count')
        .eq('request_hash', requestHash)
        .eq('user_id', userId)
        .single();
        
      if (cacheError && !cacheError.message.includes('No rows found')) {
        console.error('Cache lookup error:', cacheError);
      }
      
      // If we have a cache hit, update access stats and return the cached response
      if (cachedData) {
        console.log(`🔄 Cache hit for ${promptType} (request_hash: ${requestHash.substring(0, 8)}...)`);
        
        // Update access count and last_accessed_at asynchronously (don't wait for it)
        try {
          const updatePromise = supabase
            .from('gemini_cache')
            .update({
              last_accessed_at: new Date().toISOString(),
              access_count: cachedData.access_count + 1
            })
            .eq('request_hash', requestHash);
            
          updatePromise.then(() => {
            console.log(`✅ Updated cache access stats for ${requestHash.substring(0, 8)}...`);
          });
        } catch (err) {
          console.error('Failed to update cache access stats:', err);
        }
          
        const responseTime = Date.now() - startTime;
        console.log(`⚡ Cache response served in ${responseTime}ms`);
        
        return res.status(200).json({
          success: true,
          cached: true,
          data: cachedData.gemini_response
        });
      }
    } else {
      console.log(`🔄 Cache bypass requested for ${promptType}`);
    }
    
    // If we get here, we need to generate a new response from Gemini
    console.log(`🤖 Cache miss for ${promptType}, calling Gemini API...`);
    
    // Generate the appropriate prompt based on the prompt type
    let prompt: string;
    let geminiOptions = { temperature: 0.7, maxOutputTokens: 1500 };
    
    switch (promptType) {
      case 'outfit-generation':
        prompt = buildOutfitGenerationPrompt(
          items, 
          context.occasion || 'casual', 
          context.weather || 'mild', 
          context.style || 'comfortable'
        );
        break;
        
      case 'wardrobe-analysis':
        prompt = buildWardrobeAnalysisPrompt(items, context);
        geminiOptions.maxOutputTokens = 2000; // Wardrobe analysis needs more tokens
        break;
        
      case 'styling-advice':
        prompt = buildFashionPrompt(
          context.question || 'Provide styling advice', 
          { wardrobe: items, ...context }
        );
        break;
        
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid promptType specified'
        });
    }
    
    // Call Gemini API
    try {
      const geminiResponse = await generateWithGemini(prompt, {
        ...geminiOptions,
        useCache: false // Disable in-memory cache since we're implementing our own
      });
      
      // Process the response based on prompt type
      let processedResponse;
      
      if (promptType === 'outfit-generation') {
        // Extract JSON from response
        const jsonMatch = geminiResponse.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            processedResponse = JSON.parse(jsonMatch[0]);
          } catch (parseError) {
            console.error('Failed to parse JSON from Gemini response:', parseError);
            processedResponse = { rawResponse: geminiResponse };
          }
        } else {
          processedResponse = { rawResponse: geminiResponse };
        }
      } else {
        // For other prompt types, just use the text response
        processedResponse = { rawResponse: geminiResponse };
      }
      
      // Store in cache
      const { error: insertError } = await supabase
        .from('gemini_cache')
        .insert({
          user_id: userId,
          request_hash: requestHash,
          request_data: {
            promptType,
            itemCount: items.length,
            context
          },
          gemini_response: processedResponse
        });
        
      if (insertError) {
        console.error('Failed to cache Gemini response:', insertError);
      } else {
        console.log(`✅ Cached response for ${promptType} (request_hash: ${requestHash.substring(0, 8)}...)`);
      }
      
      const responseTime = Date.now() - startTime;
      console.log(`⚡ Gemini response generated and cached in ${responseTime}ms`);
      
      return res.status(200).json({
        success: true,
        cached: false,
        data: processedResponse
      });
      
    } catch (geminiError) {
      console.error('Gemini API error:', geminiError);
      return res.status(500).json({
        success: false,
        cached: false,
        error: `Failed to generate content with Gemini: ${geminiError.message}`
      });
    }
    
  } catch (error) {
    console.error('Cache service error:', error);
    return res.status(500).json({
      success: false,
      error: `Cache service error: ${error.message}`
    });
  }
}

/**
 * Generates a deterministic hash from the request parameters
 */
function generateRequestHash(
  userId: string, 
  items: any[], 
  context: any, 
  promptType: string
): string {
  // Create a sorted array of item IDs to ensure consistency
  const itemIds = items.map(item => item.id).sort();
  
  // Create a sorted string representation of the context
  const contextStr = JSON.stringify(
    Object.entries(context)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {})
  );
  
  // Combine all elements to create a unique but deterministic string
  const hashInput = `${userId}:${promptType}:${itemIds.join(',')}:${contextStr}`;
  
  // Generate SHA-256 hash
  return crypto
    .createHash('sha256')
    .update(hashInput)
    .digest('hex');
}