import { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      item,
      image_url, 
      imageUrl, 
      category, 
      color, 
      brand, 
      style,
      userProfile = {},
      context = '',
      detailed = false,
      analysis_type = 'general'
    } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Gemini API key not configured' });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash-latest',
      generationConfig: {
        temperature: 0.3,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 2048,
      }
    });

    // Handle both item object and individual parameters
    let itemData;
    if (item && typeof item === 'object') {
      itemData = item;
    } else {
      itemData = {
        category: category || 'clothing item',
        color: color || 'unspecified',
        brand: brand || '',
        style: style || '',
        image_url: image_url || imageUrl || ''
      };
    }

    // Build context for analysis
    let itemContext = `Item Details:
- Category: ${itemData.category || 'clothing item'}
- Color: ${itemData.color || 'unspecified'}`;
    
    if (itemData.brand) itemContext += `\n- Brand: ${itemData.brand}`;
    if (itemData.style) itemContext += `\n- Style: ${itemData.style}`;
    if (itemData.description) itemContext += `\n- Description: ${itemData.description}`;
    if (context) itemContext += `\n- Additional context: ${context}`;

    let userContext = '';
    if (userProfile && Object.keys(userProfile).length > 0) {
      userContext = `\nUSER PROFILE:
- Age: ${userProfile.age || 'not specified'}
- Style inspiration: ${userProfile.style_inspiration || 'versatile'}
- Lifestyle: ${userProfile.lifestyle || 'active'}
- Body type: ${userProfile.body_type || 'not specified'}
- Budget range: ${userProfile.budget_range || 'not specified'}`;
    }

    const analysisDepth = detailed || analysis_type === 'detailed' ? 'comprehensive' : 'standard';

    const prompt = `You are an expert fashion analyst and stylist. Analyze this clothing item in detail.

${itemContext}
${userContext}

ANALYSIS TYPE: ${analysisDepth}

Please provide a thorough analysis including:

1. **Item Assessment**:
   - Style classification and aesthetic
   - Quality indicators and construction
   - Versatility rating (1-10)
   - Value assessment

2. **Styling Potential**:
   - How to style this piece (5+ specific suggestions)
   - Best occasions for wearing
   - Season appropriateness
   - What to pair it with

3. **Wardrobe Integration**:
   - Essential pieces that complement this item
   - Color combinations that work
   - Style personalities it suits
   - Wardrobe gaps this item fills

4. **Care & Longevity**:
   - Care instructions and maintenance
   - Expected lifespan
   - How to preserve quality

Return as JSON in this exact structure:
{
  "item_assessment": {
    "style_classification": "style description",
    "quality_score": 1-10,
    "versatility_rating": 1-10,
    "value_assessment": "excellent/good/fair/poor",
    "key_features": ["feature1", "feature2", "feature3"]
  },
  "styling_potential": {
    "styling_suggestions": ["suggestion1", "suggestion2", "suggestion3", "suggestion4", "suggestion5"],
    "best_occasions": ["occasion1", "occasion2", "occasion3"],
    "seasonal_use": ["season1", "season2"],
    "pairing_items": ["item1", "item2", "item3"]
  },
  "wardrobe_integration": {
    "essential_complements": ["complement1", "complement2", "complement3"],
    "color_combinations": ["color1", "color2", "color3"],
    "style_personalities": ["personality1", "personality2"],
    "wardrobe_gap_filled": "what gap this fills"
  },
  "care_longevity": {
    "care_instructions": "care guidelines",
    "expected_lifespan": "time period",
    "maintenance_tips": ["tip1", "tip2"]
  },
  "overall_rating": 1-10,
  "confidence_score": 1-10,
  "styling_confidence": 1-10,
  "purchase_recommendation": "strong buy/buy/consider/pass"
}`;

    // If there's an image URL, include image analysis
    if (itemData.image_url) {
      try {
        const imagePart = {
          inlineData: {
            data: await fetchImageAsBase64(itemData.image_url),
            mimeType: "image/jpeg"
          }
        };
        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        const text = response.text();
        
        const analysis = parseAnalysisResponse(text, itemData);
        return res.status(200).json({
          analysis,
          image_url: itemData.image_url,
          metadata: {
            analysis_type: analysisDepth,
            has_image: true,
            timestamp: new Date().toISOString()
          }
        });
      } catch (imageError) {
        console.warn('Image analysis failed, falling back to text-only:', imageError);
        // Continue with text-only analysis
      }
    }

    // Text-only analysis
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const analysis = parseAnalysisResponse(text, itemData);

    res.status(200).json({
      analysis,
      metadata: {
        analysis_type: analysisDepth,
        has_image: false,
        timestamp: new Date().toISOString(),
        has_user_context: Object.keys(userProfile).length > 0
      }
    });

  } catch (error: any) {
    console.error('Item analysis error:', error);
    res.status(500).json({ 
      error: 'Failed to analyze item',
      message: 'Our AI stylist is temporarily unavailable. Please try again in a few moments.'
    });
  }
}

// Helper function to parse AI response
function parseAnalysisResponse(text: string, itemData: any) {
  try {
    const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    
    let analysis;
    if (jsonMatch) {
      analysis = JSON.parse(jsonMatch[0]);
    } else {
      analysis = JSON.parse(cleanText);
    }

    // Validate and ensure all required fields exist with fallbacks
    return {
      item_assessment: {
        style_classification: analysis.item_assessment?.style_classification || 'classic versatile piece',
        quality_score: Math.min(10, Math.max(1, analysis.item_assessment?.quality_score || 7)),
        versatility_rating: Math.min(10, Math.max(1, analysis.item_assessment?.versatility_rating || 8)),
        value_assessment: analysis.item_assessment?.value_assessment || 'good',
        key_features: Array.isArray(analysis.item_assessment?.key_features) ? 
          analysis.item_assessment.key_features : ['versatile styling', 'quality construction', 'wardrobe staple']
      },
      styling_potential: {
        styling_suggestions: Array.isArray(analysis.styling_potential?.styling_suggestions) ? 
          analysis.styling_potential.styling_suggestions : [
            'Layer with basics for everyday wear',
            'Dress up with accessories for special occasions',
            'Mix with contrasting pieces for visual interest',
            'Pair with neutrals for a classic look',
            'Add texture through complementary fabrics'
          ],
        best_occasions: Array.isArray(analysis.styling_potential?.best_occasions) ? 
          analysis.styling_potential.best_occasions : ['casual', 'everyday', 'weekend'],
        seasonal_use: Array.isArray(analysis.styling_potential?.seasonal_use) ? 
          analysis.styling_potential.seasonal_use : ['year-round'],
        pairing_items: Array.isArray(analysis.styling_potential?.pairing_items) ? 
          analysis.styling_potential.pairing_items : ['basic tees', 'dark jeans', 'neutral accessories']
      },
      wardrobe_integration: {
        essential_complements: Array.isArray(analysis.wardrobe_integration?.essential_complements) ? 
          analysis.wardrobe_integration.essential_complements : [
            'basic white shirt',
            'dark wash denim',
            'neutral cardigan'
          ],
        color_combinations: Array.isArray(analysis.wardrobe_integration?.color_combinations) ? 
          analysis.wardrobe_integration.color_combinations : ['white', 'black', 'navy'],
        style_personalities: Array.isArray(analysis.wardrobe_integration?.style_personalities) ? 
          analysis.wardrobe_integration.style_personalities : ['classic', 'versatile'],
        wardrobe_gap_filled: analysis.wardrobe_integration?.wardrobe_gap_filled || 'adds essential versatility'
      },
      care_longevity: {
        care_instructions: analysis.care_longevity?.care_instructions || 'follow care label instructions',
        expected_lifespan: analysis.care_longevity?.expected_lifespan || 'several years with proper care',
        maintenance_tips: Array.isArray(analysis.care_longevity?.maintenance_tips) ? 
          analysis.care_longevity.maintenance_tips : [
            'Store properly on hangers',
            'Follow recommended washing instructions'
          ]
      },
      overall_rating: Math.min(10, Math.max(1, analysis.overall_rating || 8)),
      confidence_score: Math.min(10, Math.max(1, analysis.confidence_score || 8)),
      styling_confidence: Math.min(10, Math.max(1, analysis.styling_confidence || 8)),
      purchase_recommendation: analysis.purchase_recommendation || 'buy'
    };

  } catch (parseError) {
    console.error('JSON parsing failed:', parseError);
    
    // Fallback analysis structure
    return {
      item_assessment: {
        style_classification: 'versatile wardrobe piece',
        quality_score: 7,
        versatility_rating: 8,
        value_assessment: 'good',
        key_features: ['versatile styling', 'good quality', 'wardrobe essential']
      },
      styling_potential: {
        styling_suggestions: [
          'Layer with basic pieces for everyday wear',
          'Dress up with statement accessories',
          'Mix with contrasting textures',
          'Pair with neutrals for timeless looks',
          'Add interest with complementary colors'
        ],
        best_occasions: ['casual', 'everyday', 'weekend'],
        seasonal_use: ['year-round'],
        pairing_items: ['basic tees', 'denim', 'neutral accessories']
      },
      wardrobe_integration: {
        essential_complements: ['white shirt', 'dark jeans', 'cardigan'],
        color_combinations: ['white', 'black', 'navy'],
        style_personalities: ['classic', 'versatile'],
        wardrobe_gap_filled: 'provides essential versatility'
      },
      care_longevity: {
        care_instructions: 'follow care label for best results',
        expected_lifespan: 'several years with proper care',
        maintenance_tips: ['proper storage', 'gentle washing']
      },
      overall_rating: 8,
      confidence_score: 8,
      styling_confidence: 8,
      purchase_recommendation: 'buy'
    };
  }
}

// Helper function to fetch image and convert to base64
async function fetchImageAsBase64(imageUrl: string): Promise<string> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    return base64;
  } catch (error) {
    console.error('Error fetching image:', error);
    throw new Error('Failed to fetch image for analysis');
  }
}
