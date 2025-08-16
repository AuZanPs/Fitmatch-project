import type { VercelRequest, VercelResponse } from '@vercel/node';

interface WardrobeItem {
  id: string;
  category: string;
  color: string;
  description: string;
  image_url?: string;
}

interface WardrobeRequest {
  items: WardrobeItem[];
  analysis_type?: 'full' | 'gaps' | 'suggestions' | 'color_analysis';
  style_goal?: string;
  budget?: string;
}

interface WardrobeResponse {
  success: boolean;
  analysis?: {
    summary: string;
    strengths: string[];
    gaps: string[];
    recommendations: string[];
    color_analysis: {
      dominant_colors: string[];
      missing_colors: string[];
      color_harmony: string;
    };
    versatility_score: number;
  };
  error?: string;
  rate_limited?: boolean;
}

// Rate limiting for free tier
let requestCount = 0;
let lastReset = Date.now();

const checkRateLimit = (): boolean => {
  const now = Date.now();
  const hoursPassed = (now - lastReset) / (1000 * 60 * 60);
  
  if (hoursPassed >= 1) {
    requestCount = 0;
    lastReset = now;
  }
  
  if (requestCount >= 25) {
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

  // Check rate limit
  if (!checkRateLimit()) {
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded. Try again in an hour.',
      rate_limited: true
    });
  }

  // Check API key
  if (!process.env.HUGGINGFACE_API_KEY) {
    return res.status(500).json({
      success: false,
      error: 'Hugging Face API key not configured'
    });
  }

  try {
    const { items, analysis_type = 'full', style_goal, budget }: WardrobeRequest = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Items array is required and must not be empty'
      });
    }

    // Perform comprehensive wardrobe analysis
    const analysis = await analyzeWardrobe(items, analysis_type, style_goal, budget);

    return res.status(200).json({
      success: true,
      analysis
    });

  } catch (error) {
    console.error('Wardrobe analysis error:', error);
    
    // Provide fallback analysis
    const fallbackAnalysis = generateFallbackAnalysis(req.body.items || []);
    
    return res.status(200).json({
      success: true,
      analysis: fallbackAnalysis,
      note: 'Using fallback analysis due to AI service unavailability'
    });
  }
}

// Main wardrobe analysis function
async function analyzeWardrobe(items: WardrobeItem[], analysisType: string, styleGoal?: string, budget?: string) {
  // Categorize items
  const categories = categorizeItems(items);
  const colors = extractColors(items);
  
  // Build AI prompt for analysis
  const prompt = buildAnalysisPrompt(items, categories, colors, styleGoal, budget);
  
  try {
    // Get AI insights (if available)
    const aiInsights = await getAIInsights(prompt);
    
    // Combine AI insights with rule-based analysis
    return combineAnalyses(items, categories, colors, aiInsights, styleGoal);
    
  } catch (error) {
    // Fall back to rule-based analysis only
    return performRuleBasedAnalysis(items, categories, colors, styleGoal);
  }
}

// Get AI insights from Hugging Face
async function getAIInsights(prompt: string): Promise<string> {
  const response = await fetch(
    "https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium",
    {
      headers: {
        Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        "Content-Type": "application/json"
      },
      method: "POST",
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_length: 400,
          temperature: 0.7,
          top_p: 0.9
        }
      })
    }
  );

  if (!response.ok) {
    throw new Error(`Hugging Face API error: ${response.status}`);
  }

  const result = await response.json();
  return result[0]?.generated_text || '';
}

// Categorize wardrobe items
function categorizeItems(items: WardrobeItem[]) {
  const categories: { [key: string]: number } = {};
  
  items.forEach(item => {
    const category = item.category.toLowerCase();
    categories[category] = (categories[category] || 0) + 1;
  });
  
  return categories;
}

// Extract color information
function extractColors(items: WardrobeItem[]) {
  const colors: { [key: string]: number } = {};
  
  items.forEach(item => {
    const color = item.color.toLowerCase();
    colors[color] = (colors[color] || 0) + 1;
  });
  
  return colors;
}

// Build AI analysis prompt
function buildAnalysisPrompt(items: WardrobeItem[], categories: any, colors: any, styleGoal?: string, budget?: string): string {
  let prompt = `Analyze this wardrobe as a professional fashion consultant:

Wardrobe Items (${items.length} total):`;

  // Add item details
  items.slice(0, 10).forEach((item, index) => { // Limit to first 10 items for prompt length
    prompt += `\n${index + 1}. ${item.category}: ${item.description} (${item.color})`;
  });

  prompt += `\n\nCategory Distribution: ${Object.entries(categories).map(([cat, count]) => `${cat}: ${count}`).join(', ')}`;
  prompt += `\n\nColor Distribution: ${Object.entries(colors).map(([color, count]) => `${color}: ${count}`).join(', ')}`;

  if (styleGoal) prompt += `\n\nStyle Goal: ${styleGoal}`;
  if (budget) prompt += `\n\nBudget: ${budget}`;

  prompt += `\n\nProvide analysis of:
1. Wardrobe strengths
2. Missing pieces or gaps
3. Color harmony assessment
4. Specific recommendations for improvement`;

  return prompt;
}

// Combine AI insights with rule-based analysis
function combineAnalyses(items: WardrobeItem[], categories: any, colors: any, aiInsights: string, styleGoal?: string) {
  const ruleBasedAnalysis = performRuleBasedAnalysis(items, categories, colors, styleGoal);
  
  // Try to extract specific insights from AI response
  const enhancedRecommendations = [
    ...ruleBasedAnalysis.recommendations,
    ...extractRecommendationsFromAI(aiInsights)
  ];

  return {
    ...ruleBasedAnalysis,
    summary: `Your wardrobe contains ${items.length} items across ${Object.keys(categories).length} categories. ${aiInsights ? 'AI analysis suggests focusing on versatility and color coordination.' : ''}`,
    recommendations: [...new Set(enhancedRecommendations)].slice(0, 8) // Remove duplicates, limit to 8
  };
}

// Rule-based wardrobe analysis
function performRuleBasedAnalysis(items: WardrobeItem[], categories: any, colors: any, styleGoal?: string) {
  const strengths: string[] = [];
  const gaps: string[] = [];
  const recommendations: string[] = [];
  
  // Essential categories analysis
  const essentialCategories = ['tops', 'bottoms', 'shoes', 'outerwear'];
  const presentCategories = Object.keys(categories);
  
  essentialCategories.forEach(essential => {
    if (presentCategories.some(cat => cat.includes(essential))) {
      strengths.push(`Good ${essential} selection`);
    } else {
      gaps.push(`Missing ${essential}`);
      recommendations.push(`Add versatile ${essential} pieces`);
    }
  });

  // Color analysis
  const colorNames = Object.keys(colors);
  const dominantColors = Object.entries(colors)
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .slice(0, 3)
    .map(([color]) => color);

  const neutralColors = colorNames.filter(color => 
    ['black', 'white', 'gray', 'grey', 'navy', 'beige', 'brown'].includes(color)
  );

  let colorHarmony = 'Good';
  if (neutralColors.length >= 3) {
    colorHarmony = 'Excellent';
    strengths.push('Strong neutral color foundation');
  } else if (neutralColors.length === 0) {
    colorHarmony = 'Needs improvement';
    gaps.push('Lacks neutral colors');
    recommendations.push('Add neutral basics (black, white, navy)');
  }

  // Versatility score calculation
  const versatilityScore = calculateVersatilityScore(categories, colors, items.length);

  // Missing colors recommendations
  const basicColors = ['black', 'white', 'navy'];
  const missingColors = basicColors.filter(color => !colorNames.includes(color));

  if (missingColors.length > 0) {
    recommendations.push(`Add ${missingColors.join(', ')} pieces for versatility`);
  }

  // Style-specific recommendations
  if (styleGoal) {
    recommendations.push(...getStyleGoalRecommendations(styleGoal, categories));
  }

  return {
    summary: `Your wardrobe contains ${items.length} items with a focus on ${dominantColors.join(', ')} colors.`,
    strengths,
    gaps,
    recommendations: recommendations.slice(0, 6),
    color_analysis: {
      dominant_colors: dominantColors,
      missing_colors: missingColors,
      color_harmony: colorHarmony
    },
    versatility_score: versatilityScore
  };
}

// Calculate versatility score (0-100)
function calculateVersatilityScore(categories: any, colors: any, totalItems: number): number {
  let score = 50; // Base score

  // Category diversity bonus
  const categoryCount = Object.keys(categories).length;
  score += Math.min(categoryCount * 5, 25);

  // Neutral colors bonus
  const neutralCount = Object.keys(colors).filter(color => 
    ['black', 'white', 'gray', 'grey', 'navy', 'beige'].includes(color)
  ).length;
  score += Math.min(neutralCount * 8, 25);

  // Item count consideration
  if (totalItems >= 20) score += 10;
  else if (totalItems >= 10) score += 5;

  return Math.min(Math.max(score, 0), 100);
}

// Extract recommendations from AI text
function extractRecommendationsFromAI(aiText: string): string[] {
  const recommendations: string[] = [];
  
  // Look for common recommendation patterns
  const patterns = [
    /add (.*?)[.!]/gi,
    /consider (.*?)[.!]/gi,
    /invest in (.*?)[.!]/gi,
    /get (.*?)[.!]/gi
  ];

  patterns.forEach(pattern => {
    const matches = aiText.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const rec = match.replace(/add |consider |invest in |get /i, '').replace(/[.!]$/, '');
        if (rec.length > 5 && rec.length < 80) {
          recommendations.push(rec.charAt(0).toUpperCase() + rec.slice(1));
        }
      });
    }
  });

  return recommendations.slice(0, 4);
}

// Get style-specific recommendations
function getStyleGoalRecommendations(styleGoal: string, categories: any): string[] {
  const goal = styleGoal.toLowerCase();
  
  if (goal.includes('professional') || goal.includes('business')) {
    return [
      'Add tailored blazers',
      'Invest in quality dress shoes',
      'Get well-fitted dress pants'
    ];
  }
  
  if (goal.includes('casual') || goal.includes('relaxed')) {
    return [
      'Add comfortable jeans',
      'Get versatile sneakers',
      'Include cozy sweaters'
    ];
  }
  
  if (goal.includes('elegant') || goal.includes('sophisticated')) {
    return [
      'Add classic dresses',
      'Invest in quality accessories',
      'Get timeless outerwear'
    ];
  }
  
  return [
    'Build a capsule wardrobe',
    'Focus on quality basics',
    'Add versatile accessories'
  ];
}

// Generate fallback analysis when AI is unavailable
function generateFallbackAnalysis(items: WardrobeItem[]) {
  if (!items || items.length === 0) {
    return {
      summary: 'No items provided for analysis.',
      strengths: [],
      gaps: ['Add wardrobe items to get analysis'],
      recommendations: ['Start with basic items like jeans, t-shirts, and comfortable shoes'],
      color_analysis: {
        dominant_colors: [],
        missing_colors: ['black', 'white', 'navy'],
        color_harmony: 'Unknown'
      },
      versatility_score: 0
    };
  }

  const categories = categorizeItems(items);
  const colors = extractColors(items);
  
  return performRuleBasedAnalysis(items, categories, colors);
}
