import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Load server-specific environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Force load environment variables from server/.env
const envPath = join(process.cwd(), 'server', '.env');
const envResult = dotenv.config({ path: envPath });

// Validate critical environment variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY is not found in server environment variables. AI features will not work.');
  console.error('Please check that server/.env exists and contains: GEMINI_API_KEY=your-api-key');
}

// Initialize Gemini AI with validation
const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

// Gemini models (only initialize if API key is available) - Using latest 2.5 Flash model with enhanced config
const visionModel = genAI?.getGenerativeModel({ 
  model: 'gemini-2.5-flash-latest',
  generationConfig: {
    temperature: 0.7,
    topP: 0.8,
    topK: 40,
    maxOutputTokens: 8192,
  }
});
const textModel = genAI?.getGenerativeModel({ 
  model: 'gemini-2.5-flash-latest',
  generationConfig: {
    temperature: 0.8,
    topP: 0.9,
    topK: 40,
    maxOutputTokens: 8192,
  }
});

// Fast model specifically for outfit generation with optimized settings
const fastOutfitModel = genAI?.getGenerativeModel({ 
  model: 'gemini-2.5-flash-latest',
  generationConfig: {
    temperature: 0.3, // Lower temperature for more consistent, faster responses
    topP: 0.7, // Reduced for faster token selection
    topK: 20, // Smaller candidate set for speed
    maxOutputTokens: 2048, // Balanced output limit for faster generation
  }
});

// Helper function to check if Gemini is available
const isGeminiAvailable = () => {
  if (!genAI) {
    throw new Error('Gemini AI is not initialized. Please check your GEMINI_API_KEY in server/.env');
  }
  if (!visionModel || !textModel || !fastOutfitModel) {
    throw new Error('Gemini AI models are not properly configured. Please restart the server.');
  }
  return true;
};

export interface ClothingItem {
  id: string;
  image_url: string;
  category: string | { name: string };
  brand?: string;
  color?: string;
  clothing_item_style_tags?: Array<{
    style_tag: {
      id: string;
      name: string;
    };
  }>;
}

export interface StylePreferences {
  occasion: string;
  weather: string;
  style: string;
  colors: string[];
}

export interface OutfitSuggestion {
  id: string;
  name: string;
  description: string;
  items: ClothingItem[];
  occasion: string;
  weather: string;
  confidence: number;
  reasoning: string;
  styling_tips: string[];
  color_analysis: string;
  trend_insights: string;
}

export interface AnalyzedClothingItem extends ClothingItem {
  ai_analysis?: {
    detailed_color: string;
    style_category: string;
    formality_level: number; // 1-10 scale
    season_appropriateness: string[];
    styling_notes: string;
    versatility_score: number; // 1-10 scale
  };
}

/**
 * Analyze a clothing item using Gemini Vision
 */
export async function analyzeClothingImage(imageUrl: string, existingData?: Partial<ClothingItem>): Promise<AnalyzedClothingItem['ai_analysis']> {
  try {
    // Check if Gemini is available
    isGeminiAvailable();
    
    const prompt = `
    You are a professional fashion stylist and color expert. Analyze this clothing item image and provide detailed insights.

    Existing data (if any): ${JSON.stringify(existingData, null, 2)}

    Please analyze and return a JSON object with the following structure:
    {
      "detailed_color": "Precise color description (e.g., 'Burgundy with wine undertones', 'Cream white with warm undertones')",
      "style_category": "Specific style classification (e.g., 'Classic blazer', 'Bohemian maxi dress', 'Street casual hoodie')",
      "formality_level": number between 1-10 (1=very casual, 10=very formal),
      "season_appropriateness": ["spring", "summer", "fall", "winter"] - applicable seasons,
      "styling_notes": "Professional styling advice for this specific piece",
      "versatility_score": number between 1-10 (1=very specific use, 10=highly versatile)
    }

    Consider:
    - Fabric texture and weight
    - Cut and silhouette
    - Color psychology and skin tone compatibility
    - Current fashion trends
    - Styling versatility
    - Quality indicators
    `;

    const imageData = await fetch(imageUrl);
    const imageBuffer = await imageData.arrayBuffer();
    
    const result = await visionModel.generateContent([
      prompt,
      {
        inlineData: {
          data: Buffer.from(imageBuffer).toString('base64'),
          mimeType: 'image/jpeg'
        }
      }
    ]);

    const response = await result.response;
    const text = response.text();
    
    // Extract JSON from response using safe parsing
    try {
      return safeJSONParse(text);
    } catch (parseError) {
      console.error('Failed to parse image analysis response:', parseError);
      // Return default analysis if AI fails
      return {
        detailed_color: existingData?.color || 'Unknown',
        style_category: 'General clothing item',
        formality_level: 5,
        season_appropriateness: ['spring', 'summer', 'fall', 'winter'],
        styling_notes: 'This item can be styled in various ways depending on the occasion.',
        versatility_score: 5
      };
    }
  } catch (error) {
    console.error('Error analyzing clothing image:', error);
    // Return default analysis if AI fails
    return {
      detailed_color: existingData?.color || 'Unknown',
      style_category: 'General clothing item',
      formality_level: 5,
      season_appropriateness: ['spring', 'summer', 'fall', 'winter'],
      styling_notes: 'This item can be styled in various ways depending on the occasion.',
      versatility_score: 5
    };
  }
}

/**
 * Generate intelligent outfit combinations using Gemini
 */
export async function generateAIOutfitSuggestions(
  items: AnalyzedClothingItem[],
  preferences: StylePreferences,
  userProfile?: {
    age_range?: string;
    body_type?: string;
    style_inspiration?: string;
    lifestyle?: string;
  },
  maxOutfits: number = 1
): Promise<OutfitSuggestion[]> {
  try {
    isGeminiAvailable();
    
    // Create detailed wardrobe analysis for better outfit suggestions
    const itemDescriptions = items.map(item => {
      const category = typeof item.category === 'string' ? item.category : item.category?.name;
      const styleTags = item.clothing_item_style_tags?.map(tag => tag.style_tag.name).join(', ') || 'no style tags';
      
      let description = `ID: ${item.id}
- Category: ${category}
- Color: ${item.color || 'unspecified'}
- Brand: ${item.brand || 'unspecified'}
- Style tags: ${styleTags}`;

      // Add AI analysis details if available
      if (item.ai_analysis) {
        description += `
- Detailed color: ${item.ai_analysis.detailed_color}
- Style category: ${item.ai_analysis.style_category}
- Formality level: ${item.ai_analysis.formality_level}/10
- Season appropriateness: ${item.ai_analysis.season_appropriateness?.join(', ') || 'all seasons'}
- Styling notes: ${item.ai_analysis.styling_notes}`;
      }

      return description;
    }).join('\n\n');

    const prompt = `You are a professional fashion stylist. Create ${maxOutfits} outfit suggestion(s) for someone with ${preferences.style} style for ${preferences.occasion} in ${preferences.weather} weather.

Available wardrobe items:
${itemDescriptions}

Consider these styling preferences:
- Style: ${preferences.style}
- Occasion: ${preferences.occasion} 
- Weather: ${preferences.weather}
- Color preferences: ${preferences.colors?.join(', ') || 'no specific preference'}

${userProfile ? `User profile:
- Age range: ${userProfile.age_range || 'not specified'}
- Body type: ${userProfile.body_type || 'not specified'}
- Style inspiration: ${userProfile.style_inspiration || 'personal style'}
- Lifestyle: ${userProfile.lifestyle || 'balanced'}` : ''}

Please respond with a JSON array containing ${maxOutfits} outfit suggestion(s). Each outfit should have this structure:
{
  "name": "descriptive outfit name",
  "description": "detailed description of the look and why it works",
  "item_ids": ["item-id-1", "item-id-2", "item-id-3"],
  "confidence": 0.95,
  "reasoning": "detailed explanation of why these items work together, considering color theory, style coherence, and appropriateness for the occasion",
  "styling_tips": ["specific tip about how to wear this outfit", "another styling suggestion"],
  "color_analysis": "analysis of how the colors work together, including any color theory principles",
  "trend_insights": "current fashion trends this outfit aligns with or timeless principles it follows"
}

Guidelines:
- Use ONLY the item IDs provided above
- Consider color harmony, style coherence, and occasion appropriateness
- Each outfit should have 2-4 items that work well together
- Provide detailed reasoning and styling advice
- Consider the weather and formality requirements
- If generating multiple outfits, make them distinctly different in style or occasion focus

Respond with ${maxOutfits === 1 ? 'a single JSON object' : 'a JSON array of outfit objects'}.`;

    const result = await textModel.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();

    // Extract JSON from response using safe parsing
    try {
      const aiSuggestion = safeJSONParse(text);

      // Handle single object response (since we're only generating 1 outfit)
      const suggestion = aiSuggestion;
      
      const suggestionItems = (suggestion.item_ids || [])
        .map((id: string) => {
          const foundItem = items.find(item => item.id === id);
          return foundItem;
        })
        .filter(Boolean);

      const outfitSuggestion: OutfitSuggestion = {
        id: 'ai-outfit-1',
        name: suggestion.name || 'AI Generated Outfit',
        description: suggestion.description || 'A stylish combination',
        items: suggestionItems,
        occasion: preferences.occasion,
        weather: preferences.weather,
        confidence: suggestion.confidence || 0.8,
        reasoning: suggestion.reasoning || 'This outfit combines your items nicely',
        styling_tips: suggestion.styling_tips || [],
        color_analysis: suggestion.color_analysis || '',
        trend_insights: suggestion.trend_insights || ''
      };
      
      return suggestionItems.length >= 2 ? [outfitSuggestion] : [];
    } catch (parseError) {
      console.error('Failed to parse outfit generation response:', parseError);
      console.error('Raw response text:', text);
      
      // Create a basic outfit suggestion using available items if parsing fails
      if (items.length >= 2) {
        const fallbackItems = items.slice(0, Math.min(3, items.length));
        const fallbackOutfit: OutfitSuggestion = {
          id: 'ai-outfit-fallback',
          name: `${preferences.style} Look`,
          description: `A curated ${preferences.style} outfit for ${preferences.occasion}`,
          items: fallbackItems,
          occasion: preferences.occasion,
          weather: preferences.weather,
          confidence: 0.75,
          reasoning: `These items work well together for ${preferences.occasion} in ${preferences.weather} weather. The AI provided styling advice but had formatting issues.`,
          styling_tips: [
            'Layer pieces for versatility',
            'Consider accessories to personalize the look',
            'Adjust based on your comfort and the specific event'
          ],
          color_analysis: 'Colors chosen to complement each other and suit the occasion',
          trend_insights: 'Classic combinations that remain stylish and appropriate'
        };
        return [fallbackOutfit];
      }
      
      return [];
    }
  } catch (error) {
    console.error('Error generating AI outfit suggestions:', error);
    return [];
  }
}

/**
 * Get personalized styling advice
 */
export async function getPersonalStylingAdvice(
  userQuery: string,
  wardrobe: AnalyzedClothingItem[],
  userProfile?: any
): Promise<string> {
  try {
    // Check if Gemini is available
    isGeminiAvailable();
    
    // Verify textModel exists
    if (!textModel) {
      throw new Error('textModel is not initialized');
    }
    
    // Build dynamic wardrobe summary
    const wardrobeItems = wardrobe.slice(0, 8).map(item => {
      const category = typeof item.category === 'string' ? item.category : item.category?.name;
      return `${category}: ${item.color}${item.brand ? ` (${item.brand})` : ''}`;
    }).join(', ');

    const prompt = `You're a personal stylist. Answer this question: "${userQuery}"

Available wardrobe: ${wardrobeItems || 'Limited wardrobe info'}

Give helpful, specific advice in under 250 words. Be encouraging and reference their items when relevant.`;

    const result = await textModel.generateContent(prompt);
    
    const response = await result.response;
    
    if (!response) {
      throw new Error('No response received from Gemini');
    }
    
    const rawText = response.text();
    
    // Clean markdown formatting from the response
    const cleanedText = rawText
      .replace(/\*\*(.*?)\*\*/g, '$1')  // Remove bold **text**
      .replace(/\*(.*?)\*/g, '$1')      // Remove italic *text*
      .replace(/```[\s\S]*?```/g, '')   // Remove code blocks
      .replace(/`([^`]+)`/g, '$1')      // Remove inline code
      .trim();
    
    if (!cleanedText) {
      throw new Error('Empty response received from AI');
    }
    
    return cleanedText;
  } catch (error) {
    console.error('Error getting styling advice:', error);
    
    // Return the old error message for now so we can see if our logging works
    return "I'm having trouble providing styling advice right now. Please try again later.";
  }
}

// Enhanced function to safely parse JSON from AI responses
function safeJSONParse(text: string): any {
  try {
    // Strategy 1: Try parsing the raw text first (in case it's already clean JSON)
    try {
      const result = JSON.parse(text);
      return result;
    } catch (e) {
      // Continue to extraction if direct parsing fails
    }

    // Strategy 2: Extract JSON patterns
    let jsonStr = '';
    
    // Look for JSON object pattern (prioritize this for single object responses)
    const objectMatch = text.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
    if (objectMatch) {
      jsonStr = objectMatch[0];
    } else {
      // Look for JSON array pattern
      const arrayMatch = text.match(/\[[^\[\]]*(?:\[[^\[\]]*\][^\[\]]*)*\]/);
      if (arrayMatch) {
        jsonStr = arrayMatch[0];
      }
    }
    
    // Strategy 3: Clean the extracted JSON more carefully
    jsonStr = jsonStr
      // Remove markdown code blocks
      .replace(/```json\s*/gi, '')
      .replace(/```\s*/g, '')
      // Remove markdown bold formatting
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      // Remove control characters but be more selective
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Fix trailing commas
      .replace(/,(\s*[}\]])/g, '$1')
      // Trim whitespace
      .trim();
    
    // Strategy 4: Try parsing the cleaned JSON
    const result = JSON.parse(jsonStr);
    return result;
    
  } catch (error) {
    console.error('All JSON parsing strategies failed:', error);
    
    // Strategy 5: Last resort - try to manually construct a valid response
    if (text.toLowerCase().includes('outfit') || text.toLowerCase().includes('style')) {
      return {
        name: 'AI Generated Outfit',
        description: 'A stylish combination based on your preferences',
        item_ids: [],
        confidence: 0.7,
        reasoning: text.substring(0, 200) + '...',
        styling_tips: ['Mix and match different pieces', 'Consider the occasion and weather'],
        color_analysis: 'Colors chosen to complement each other',
        trend_insights: 'Classic style elements that remain fashionable'
      };
    }
    
    throw new Error(`Failed to parse AI response as JSON: ${error.message}`);
  }
}

// Fallback function for when JSON parsing completely fails
function createFallbackResponse(type: 'object' | 'array' = 'object'): any {
  if (type === 'array') {
    return [];
  }
  return {
    gaps: ['AI analysis temporarily unavailable'],
    recommendations: ['Please try again in a moment'],
    priority_items: ['System is recovering']
  };
}

/**
 * Analyze wardrobe gaps and shopping recommendations
 */
export async function analyzeWardrobeGaps(
  wardrobe: AnalyzedClothingItem[],
  preferences: StylePreferences
): Promise<{
  gaps: string[];
  recommendations: string[];
  priority_items: string[];
}> {
  try {
    isGeminiAvailable();
    
    const prompt = `
You are a professional fashion consultant. Analyze this wardrobe and provide shopping recommendations.

WARDROBE ITEMS:
${wardrobe.map(item => 
  `- ${typeof item.category === 'string' ? item.category : item.category?.name}: ${item.color}`
).join('\n')}

USER PREFERENCES:
Occasion: ${preferences.occasion}
Weather: ${preferences.weather}  
Style: ${preferences.style}

Return ONLY valid JSON in this exact format (no markdown, no explanations, no extra text):
{
  "gaps": ["specific gap 1", "specific gap 2"],
  "recommendations": ["specific recommendation 1", "specific recommendation 2"], 
  "priority_items": ["priority item 1", "priority item 2"]
}`;

    const result = await textModel.generateContent(prompt);
    const response = await result.response;
    const text = response.text().trim();

    try {
      return safeJSONParse(text);
    } catch (parseError) {
      console.error('Failed to parse wardrobe analysis response:', parseError);
      console.error('Using fallback response due to parsing failure');
      // Return fallback response
      return createFallbackResponse('object');
    }
  } catch (error) {
    console.error('Error analyzing wardrobe gaps:', error);
    return {
      gaps: ['Analysis temporarily unavailable'],
      recommendations: ['Please try again later'],
      priority_items: []
    };
  }
}

export { genAI, visionModel, textModel };
