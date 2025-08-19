import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateWithGemini, buildWardrobeAnalysisPrompt, isGeminiConfigured } from '../shared/gemini';

interface WardrobeItem {
  id: string;
  category: string | { name: string };
  color?: string;
  brand?: string;
  image_url?: string;
  clothing_item_style_tags?: Array<{ style_tag: { name: string } }>;
}

interface WardrobeRequest {
  wardrobe: WardrobeItem[];
  preferences?: {
    style?: string;
    occasion?: string;
  };
  analysis_type?: 'full' | 'gaps' | 'suggestions' | 'color_analysis';
  style_goal?: string;
  budget?: string;
}

interface WardrobeResponse {
  success: boolean;
  analysis?: {
    overall_assessment: string;
    strengths: string[];
    gaps: string[];
    color_analysis: {
      dominant_colors: string[];
      missing_colors: string[];
      harmony_score: number;
      recommendations: string;
    };
    style_consistency: {
      score: number;
      description: string;
    };
    versatility: {
      score: number;
      possible_outfits: number;
      description: string;
    };
    seasonal_coverage?: {
      spring: number;
      summer: number;
      fall: number;
      winter: number;
      recommendations: string;
    };
    investment_priorities: Array<{
      item: string;
      reason: string;
      impact: string;
      priority: number;
    }>;
    organization_tips: string[];
    styling_opportunities?: Array<{
      outfit_name: string;
      items: string[];
      occasion: string;
      styling_notes: string;
    }>;
  };
  error?: string;
  rate_limited?: boolean;
  note?: string;
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
  
  if (requestCount >= 30) { // Rate limit for analysis
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
  if (!isGeminiConfigured()) {
    return res.status(500).json({
      success: false,
      error: 'Gemini API key not configured. Please add GEMINI_API_KEY to your environment variables.'
    });
  }

  try {
    const { wardrobe = [], preferences = {}, analysis_type = 'full', style_goal, budget }: WardrobeRequest = req.body;

    if (!wardrobe || !Array.isArray(wardrobe) || wardrobe.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Wardrobe array is required and must not be empty'
      });
    }

    let analysis;
    
    try {
      // Generate analysis with Gemini AI
      console.log(`🤖 Analyzing wardrobe with Gemini: ${wardrobe.length} items`);
      
      const prompt = buildWardrobeAnalysisPrompt(wardrobe, preferences);
      const aiResponse = await generateWithGemini(prompt, {
        temperature: 0.7,
        maxOutputTokens: 2000,
        useCache: true // Enable caching for performance
      });
      
      // Parse the JSON response from Gemini
      analysis = parseGeminiAnalysisResponse(aiResponse, wardrobe);
      
    } catch (error) {
      console.log('🔄 Gemini API error, using smart fallback analysis');
      console.error('Gemini error details:', error);
      
      // Use rule-based analysis when AI is down
      analysis = generateSmartAnalysis(wardrobe, preferences, style_goal);
    }

    return res.status(200).json({
      success: true,
      analysis
    });

  } catch (error) {
    console.error('Wardrobe analysis error:', error);
    
    // Provide fallback analysis
    const fallbackAnalysis = generateFallbackAnalysis(req.body.wardrobe || []);
    
    return res.status(200).json({
      success: true,
      analysis: fallbackAnalysis,
      note: 'Using fallback analysis due to AI service unavailability'
    });
  }
}

// Parse Gemini's JSON response
function parseGeminiAnalysisResponse(aiResponse: string, items: WardrobeItem[]) {
  try {
    // Try to extract JSON from the response
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }
    
    const parsedResponse = JSON.parse(jsonMatch[0]);
    
    // Ensure all required fields are present with defaults
    return {
      overall_assessment: parsedResponse.overall_assessment || `Your wardrobe contains ${items.length} items with good variety across different categories.`,
      strengths: Array.isArray(parsedResponse.strengths) ? parsedResponse.strengths : ['Good variety of pieces', 'Nice color coordination'],
      gaps: Array.isArray(parsedResponse.gaps) ? parsedResponse.gaps : ['Consider adding more basic pieces'],
      color_analysis: {
        dominant_colors: parsedResponse.color_analysis?.dominant_colors || extractDominantColors(items),
        missing_colors: parsedResponse.color_analysis?.missing_colors || ['black', 'white'],
        harmony_score: Math.min(Math.max(parsedResponse.color_analysis?.harmony_score || 75, 0), 100),
        recommendations: parsedResponse.color_analysis?.recommendations || 'Focus on building a cohesive color palette.'
      },
      style_consistency: {
        score: Math.min(Math.max(parsedResponse.style_consistency?.score || 70, 0), 100),
        description: parsedResponse.style_consistency?.description || 'Your style shows good consistency across pieces.'
      },
      versatility: {
        score: Math.min(Math.max(parsedResponse.versatility?.score || 75, 0), 100),
        possible_outfits: parsedResponse.versatility?.possible_outfits || Math.floor(items.length * 2.5),
        description: parsedResponse.versatility?.description || 'Your wardrobe offers good versatility for creating different looks.'
      },
      investment_priorities: Array.isArray(parsedResponse.investment_priorities) ? 
        parsedResponse.investment_priorities.slice(0, 5) : 
        generateDefaultInvestmentPriorities(items),
      organization_tips: Array.isArray(parsedResponse.organization_tips) ? 
        parsedResponse.organization_tips : 
        ['Organize by category', 'Keep similar colors together', 'Rotate seasonal items']
    };
    
  } catch (error) {
    console.error('Failed to parse Gemini analysis response:', error);
    // Fallback to smart analysis
    return generateSmartAnalysis(items, {}, '');
  }
}

// Generate smart analysis when AI is unavailable
function generateSmartAnalysis(items: WardrobeItem[], preferences: any, styleGoal?: string) {
  // Categorize items
  const categories = categorizeItems(items);
  const colors = extractColors(items);
  
  // Analyze strengths and gaps
  const { strengths, gaps } = analyzeWardrobeGaps(categories, items.length);
  
  // Generate investment priorities
  const investmentPriorities = generateInvestmentPriorities(categories, colors, gaps);
  
  // Calculate scores
  const versatilityScore = calculateVersatilityScore(categories, colors, items.length);
  const styleConsistencyScore = calculateStyleConsistencyScore(items);
  const colorHarmonyScore = calculateColorHarmonyScore(colors);
  
  return {
    overall_assessment: `Your wardrobe contains ${items.length} items across ${Object.keys(categories).length} different categories. ${getOverallAssessment(versatilityScore, styleConsistencyScore)}`,
    strengths,
    gaps,
    color_analysis: {
      dominant_colors: Object.keys(colors).slice(0, 3),
      missing_colors: getMissingEssentialColors(colors),
      harmony_score: colorHarmonyScore,
      recommendations: generateColorRecommendations(colors)
    },
    style_consistency: {
      score: styleConsistencyScore,
      description: getStyleConsistencyDescription(styleConsistencyScore)
    },
    versatility: {
      score: versatilityScore,
      possible_outfits: Math.floor(items.length * 2.2),
      description: getVersatilityDescription(versatilityScore)
    },
    investment_priorities: investmentPriorities,
    organization_tips: [
      'Group similar items together (all shirts, all pants)',
      'Organize by color within each category',
      'Keep frequently used items easily accessible',
      'Store out-of-season items separately'
    ]
  };
}

// Helper functions
function categorizeItems(items: WardrobeItem[]) {
  const categories: { [key: string]: number } = {};
  
  items.forEach(item => {
    const category = typeof item.category === 'string' ? item.category.toLowerCase() : item.category?.name?.toLowerCase() || 'other';
    categories[category] = (categories[category] || 0) + 1;
  });
  
  return categories;
}

function extractColors(items: WardrobeItem[]) {
  const colors: { [key: string]: number } = {};
  
  items.forEach(item => {
    if (item.color) {
      const color = item.color.toLowerCase();
      colors[color] = (colors[color] || 0) + 1;
    }
  });
  
  return colors;
}

function extractDominantColors(items: WardrobeItem[]): string[] {
  const colors = extractColors(items);
  return Object.entries(colors)
    .sort(([,a], [,b]) => (b as number) - (a as number))
    .slice(0, 3)
    .map(([color]) => color);
}

function analyzeWardrobeGaps(categories: any, totalItems: number) {
  const strengths: string[] = [];
  const gaps: string[] = [];
  
  const essentialCategories = {
    'tops': { min: 3, name: 'tops' },
    'bottoms': { min: 2, name: 'bottoms' },
    'shoes': { min: 2, name: 'shoes' },
    'outerwear': { min: 1, name: 'outerwear/jackets' }
  };
  
  Object.entries(essentialCategories).forEach(([key, config]) => {
    const count = Object.keys(categories).filter(cat => cat.includes(key)).reduce((sum, cat) => sum + categories[cat], 0);
    
    if (count >= config.min) {
      strengths.push(`Good selection of ${config.name} (${count} items)`);
    } else if (count === 0) {
      gaps.push(`Missing ${config.name} entirely`);
    } else {
      gaps.push(`Need more ${config.name} (only ${count} items)`);
    }
  });
  
  // Check for variety
  const categoryCount = Object.keys(categories).length;
  if (categoryCount >= 5) {
    strengths.push('Good variety across different categories');
  } else if (categoryCount < 3) {
    gaps.push('Limited variety in clothing categories');
  }
  
  return { strengths, gaps };
}

function generateInvestmentPriorities(categories: any, colors: any, gaps: string[]): Array<{
  item: string;
  reason: string;
  impact: string;
  priority: number;
}> {
  const priorities: Array<{
    item: string;
    reason: string;
    impact: string;
    priority: number;
  }> = [];
  
  // Check for missing basics
  const essentials = [
    { item: 'White button-down shirt', category: 'tops', reason: 'Versatile for both casual and formal occasions' },
    { item: 'Well-fitted jeans', category: 'bottoms', reason: 'Essential for casual wear' },
    { item: 'Black dress shoes', category: 'shoes', reason: 'Needed for formal occasions' },
    { item: 'Blazer or jacket', category: 'outerwear', reason: 'Instantly elevates any outfit' }
  ];
  
  let priority = 1;
  essentials.forEach(essential => {
    const hasCategory = Object.keys(categories).some(cat => cat.includes(essential.category));
    if (!hasCategory || categories[essential.category] < 2) {
      priorities.push({
        item: essential.item,
        reason: essential.reason,
        impact: 'High - will significantly increase outfit options',
        priority: priority++
      });
    }
  });
  
  // Color-based recommendations
  const neutralColors = ['black', 'white', 'gray', 'navy'];
  const missingNeutrals = neutralColors.filter(color => !colors[color]);
  
  if (missingNeutrals.length > 0) {
    priorities.push({
      item: `${missingNeutrals[0].charAt(0).toUpperCase() + missingNeutrals[0].slice(1)} basic pieces`,
      reason: 'Neutral colors are the foundation of a versatile wardrobe',
      impact: 'Medium - improves color coordination and mix-and-match potential',
      priority: priority++
    });
  }
  
  return priorities.slice(0, 5);
}

function generateDefaultInvestmentPriorities(items: WardrobeItem[]) {
  return [
    {
      item: 'Quality basic t-shirts',
      reason: 'Foundation pieces that work with everything',
      impact: 'High - essential for daily wear',
      priority: 1
    },
    {
      item: 'Well-fitted jeans',
      reason: 'Versatile for casual occasions',
      impact: 'High - can be dressed up or down',
      priority: 2
    },
    {
      item: 'Structured blazer',
      reason: 'Instantly elevates any casual outfit',
      impact: 'Medium - great for professional settings',
      priority: 3
    }
  ];
}

function calculateVersatilityScore(categories: any, colors: any, totalItems: number): number {
  let score = 50; // Base score
  
  // Category diversity bonus
  const categoryCount = Object.keys(categories).length;
  score += Math.min(categoryCount * 8, 40);
  
  // Color variety bonus
  const colorCount = Object.keys(colors).length;
  score += Math.min(colorCount * 5, 25);
  
  // Neutral colors bonus
  const neutrals = ['black', 'white', 'gray', 'navy'];
  const neutralCount = neutrals.filter(color => colors[color]).length;
  score += neutralCount * 8;
  
  // Item quantity consideration
  if (totalItems >= 15) score += 10;
  else if (totalItems >= 8) score += 5;
  
  return Math.min(Math.max(score, 0), 100);
}

function calculateStyleConsistencyScore(items: WardrobeItem[]): number {
  // This is a simplified calculation - in a real scenario, you'd analyze style tags
  const styleTags = items.flatMap(item => 
    item.clothing_item_style_tags?.map(tag => tag.style_tag.name) || []
  );
  
  if (styleTags.length === 0) return 60;
  
  // Count frequency of style tags
  const styleFrequency = styleTags.reduce((acc, style) => {
    acc[style] = (acc[style] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  // Calculate consistency based on how often the same styles appear
  const totalTags = styleTags.length;
  const dominantStyleCount = Math.max(...Object.values(styleFrequency));
  const consistencyRatio = dominantStyleCount / totalTags;
  
  return Math.round(consistencyRatio * 100);
}

function calculateColorHarmonyScore(colors: any): number {
  const colorNames = Object.keys(colors);
  const neutralColors = ['black', 'white', 'gray', 'grey', 'navy', 'beige', 'brown'];
  const neutralCount = colorNames.filter(color => 
    neutralColors.some(neutral => color.includes(neutral))
  ).length;
  
  let score = 60; // Base score
  
  // Bonus for having neutrals
  score += Math.min(neutralCount * 15, 40);
  
  // Small bonus for color variety (but not too much)
  if (colorNames.length >= 3 && colorNames.length <= 6) {
    score += 10;
  }
  
  return Math.min(Math.max(score, 0), 100);
}

function getMissingEssentialColors(colors: any): string[] {
  const essentialColors = ['black', 'white', 'navy'];
  return essentialColors.filter(color => !colors[color]);
}

function generateColorRecommendations(colors: any): string {
  const missing = getMissingEssentialColors(colors);
  if (missing.length === 0) {
    return 'Your color palette is well-balanced with good neutral foundation.';
  }
  return `Consider adding ${missing.join(' and ')} pieces to strengthen your neutral foundation and increase versatility.`;
}

function getOverallAssessment(versatilityScore: number, styleScore: number): string {
  const averageScore = (versatilityScore + styleScore) / 2;
  
  if (averageScore >= 80) {
    return 'Your wardrobe shows excellent balance and versatility.';
  } else if (averageScore >= 60) {
    return 'Your wardrobe has good potential with some room for strategic improvements.';
  } else {
    return 'There are several opportunities to enhance your wardrobe\'s versatility and style.';
  }
}

function getStyleConsistencyDescription(score: number): string {
  if (score >= 80) return 'Excellent style consistency across your wardrobe';
  if (score >= 60) return 'Good style consistency with some variety';
  return 'Mixed styles - consider focusing on a more cohesive aesthetic';
}

function getVersatilityDescription(score: number): string {
  if (score >= 80) return 'Highly versatile wardrobe with excellent mix-and-match potential';
  if (score >= 60) return 'Good versatility with solid outfit creation options';
  return 'Limited versatility - adding key pieces would greatly expand your options';
}

// Generate fallback analysis when everything fails
function generateFallbackAnalysis(items: WardrobeItem[]) {
  if (!items || items.length === 0) {
    return {
      overall_assessment: 'No items provided for analysis.',
      strengths: [],
      gaps: ['Add wardrobe items to get detailed analysis'],
      color_analysis: {
        dominant_colors: [],
        missing_colors: ['black', 'white', 'navy'],
        harmony_score: 0,
        recommendations: 'Start building your wardrobe with neutral colors'
      },
      style_consistency: {
        score: 0,
        description: 'Add items to assess style consistency'
      },
      versatility: {
        score: 0,
        possible_outfits: 0,
        description: 'Add items to calculate versatility'
      },
      investment_priorities: [
        {
          item: 'Basic t-shirts',
          reason: 'Start with versatile basics',
          impact: 'Foundation for your wardrobe',
          priority: 1
        }
      ],
      organization_tips: ['Start by categorizing items by type', 'Keep similar colors together']
    };
  }

  // Use smart analysis for fallback
  return generateSmartAnalysis(items, {}, '');
}
