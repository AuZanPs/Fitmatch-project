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
    const { items, wardrobe, userProfile = {}, focusArea = 'overall', preferences = {} } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Gemini API key not configured' });
    }

    // Support both 'items' and 'wardrobe' for backwards compatibility
    const wardrobeItems = items || wardrobe;

    if (!wardrobeItems || !Array.isArray(wardrobeItems)) {
      return res.status(400).json({ error: 'Wardrobe items are required for analysis' });
    }

    if (wardrobeItems.length === 0) {
      return res.status(400).json({ 
        error: 'Empty wardrobe',
        message: 'Please add some clothing items to your wardrobe to get an analysis'
      });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash-latest',
      generationConfig: {
        temperature: 0.4,
        topP: 0.8,
        topK: 40,
        maxOutputTokens: 4096,
      }
    });

    // Categorize items for analysis
    const itemsByCategory = {};
    const colorDistribution = {};
    const brandCount = {};
    const seasonalItems = { spring: 0, summer: 0, fall: 0, winter: 0, year_round: 0 };

    wardrobeItems.forEach(item => {
      // Category distribution
      const category = item.category || 'uncategorized';
      itemsByCategory[category] = (itemsByCategory[category] || 0) + 1;

      // Color distribution
      const color = item.color || 'unspecified';
      colorDistribution[color] = (colorDistribution[color] || 0) + 1;

      // Brand distribution
      if (item.brand) {
        brandCount[item.brand] = (brandCount[item.brand] || 0) + 1;
      }

      // Basic seasonal categorization
      if (item.category) {
        const cat = item.category.toLowerCase();
        if (cat.includes('coat') || cat.includes('sweater') || cat.includes('boot')) {
          seasonalItems.winter++;
        } else if (cat.includes('shorts') || cat.includes('tank') || cat.includes('sandal')) {
          seasonalItems.summer++;
        } else {
          seasonalItems.year_round++;
        }
      }
    });

    // Build detailed wardrobe inventory for AI
    const wardrobeInventory = wardrobeItems.map((item, index) => 
      `${index + 1}. ${item.category || 'Item'}: ${item.color || 'Color not specified'} ${item.brand || 'No brand'} ${item.style ? '(' + item.style + ')' : ''}`
    ).join('\n');

    // Build user context
    let userContext = '';
    if (userProfile && Object.keys(userProfile).length > 0) {
      userContext = `\nUSER PROFILE:
- Age: ${userProfile.age || 'not specified'}
- Style inspiration: ${userProfile.style_inspiration || 'versatile'}
- Lifestyle: ${userProfile.lifestyle || 'active'}
- Body type: ${userProfile.body_type || 'not specified'}
- Budget range: ${userProfile.budget_range || 'not specified'}`;
    }

    if (preferences && Object.keys(preferences).length > 0) {
      userContext += `\nUSER PREFERENCES:
- Style: ${preferences.style || 'any'}
- Occasion: ${preferences.occasion || 'any'}
- Weather: ${preferences.weather || 'any'}`;
    }

    const prompt = `You are an expert fashion consultant and wardrobe analyst. Analyze this user's wardrobe and provide comprehensive insights.

WARDROBE INVENTORY (${wardrobeItems.length} items):
${wardrobeInventory}

WARDROBE STATISTICS:
- Categories: ${Object.keys(itemsByCategory).join(', ')} (${Object.keys(itemsByCategory).length} types)
- Color palette: ${Object.keys(colorDistribution).join(', ')} (${Object.keys(colorDistribution).length} colors)
- Brands: ${Object.keys(brandCount).length} different brands
- Seasonal distribution: ${seasonalItems.winter} winter, ${seasonalItems.summer} summer, ${seasonalItems.year_round} year-round items
${userContext}

ANALYSIS FOCUS: ${focusArea}

Provide a comprehensive wardrobe analysis including:

1. **Overall Assessment** (score 0-100 and explanation)
2. **Strengths** - What works well in this wardrobe
3. **Gaps & Weaknesses** - What's missing or problematic
4. **Color Analysis** - Color harmony, coordination opportunities, missing colors
5. **Style Consistency** - How cohesive the wardrobe is
6. **Versatility Score** - How many outfit combinations are possible
7. **Seasonal Coverage** - Appropriateness for different seasons
8. **Investment Priorities** - Top 3-5 items to add for maximum impact
9. **Organization Tips** - How to better organize and use the wardrobe
10. **Styling Opportunities** - Specific outfit combinations to try

Return as JSON in this exact structure:
{
  "overall_score": 0-100,
  "overall_assessment": "detailed explanation",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "gaps": ["gap 1", "gap 2", "gap 3"],
  "color_analysis": {
    "dominant_colors": ["color1", "color2"],
    "missing_colors": ["color3", "color4"],
    "harmony_score": 0-100,
    "recommendations": "color recommendations"
  },
  "style_consistency": {
    "score": 0-100,
    "description": "style analysis"
  },
  "versatility": {
    "score": 0-100,
    "possible_outfits": estimated_number,
    "description": "versatility explanation"
  },
  "seasonal_coverage": {
    "spring": 0-100,
    "summer": 0-100,
    "fall": 0-100,
    "winter": 0-100,
    "recommendations": "seasonal recommendations"
  },
  "investment_priorities": [
    {
      "item": "specific item recommendation",
      "reason": "why this item is needed",
      "impact": "how it improves the wardrobe",
      "priority": 1-5
    }
  ],
  "organization_tips": ["tip1", "tip2", "tip3"],
  "styling_opportunities": [
    {
      "outfit_name": "outfit name",
      "items": ["item_id_1", "item_id_2", "item_id_3"],
      "occasion": "when to wear",
      "styling_notes": "how to style"
    }
  ]
}`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Parse and validate the analysis
    let analysis;
    try {
      const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        analysis = JSON.parse(cleanText);
      }

      // Validate and ensure all required fields exist
      analysis = {
        overall_score: Math.min(100, Math.max(0, analysis.overall_score || 75)),
        overall_assessment: analysis.overall_assessment || 'Your wardrobe shows good potential with room for strategic improvements.',
        strengths: Array.isArray(analysis.strengths) ? analysis.strengths : [
          'Good variety of basic pieces',
          'Decent color coordination',
          'Functional everyday items'
        ],
        gaps: Array.isArray(analysis.gaps) ? analysis.gaps : [
          'Missing versatile statement pieces',
          'Limited formal options',
          'Could use more layering pieces'
        ],
        color_analysis: {
          dominant_colors: analysis.color_analysis?.dominant_colors || Object.keys(colorDistribution).slice(0, 3),
          missing_colors: analysis.color_analysis?.missing_colors || ['navy', 'white', 'beige'],
          harmony_score: analysis.color_analysis?.harmony_score || 70,
          recommendations: analysis.color_analysis?.recommendations || 'Focus on building a cohesive color palette with neutral bases.'
        },
        style_consistency: {
          score: analysis.style_consistency?.score || 75,
          description: analysis.style_consistency?.description || 'Your wardrobe shows developing style direction with room for refinement.'
        },
        versatility: {
          score: analysis.versatility?.score || 70,
          possible_outfits: analysis.versatility?.possible_outfits || Math.floor(wardrobeItems.length * 1.5),
          description: analysis.versatility?.description || 'Good mixing and matching potential with strategic additions.'
        },
        seasonal_coverage: {
          spring: analysis.seasonal_coverage?.spring || 70,
          summer: analysis.seasonal_coverage?.summer || 75,
          fall: analysis.seasonal_coverage?.fall || 65,
          winter: analysis.seasonal_coverage?.winter || 60,
          recommendations: analysis.seasonal_coverage?.recommendations || 'Consider adding transitional pieces for better year-round coverage.'
        },
        investment_priorities: Array.isArray(analysis.investment_priorities) ? analysis.investment_priorities : [
          {
            item: 'Quality blazer',
            reason: 'Elevates any outfit from casual to business casual',
            impact: 'Dramatically increases outfit versatility',
            priority: 1
          },
          {
            item: 'Classic white button-down',
            reason: 'Essential building block for many outfits',
            impact: 'Adds polish and professional options',
            priority: 2
          }
        ],
        organization_tips: Array.isArray(analysis.organization_tips) ? analysis.organization_tips : [
          'Group similar items together',
          'Keep frequently worn pieces easily accessible',
          'Rotate seasonal items'
        ],
        styling_opportunities: Array.isArray(analysis.styling_opportunities) ? analysis.styling_opportunities : [
          {
            outfit_name: 'Casual Weekend',
            items: wardrobeItems.slice(0, 3).map(item => item.id),
            occasion: 'weekend errands, casual meetups',
            styling_notes: 'Layer for comfort and style'
          }
        ]
      };

    } catch (parseError) {
      console.error('JSON parsing failed:', parseError);
      console.log('AI Response:', text);
      
      // Fallback analysis
      analysis = {
        overall_score: 75,
        overall_assessment: 'Your wardrobe has good potential. The analysis shows a mix of practical pieces with opportunities for strategic improvements to enhance versatility and style.',
        strengths: [
          `Good variety with ${wardrobeItems.length} items across ${Object.keys(itemsByCategory).length} categories`,
          `Diverse color palette with ${Object.keys(colorDistribution).length} different colors`,
          'Practical everyday pieces'
        ],
        gaps: [
          'Could benefit from more versatile basics',
          'Limited formal or dressy options may be needed',
          'Consider adding transitional seasonal pieces'
        ],
        color_analysis: {
          dominant_colors: Object.keys(colorDistribution).slice(0, 3),
          missing_colors: ['navy', 'white', 'neutral tones'],
          harmony_score: 70,
          recommendations: 'Focus on building a cohesive color story with your existing pieces.'
        },
        style_consistency: {
          score: 75,
          description: 'Your wardrobe shows developing personal style with room to refine and focus.'
        },
        versatility: {
          score: 70,
          possible_outfits: Math.floor(wardrobeItems.length * 1.8),
          description: 'Good potential for mix-and-match combinations with your current pieces.'
        },
        seasonal_coverage: {
          spring: 75,
          summer: 80,
          fall: 65,
          winter: 60,
          recommendations: 'Consider adding layering pieces for better year-round adaptability.'
        },
        investment_priorities: [
          {
            item: 'Versatile blazer or cardigan',
            reason: 'Instantly elevates casual pieces',
            impact: 'Dramatically increases styling options',
            priority: 1
          },
          {
            item: 'Quality basic tees or blouses',
            reason: 'Foundation pieces for multiple outfits',
            impact: 'Increases outfit frequency and variety',
            priority: 2
          }
        ],
        organization_tips: [
          'Organize by category and color',
          'Keep most-worn items easily accessible',
          'Consider seasonal rotation system'
        ],
        styling_opportunities: [
          {
            outfit_name: 'Versatile Daily Look',
            items: wardrobeItems.slice(0, Math.min(3, wardrobeItems.length)).map(item => item.id),
            occasion: 'everyday wear, casual outings',
            styling_notes: 'Mix textures and layer for interest'
          }
        ]
      };
    }

    res.status(200).json({
      analysis,
      wardrobe_stats: {
        total_items: wardrobeItems.length,
        categories: Object.keys(itemsByCategory).length,
        colors: Object.keys(colorDistribution).length,
        brands: Object.keys(brandCount).length,
        category_breakdown: itemsByCategory,
        color_breakdown: colorDistribution
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error('Wardrobe analysis error:', error);
    res.status(500).json({ 
      error: 'Failed to analyze wardrobe',
      message: 'Our AI stylist is temporarily unavailable. Please try again in a few moments.'
    });
  }
}
