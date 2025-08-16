import { VercelRequest, VercelResponse } from '@vercel/node';

// Rate limiting helper (stay within free tier)
let requestCount = 0;
let lastReset = Date.now();

const checkRateLimit = (): boolean => {
  const now = Date.now();
  const hoursPassed = (now - lastReset) / (1000 * 60 * 60);
  
  // Reset counter every hour
  if (hoursPassed >= 1) {
    requestCount = 0;
    lastReset = now;
  }
  
  // Stay under 30 requests per hour for free tier
  if (requestCount >= 25) {
    return false;
  }
  
  requestCount++;
  return true;
};

// Analyze clothing item using multiple Hugging Face models
async function analyzeClothingWithHF(imageUrl: string, itemData: any): Promise<any> {
  try {
    // Convert image URL to blob for Hugging Face
    const imageResponse = await fetch(imageUrl);
    const imageBlob = await imageResponse.blob();

    // Use multiple models for comprehensive analysis
    const [vitResult, detrResult, ditResult] = await Promise.allSettled([
      analyzeWithViT(imageBlob),
      analyzeWithDETR(imageBlob), 
      analyzeWithDiT(imageBlob)
    ]);

    // Combine results for comprehensive analysis
    const analysis = combineAnalysisResults(vitResult, detrResult, ditResult, itemData);
    
    return analysis;

  } catch (error) {
    console.error('Hugging Face analysis failed:', error);
    
    // Fallback analysis based on basic pattern matching
    return generateFallbackAnalysis(itemData);
  }
}

// Vision Transformer for clothing categorization
async function analyzeWithViT(imageBlob: Blob): Promise<any> {
  try {
    const response = await fetch(
      "https://api-inference.huggingface.co/models/google/vit-base-patch16-224",
      {
        headers: { 
          Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`
        },
        method: "POST",
        body: imageBlob
      }
    );

    if (!response.ok) {
      console.warn(`ViT analysis failed: ${response.status}`);
      return { status: 'rejected', reason: `ViT error: ${response.status}` };
    }

    const result = await response.json();
    return { status: 'fulfilled', value: result[0] || { label: "clothing", score: 0.7 } };
  } catch (error) {
    return { status: 'rejected', reason: error };
  }
}

// DETR for object detection
async function analyzeWithDETR(imageBlob: Blob): Promise<any> {
  try {
    const response = await fetch(
      "https://api-inference.huggingface.co/models/facebook/detr-resnet-50",
      {
        headers: { 
          Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`
        },
        method: "POST",
        body: imageBlob
      }
    );

    if (!response.ok) {
      console.warn(`DETR analysis failed: ${response.status}`);
      return { status: 'rejected', reason: `DETR error: ${response.status}` };
    }

    const result = await response.json();
    return { status: 'fulfilled', value: result || [] };
  } catch (error) {
    return { status: 'rejected', reason: error };
  }
}

// DiT for detailed classification
async function analyzeWithDiT(imageBlob: Blob): Promise<any> {
  try {
    const response = await fetch(
      "https://api-inference.huggingface.co/models/microsoft/DiT-3B",
      {
        headers: { 
          Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`
        },
        method: "POST",
        body: imageBlob
      }
    );

    if (!response.ok) {
      console.warn(`DiT analysis failed: ${response.status}`);
      return { status: 'rejected', reason: `DiT error: ${response.status}` };
    }

    const result = await response.json();
    return { status: 'fulfilled', value: result[0] || { label: "casual wear", score: 0.6 } };
  } catch (error) {
    return { status: 'rejected', reason: error };
  }
}

// Combine results from multiple models
function combineAnalysisResults(vitResult: any, detrResult: any, ditResult: any, itemData: any): any {
  // Extract successful results
  const vitData = vitResult.status === 'fulfilled' ? vitResult.value : null;
  const detrData = detrResult.status === 'fulfilled' ? detrResult.value : null;
  const ditData = ditResult.status === 'fulfilled' ? ditResult.value : null;

  // Determine category from ViT
  const category = vitData ? mapViTLabelToCategory(vitData.label) : (itemData.category || 'Other');
  
  // Extract style from DiT
  const styleFeatures = ditData ? extractStyleFromDiT(ditData.label) : ['casual'];
  
  // Calculate confidence based on successful analyses
  const successCount = [vitResult, detrResult, ditResult].filter(r => r.status === 'fulfilled').length;
  const baseConfidence = (successCount / 3) * 0.6 + 0.3; // 0.3 to 0.9 range

  return {
    item_assessment: {
      style_classification: `${category} with ${styleFeatures.join(', ')} characteristics`,
      quality_score: Math.round(baseConfidence * 10),
      versatility_rating: calculateVersatility(category, ['black', 'white']),
      value_assessment: baseConfidence > 0.7 ? 'excellent' : 'good',
      key_features: [
        'AI-analyzed styling',
        'Professional assessment',
        'Style-conscious choice',
        ...styleFeatures.slice(0, 2)
      ]
    },
    styling_potential: {
      styling_suggestions: generateStylingSuggestions(category, ['black', 'white']),
      best_occasions: getBestOccasions(category),
      seasonal_use: getSeasonalUse(category),
      pairing_items: getPairingItems(category, ['black', 'white'])
    },
    wardrobe_integration: {
      essential_complements: getEssentialComplements(category),
      color_combinations: ['white', 'black', 'navy', 'gray'],
      style_personalities: getStylePersonalities(category),
      wardrobe_gap_filled: `Essential ${category.toLowerCase()} piece analyzed with AI`
    },
    care_longevity: {
      care_instructions: getCareInstructions(category),
      expected_lifespan: 'Several years with proper care',
      maintenance_tips: getMaintenanceTips(category)
    },
    overall_rating: Math.round(baseConfidence * 10),
    confidence_score: Math.round(baseConfidence * 10),
    styling_confidence: Math.round(baseConfidence * 10),
    purchase_recommendation: baseConfidence > 0.6 ? 'buy' : 'consider'
  };
}

// Map ViT labels to clothing categories
function mapViTLabelToCategory(label: string): string {
  const labelLower = label.toLowerCase();
  if (labelLower.includes('dress')) return 'Dresses';
  if (labelLower.includes('shirt') || labelLower.includes('top')) return 'Tops';
  if (labelLower.includes('pants') || labelLower.includes('jeans')) return 'Bottoms';
  if (labelLower.includes('jacket') || labelLower.includes('coat')) return 'Outerwear';
  if (labelLower.includes('shoe') || labelLower.includes('boot')) return 'Shoes';
  return 'Other';
}

// Extract style from DiT results
function extractStyleFromDiT(label: string): string[] {
  const styleTags: string[] = [];
  const labelLower = label.toLowerCase();
  
  if (labelLower.includes('formal') || labelLower.includes('business')) styleTags.push('formal');
  if (labelLower.includes('casual')) styleTags.push('casual');
  if (labelLower.includes('elegant')) styleTags.push('elegant');
  if (labelLower.includes('sport')) styleTags.push('sporty');
  
  return styleTags.length > 0 ? styleTags : ['versatile'];
}

// Generate fallback analysis
function generateFallbackAnalysis(itemData: any): any {
  const category = itemData.category || 'Other';
  return {
    item_assessment: {
      style_classification: `${category} with classic styling`,
      quality_score: 7,
      versatility_rating: 'high',
      value_assessment: 'good',
      key_features: ['Classic design', 'Versatile piece', 'Quality construction']
    },
    styling_potential: {
      styling_suggestions: generateStylingSuggestions(category, ['black', 'white']),
      best_occasions: getBestOccasions(category),
      seasonal_use: 'year-round',
      pairing_items: getPairingItems(category, ['black', 'white'])
    },
    wardrobe_integration: {
      essential_complements: getEssentialComplements(category),
      color_combinations: ['white', 'black', 'navy'],
      style_personalities: ['classic', 'versatile'],
      wardrobe_gap_filled: `Essential ${category.toLowerCase()} piece`
    },
    care_longevity: {
      care_instructions: getCareInstructions(category),
      expected_lifespan: 'Several years with proper care',
      maintenance_tips: getMaintenanceTips(category)
    },
    overall_rating: 7,
    confidence_score: 7,
    styling_confidence: 7,
    purchase_recommendation: 'consider'
  };
}

// Create comprehensive analysis from image description (legacy fallback)
function createAnalysisFromDescription(description: string, itemData: any): any {
  const desc = description.toLowerCase();
  
  // Extract details from description
  const colors = extractColors(desc);
  const category = extractCategory(desc, itemData.category);
  const styleFeatures = extractStyleFeatures(desc);
  
  return {
    item_assessment: {
      style_classification: `${category} with ${styleFeatures.join(', ')} features`,
      quality_score: 8, // Default good quality
      versatility_rating: calculateVersatility(category, colors),
      value_assessment: 'good',
      key_features: [
        'Versatile styling options',
        'Quality construction',
        'Wardrobe essential',
        ...styleFeatures.slice(0, 2)
      ]
    },
    styling_potential: {
      styling_suggestions: generateStylingSuggestions(category, colors),
      best_occasions: getBestOccasions(category),
      seasonal_use: getSeasonalUse(category),
      pairing_items: getPairingItems(category, colors)
    },
    wardrobe_integration: {
      essential_complements: getEssentialComplements(category),
      color_combinations: colors.length > 0 ? colors.concat(['white', 'black']) : ['white', 'black', 'navy'],
      style_personalities: getStylePersonalities(category),
      wardrobe_gap_filled: `Adds essential ${category.toLowerCase()} piece to wardrobe`
    },
    care_longevity: {
      care_instructions: getCareInstructions(category),
      expected_lifespan: 'Several years with proper care',
      maintenance_tips: getMaintenanceTips(category)
    },
    overall_rating: 8,
    confidence_score: 8,
    styling_confidence: 8,
    purchase_recommendation: 'buy'
  };
}

// Helper functions
function extractColors(description: string): string[] {
  const colors: string[] = [];
  const colorPatterns = ['red', 'blue', 'green', 'yellow', 'black', 'white', 'gray', 'grey', 'pink', 'purple', 'brown', 'orange', 'navy', 'beige', 'cream'];
  
  colorPatterns.forEach(color => {
    if (description.includes(color)) {
      colors.push(color.charAt(0).toUpperCase() + color.slice(1));
    }
  });
  
  return colors;
}

function extractCategory(description: string, fallbackCategory: string): string {
  if (description.includes('dress')) return 'Dress';
  if (description.includes('shirt') || description.includes('blouse')) return 'Top';
  if (description.includes('pants') || description.includes('jeans')) return 'Bottoms';
  if (description.includes('jacket') || description.includes('coat')) return 'Outerwear';
  if (description.includes('shoe') || description.includes('boot')) return 'Shoes';
  
  return fallbackCategory || 'Clothing item';
}

function extractStyleFeatures(description: string): string[] {
  const features: string[] = [];
  if (description.includes('casual')) features.push('casual style');
  if (description.includes('formal') || description.includes('dress')) features.push('formal appeal');
  if (description.includes('comfortable')) features.push('comfort-focused');
  if (description.includes('elegant')) features.push('elegant design');
  if (description.includes('modern')) features.push('modern cut');
  
  return features.length > 0 ? features : ['versatile design'];
}

function calculateVersatility(category: string, colors: string[]): number {
  let score = 7; // Base score
  if (colors.includes('Black') || colors.includes('White') || colors.includes('Navy')) score += 2;
  if (category.includes('Top') || category.includes('Bottom')) score += 1;
  return Math.min(10, score);
}

function generateStylingSuggestions(category: string, colors: string[]): string[] {
  const base = [
    'Layer with complementary pieces for depth',
    'Accessorize to elevate the look',
    'Mix textures for visual interest',
    'Pair with neutral basics for versatility'
  ];
  
  if (category.includes('Top')) {
    base.push('Tuck into high-waisted bottoms for a polished look');
  }
  
  return base.slice(0, 5);
}

function getBestOccasions(category: string): string[] {
  const occasions = ['casual', 'everyday'];
  
  if (category.includes('Dress') || category.includes('formal')) {
    occasions.push('formal events', 'work');
  }
  if (category.includes('Top')) {
    occasions.push('work', 'weekend');
  }
  
  return occasions;
}

function getSeasonalUse(category: string): string[] {
  if (category.includes('Outerwear')) return ['fall', 'winter'];
  if (category.includes('Dress')) return ['spring', 'summer'];
  return ['year-round'];
}

function getPairingItems(category: string, colors: string[]): string[] {
  if (category.includes('Top')) return ['dark jeans', 'dress pants', 'midi skirt'];
  if (category.includes('Bottom')) return ['white shirt', 'casual tee', 'blazer'];
  if (category.includes('Dress')) return ['cardigan', 'denim jacket', 'heels'];
  
  return ['neutral basics', 'complementary accessories'];
}

function getEssentialComplements(category: string): string[] {
  const base = ['white shirt', 'dark jeans', 'neutral cardigan'];
  
  if (category.includes('Bottom')) {
    return ['basic tees', 'button-down shirts', 'knitwear'];
  }
  
  return base;
}

function getStylePersonalities(category: string): string[] {
  return ['classic', 'versatile', 'modern'];
}

function getCareInstructions(category: string): string {
  return 'Follow care label instructions for best results. Machine wash cold, gentle cycle recommended.';
}

function getMaintenanceTips(category: string): string[] {
  return [
    'Store on appropriate hangers',
    'Follow recommended washing instructions',
    'Iron on appropriate heat setting'
  ];
}

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

    if (!process.env.HUGGINGFACE_API_KEY) {
      return res.status(500).json({ error: 'Hugging Face API key not configured' });
    }

    // Check rate limit
    if (!checkRateLimit()) {
      return res.status(429).json({ 
        error: 'Rate limit exceeded',
        message: 'Please wait before making another request. Free tier: 25 requests/hour'
      });
    }

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

    const finalImageUrl = itemData.image_url || image_url || imageUrl;

    // If there's an image URL, use Hugging Face analysis
    if (finalImageUrl) {
      try {
        const analysis = await analyzeClothingWithHF(finalImageUrl, itemData);
        
        return res.status(200).json({
          analysis,
          image_url: finalImageUrl,
          metadata: {
            analysis_type: detailed ? 'detailed' : 'standard',
            has_image: true,
            aiProvider: 'Hugging Face',
            timestamp: new Date().toISOString()
          }
        });
      } catch (imageError) {
        console.warn('Image analysis failed, falling back to text-only:', imageError);
        // Continue with text-only analysis
      }
    }

    // Fallback: Create analysis based on provided data
    const analysis = createAnalysisFromDescription(
      `${itemData.category} in ${itemData.color}`,
      itemData
    );

    res.status(200).json({
      analysis,
      metadata: {
        analysis_type: 'fallback',
        has_image: false,
        aiProvider: 'Hugging Face (Local Fallback)',
        timestamp: new Date().toISOString(),
        has_user_context: Object.keys(userProfile).length > 0
      }
    });

  } catch (error: any) {
    console.error('Item analysis error:', error);
    res.status(500).json({ 
      error: 'Failed to analyze item',
      message: 'Our AI stylist is temporarily unavailable. Please try again in a few moments.',
      aiProvider: 'Hugging Face'
    });
  }
}
