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
    console.log('Testing Gemini API...');
    console.log('API Key exists:', !!process.env.GEMINI_API_KEY);
    console.log('API Key length:', process.env.GEMINI_API_KEY?.length || 0);
    console.log('API Key prefix:', process.env.GEMINI_API_KEY?.substring(0, 10) || 'none');

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY not found in environment' });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    console.log('GoogleGenerativeAI initialized');

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash-latest'  // Use the stable version
    });
    console.log('Model created');

    const result = await model.generateContent('Hello, how are you?');
    console.log('Content generated');

    const response = result.response;
    const text = response.text();
    console.log('Response text extracted:', text.substring(0, 100));

    return res.json({ 
      success: true, 
      response: text,
      debug: {
        apiKeyConfigured: true,
        apiKeyLength: process.env.GEMINI_API_KEY.length,
        modelUsed: 'gemini-1.5-flash-latest'
      }
    });

  } catch (error: any) {
    console.error('Detailed error:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    return res.status(500).json({ 
      error: 'Test failed',
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
