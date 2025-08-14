import { RequestHandler } from "express";

export const handleHealthCheck: RequestHandler = async (req, res) => {
  try {
    // Check environment variables
    const envCheck = {
      gemini: !!process.env.GEMINI_API_KEY,
      geminiKeyLength: process.env.GEMINI_API_KEY?.length || 0,
      nodeEnv: process.env.NODE_ENV
    };
    
    // Test Gemini AI if available
    let geminiStatus = 'not configured';
    if (process.env.GEMINI_API_KEY) {
      try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
        
        const result = await model.generateContent('Say "API test successful"');
        const response = await result.response;
        geminiStatus = 'working - ' + response.text().trim();
      } catch (error) {
        geminiStatus = 'error - ' + error.message;
      }
    }
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: envCheck,
      gemini: geminiStatus,
      server: 'running'
    });
    
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};
