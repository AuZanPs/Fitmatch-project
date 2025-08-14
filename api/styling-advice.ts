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
      query, 
      question, 
      wardrobe = [], 
      wardrobeItems = [],
      userProfile = {}, 
      preferences = {}
    } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Gemini API key not configured' });
    }

    // Support backwards compatibility - check for both query and question
    const userQuestion = query || question;
    
    if (!userQuestion) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // Use the stable Gemini model with settings optimized for conversational styling advice
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash-latest',  // Use stable version instead of 2.5
      generationConfig: {
        temperature: 0.8, // Higher temperature for more creative and conversational responses
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 4096, // Larger output for detailed advice
      }
    });

    // Build comprehensive context for sophisticated AI response
    let contextInfo = '';
    const wardrobeData = wardrobe.length > 0 ? wardrobe : wardrobeItems;
    
    if (wardrobeData && wardrobeData.length > 0) {
      contextInfo += `\nUSER'S WARDROBE (${wardrobeData.length} items):\n`;
      wardrobeData.forEach((item, index) => {
        const category = typeof item.category === 'string' ? item.category : item.category?.name || 'Item';
        const tags = item.clothing_item_style_tags?.map(tag => tag.style_tag.name).join(', ') || '';
        contextInfo += `${index + 1}. ${category}: ${item.color || 'Color not specified'} ${item.brand || ''} ${tags ? `(${tags})` : ''}\n`;
      });
    }

    if (userProfile && Object.keys(userProfile).length > 0) {
      contextInfo += `\nUSER PROFILE:\n`;
      if (userProfile.age) contextInfo += `- Age: ${userProfile.age}\n`;
      if (userProfile.style_preference) contextInfo += `- Style inspiration: ${userProfile.style_preference}\n`;
      if (userProfile.gender) contextInfo += `- Gender: ${userProfile.gender}\n`;
    }

    if (preferences && Object.keys(preferences).length > 0) {
      contextInfo += `\nSTYLE PREFERENCES:\n`;
      if (preferences.occasion) contextInfo += `- Preferred occasions: ${preferences.occasion}\n`;
      if (preferences.weather) contextInfo += `- Weather considerations: ${preferences.weather}\n`;
      if (preferences.style) contextInfo += `- Style preference: ${preferences.style}\n`;
      if (preferences.colors) contextInfo += `- Color preferences: ${preferences.colors.join(', ')}\n`;
    }

    // Sophisticated prompt matching your original local setup quality
    const prompt = `You are an expert personal fashion stylist and style consultant with extensive knowledge of:
- Color theory and seasonal color analysis
- Body type and proportion guidelines
- Current fashion trends and timeless style principles
- Fabric care and wardrobe investment strategies
- Personal shopping and styling techniques

A client has asked you: "${userQuestion}"
${contextInfo}

INSTRUCTIONS:
1. Provide sophisticated, personalized styling advice based on their specific wardrobe and profile
2. Be specific and actionable - reference actual items from their wardrobe when relevant
3. Consider their lifestyle, preferences, and any context provided
4. Offer creative alternatives and explain your professional reasoning
5. Be encouraging and confidence-building in your tone
6. If suggesting new purchases, be mindful of building a cohesive wardrobe
7. Include specific styling formulas, color combinations, or professional techniques
8. Share insider styling tips that demonstrate your expertise

Respond as a knowledgeable, friendly personal stylist who truly understands fashion and wants to help them look and feel their best.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const adviceText = response.text();

    // Process the advice to extract actionable insights (maintaining your original quality)
    const advice = {
      answer: adviceText,
      confidence: 0.95, // High confidence for expert styling advice
      tips: extractActionableTips(adviceText),
      relevant_items: findRelevantWardrobeItems(adviceText, wardrobeData),
      styling_category: categorizeAdvice(userQuestion),
      timestamp: new Date().toISOString()
    };

    res.status(200).json({
      advice: adviceText, // Frontend expects this to be a string
      question: userQuestion,
      context_used: contextInfo ? true : false,
      wardrobe_items_referenced: wardrobeData.length,
      // Include the detailed analysis as separate fields
      confidence: advice.confidence,
      tips: advice.tips,
      relevant_items: advice.relevant_items,
      styling_category: advice.styling_category,
      timestamp: advice.timestamp
    });

  } catch (error: any) {
    console.error('Styling advice error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      geminiConfigured: !!process.env.GEMINI_API_KEY,
      keyLength: process.env.GEMINI_API_KEY?.length || 0
    });
    res.status(500).json({ 
      error: 'Failed to generate styling advice',
      message: 'Our AI stylist is temporarily unavailable. Please try again in a few moments.',
      debug: process.env.NODE_ENV === 'development' ? {
        errorMessage: error.message,
        geminiConfigured: !!process.env.GEMINI_API_KEY
      } : undefined
    });
  }
}

// Helper function to extract actionable styling tips from the advice text
function extractActionableTips(text: string): string[] {
  const tips: string[] = [];
  
  // Look for various tip patterns in the sophisticated response
  const tipPatterns = [
    /(\d+\.\s+[^.\n]{20,200})/g,
    /([•\-\*]\s+[^.\n]{20,200})/g,
    /(Try\s+[^.\n]{15,150})/gi,
    /(Consider\s+[^.\n]{15,150})/gi,
    /(Pro tip:?\s+[^.\n]{15,150})/gi,
    /(Style tip:?\s+[^.\n]{15,150})/gi
  ];

  for (const pattern of tipPatterns) {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const cleanTip = match.replace(/^\d+\.\s*|^[•\-\*]\s*|^(Pro tip|Style tip):?\s*/i, '').trim();
        if (cleanTip.length > 15 && cleanTip.length < 200 && !tips.some(tip => tip.includes(cleanTip.slice(0, 20)))) {
          tips.push(cleanTip);
        }
      });
    }
  }

  // If no specific tips found, extract the most actionable sentences
  if (tips.length === 0) {
    const sentences = text.split(/[.!?]+/).filter(s => 
      s.length > 25 && s.length < 200 && 
      (s.includes('try') || s.includes('wear') || s.includes('pair') || s.includes('choose'))
    );
    tips.push(...sentences.slice(0, 4).map(s => s.trim()));
  }

  return tips.slice(0, 6); // Return top 6 actionable tips
}

// Helper function to find wardrobe items mentioned in the advice
function findRelevantWardrobeItems(text: string, wardrobeItems: any[]): string[] {
  if (!wardrobeItems || wardrobeItems.length === 0) return [];

  const relevantIds: string[] = [];
  const lowerText = text.toLowerCase();

  wardrobeItems.forEach(item => {
    const category = typeof item.category === 'string' ? item.category : item.category?.name || '';
    const itemTerms = [
      category.toLowerCase(),
      item.color?.toLowerCase(),
      item.brand?.toLowerCase(),
      ...(item.clothing_item_style_tags?.map(tag => tag.style_tag.name.toLowerCase()) || [])
    ].filter(Boolean);

    const isRelevant = itemTerms.some(term => 
      term && lowerText.includes(term)
    );

    if (isRelevant && !relevantIds.includes(item.id)) {
      relevantIds.push(item.id);
    }
  });

  return relevantIds;
}

// Helper function to categorize the type of styling advice
function categorizeAdvice(question: string): string {
  const lowerQuestion = question.toLowerCase();
  
  if (lowerQuestion.includes('color') || lowerQuestion.includes('colours')) return 'color_advice';
  if (lowerQuestion.includes('occasion') || lowerQuestion.includes('event')) return 'occasion_styling';
  if (lowerQuestion.includes('body') || lowerQuestion.includes('figure')) return 'body_type_advice';
  if (lowerQuestion.includes('trend') || lowerQuestion.includes('fashion')) return 'trend_advice';
  if (lowerQuestion.includes('outfit') || lowerQuestion.includes('look')) return 'outfit_creation';
  if (lowerQuestion.includes('buy') || lowerQuestion.includes('shop')) return 'shopping_advice';
  
  return 'general_styling';
}