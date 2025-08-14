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

  try {
    console.log('Testing outfit generation...');
    console.log('API Key exists:', !!process.env.GEMINI_API_KEY);
    console.log('API Key length:', process.env.GEMINI_API_KEY?.length || 0);

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY not found in environment' });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    console.log('GoogleGenerativeAI initialized');

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash-latest',
      generationConfig: {
        temperature: 0.3,
        topP: 0.7,
        topK: 20,
        maxOutputTokens: 2048,
      }
    });
    console.log('Model created');

    // Simple test outfit generation
    const testItems = [
      { id: '1', category: 'shirt', color: 'blue' },
      { id: '2', category: 'pants', color: 'black' },
      { id: '3', category: 'shoes', color: 'brown' }
    ];

    const prompt = `You are a fashion stylist. Create 1 outfit suggestion from these items:
1. shirt: blue [ID: 1]
2. pants: black [ID: 2]  
3. shoes: brown [ID: 3]

Return JSON: {"name":"outfit name","item_ids":["1","2","3"],"description":"why this works"}`;

    console.log('Sending prompt to Gemini...');
    const result = await model.generateContent(prompt);
    console.log('Content generated');

    const response = result.response;
    const text = response.text();
    console.log('Response text:', text.substring(0, 200));

    return res.json({ 
      success: true, 
      response: text,
      debug: {
        apiKeyConfigured: true,
        apiKeyLength: process.env.GEMINI_API_KEY.length,
        modelUsed: 'gemini-1.5-flash-latest',
        testItems: testItems
      }
    });

  } catch (error: any) {
    console.error('Detailed outfit test error:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    return res.status(500).json({ 
      error: 'Outfit test failed',
      details: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        apiKeyExists: !!process.env.GEMINI_API_KEY,
        apiKeyLength: process.env.GEMINI_API_KEY?.length || 0
      }
    });
  }
}
