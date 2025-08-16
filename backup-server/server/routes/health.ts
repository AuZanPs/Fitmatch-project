import { RequestHandler } from "express";

export const handleHealthCheck: RequestHandler = async (req, res) => {
  try {
    // Check environment variables
    const envCheck = {
      huggingface: !!process.env.HUGGINGFACE_API_KEY,
      huggingfaceKeyLength: process.env.HUGGINGFACE_API_KEY?.length || 0,
      nodeEnv: process.env.NODE_ENV
    };
    
    // Test Hugging Face API if available
    let huggingfaceStatus = 'not configured';
    if (process.env.HUGGINGFACE_API_KEY) {
      try {
        const response = await fetch(
          "https://api-inference.huggingface.co/models/microsoft/DialoGPT-medium",
          {
            headers: { 
              Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
              "Content-Type": "application/json"
            },
            method: "POST",
            body: JSON.stringify({
              inputs: "API test",
              parameters: { max_length: 10 }
            })
          }
        );
        
        if (response.ok) {
          huggingfaceStatus = 'working - API connection successful';
        } else {
          huggingfaceStatus = `error - HTTP ${response.status}`;
        }
      } catch (error: any) {
        huggingfaceStatus = 'error - ' + error.message;
      }
    }
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: envCheck,
      huggingface: huggingfaceStatus,
      aiProvider: 'Hugging Face',
      server: 'running'
    });
    
  } catch (error: any) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};
