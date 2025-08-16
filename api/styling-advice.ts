import type { VercelRequest, VercelResponse } from '@vercel/node';

interface StylingRequest {
  question: string;
  context?: {
    occasion?: string;
    body_type?: string;
    style_preference?: string;
    wardrobe_items?: string[];
    budget?: string;
  };
}

interface StylingResponse {
  success: boolean;
  advice?: string;
  suggestions?: string[];
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
    const { question, context }: StylingRequest = req.body;

    if (!question) {
      return res.status(400).json({
        success: false,
        error: 'Question is required'
      });
    }

    // Build context-aware prompt
    let prompt = `You are a professional fashion stylist with years of experience. A client is asking for advice.

Client Question: "${question}"`;

    if (context) {
      prompt += `\n\nClient Context:`;
      if (context.occasion) prompt += `\n- Occasion: ${context.occasion}`;
      if (context.body_type) prompt += `\n- Body type: ${context.body_type}`;
      if (context.style_preference) prompt += `\n- Style preference: ${context.style_preference}`;
      if (context.wardrobe_items?.length) prompt += `\n- Current wardrobe: ${context.wardrobe_items.join(', ')}`;
      if (context.budget) prompt += `\n- Budget: ${context.budget}`;
    }

    prompt += `\n\nProvide helpful, specific fashion advice. Be encouraging and practical. Include specific styling tips and suggestions.`;

    // Call Hugging Face conversational AI
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
            max_length: 300,
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
    const advice = result[0]?.generated_text || '';

    // Extract actionable suggestions
    const suggestions = extractSuggestions(advice, question);

    return res.status(200).json({
      success: true,
      advice: advice || generateFallbackAdvice(question, context),
      suggestions
    });

  } catch (error) {
    console.error('Styling advice error:', error);
    
    // Provide fallback advice
    const fallbackAdvice = generateFallbackAdvice(req.body.question, req.body.context);
    
    return res.status(200).json({
      success: true,
      advice: fallbackAdvice,
      suggestions: extractSuggestions(fallbackAdvice, req.body.question),
      note: 'Using fallback recommendations due to AI service unavailability'
    });
  }
}

// Extract actionable suggestions from advice text
function extractSuggestions(advice: string, question: string): string[] {
  const suggestions: string[] = [];
  
  // Common fashion advice patterns
  const patterns = [
    /try (.*?)[.!]/gi,
    /consider (.*?)[.!]/gi,
    /wear (.*?)[.!]/gi,
    /choose (.*?)[.!]/gi,
    /add (.*?)[.!]/gi,
    /pair (.*?)[.!]/gi
  ];

  patterns.forEach(pattern => {
    const matches = advice.match(pattern);
    if (matches) {
      matches.forEach(match => {
        const suggestion = match.replace(/try |consider |wear |choose |add |pair /i, '').replace(/[.!]$/, '');
        if (suggestion.length > 5 && suggestion.length < 100) {
          suggestions.push(suggestion.charAt(0).toUpperCase() + suggestion.slice(1));
        }
      });
    }
  });

  // If no suggestions found, create some based on question type
  if (suggestions.length === 0) {
    suggestions.push(...generateContextualSuggestions(question));
  }

  return suggestions.slice(0, 5); // Limit to 5 suggestions
}

// Generate suggestions based on question type
function generateContextualSuggestions(question: string): string[] {
  const q = question.toLowerCase();
  
  if (q.includes('color') || q.includes('colour')) {
    return [
      'Stick to a cohesive color palette',
      'Use the color wheel for complementary combinations',
      'Consider your skin tone when choosing colors'
    ];
  }
  
  if (q.includes('body') || q.includes('figure') || q.includes('shape')) {
    return [
      'Choose clothes that fit well rather than following trends',
      'Highlight your favorite features',
      'Consider proportions and silhouettes'
    ];
  }
  
  if (q.includes('work') || q.includes('office') || q.includes('professional')) {
    return [
      'Invest in quality basics',
      'Keep accessories minimal and elegant',
      'Ensure clothes are well-tailored'
    ];
  }
  
  if (q.includes('casual') || q.includes('everyday')) {
    return [
      'Focus on comfort and versatility',
      'Mix textures for visual interest',
      'Layer pieces for different looks'
    ];
  }
  
  return [
    'Choose quality over quantity',
    'Ensure proper fit',
    'Build a cohesive wardrobe'
  ];
}

// Generate fallback advice when AI is unavailable
function generateFallbackAdvice(question: string, context?: any): string {
  const q = question.toLowerCase();
  
  if (q.includes('color')) {
    return "When choosing colors, consider your skin tone and the occasion. Neutral colors like black, white, gray, and navy are versatile and easy to mix and match. For a pop of color, choose one accent piece and keep the rest neutral.";
  }
  
  if (q.includes('body') || q.includes('shape')) {
    return "The most important thing is to wear clothes that fit well and make you feel confident. Focus on highlighting the features you love about yourself. Well-fitted clothes in quality fabrics will always look better than trendy pieces that don't fit properly.";
  }
  
  if (q.includes('work') || q.includes('professional')) {
    return "For professional settings, invest in quality basics: well-fitted blazers, dress pants, button-down shirts, and comfortable yet polished shoes. Keep colors neutral and accessories minimal. The key is looking put-together and confident.";
  }
  
  if (q.includes('casual')) {
    return "For casual wear, prioritize comfort and versatility. Good jeans, comfortable sneakers, and classic t-shirts or sweaters form a great foundation. Add layers and accessories to change up your look throughout the week.";
  }
  
  if (q.includes('occasion') || q.includes('event')) {
    return "When dressing for special occasions, consider the venue, time of day, and dress code. It's better to be slightly overdressed than underdressed. Choose one statement piece and keep everything else simple and elegant.";
  }
  
  return "Great question! The key to good style is wearing clothes that fit well, make you feel confident, and are appropriate for the occasion. Focus on building a wardrobe with versatile pieces that you can mix and match. Quality basics will serve you better than trendy pieces that quickly go out of style.";
}
