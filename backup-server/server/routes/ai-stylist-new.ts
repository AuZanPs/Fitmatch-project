import { RequestHandler } from "express";
import { 
  analyzeClothingItem,
  chatWithFashionAI,
  checkRateLimit,
  isHuggingFaceConfigured
} from "../services/huggingface";

// Simple outfit generation (redirect to API endpoint)
export const handleGenerateOutfits: RequestHandler = async (req, res) => {
  try {
    // Redirect to the new API endpoint
    res.status(200).json({
      message: "Please use /api/generate-outfits endpoint for outfit generation",
      redirect: "/api/generate-outfits"
    });
  } catch (error: any) {
    console.error('Outfit generation error:', error);
    res.status(500).json({ 
      error: 'Failed to generate outfits',
      message: error.message 
    });
  }
};

// Simple styling advice (redirect to API endpoint)
export const handleStylingAdvice: RequestHandler = async (req, res) => {
  try {
    // Redirect to the new API endpoint
    res.status(200).json({
      message: "Please use /api/styling-advice endpoint for styling advice",
      redirect: "/api/styling-advice"
    });
  } catch (error: any) {
    console.error('Styling advice error:', error);
    res.status(500).json({ 
      error: 'Failed to get styling advice',
      message: error.message 
    });
  }
};

// Simple item analysis using Hugging Face
export const handleItemAnalysis: RequestHandler = async (req, res) => {
  try {
    if (!isHuggingFaceConfigured()) {
      return res.status(500).json({ error: 'Hugging Face API not configured' });
    }

    if (!checkRateLimit()) {
      return res.status(429).json({ error: 'Rate limit exceeded' });
    }

    const { imageUrl, existingData = {} } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ error: 'Image URL is required' });
    }

    const analysis = await analyzeClothingItem(imageUrl);
    
    res.status(200).json({
      success: true,
      analysis: {
        ...existingData,
        ...analysis,
        analyzedAt: new Date().toISOString()
      }
    });
  } catch (error: any) {
    console.error('Item analysis error:', error);
    res.status(500).json({ 
      error: 'Failed to analyze item',
      message: error.message 
    });
  }
};

// Simple wardrobe analysis (redirect to API endpoint)
export const handleWardrobeAnalysis: RequestHandler = async (req, res) => {
  try {
    // Redirect to the new API endpoint
    res.status(200).json({
      message: "Please use /api/wardrobe-analysis endpoint for wardrobe analysis",
      redirect: "/api/wardrobe-analysis"
    });
  } catch (error: any) {
    console.error('Wardrobe analysis error:', error);
    res.status(500).json({ 
      error: 'Failed to analyze wardrobe',
      message: error.message 
    });
  }
};

// Health check for AI services
export const handleAIHealthCheck: RequestHandler = async (req, res) => {
  try {
    const huggingfaceConfigured = isHuggingFaceConfigured();
    
    res.status(200).json({
      status: 'healthy',
      services: {
        huggingface: {
          configured: huggingfaceConfigured,
          status: huggingfaceConfigured ? 'ready' : 'not configured'
        }
      },
      endpoints: {
        outfits: '/api/generate-outfits',
        advice: '/api/styling-advice',
        analysis: '/api/wardrobe-analysis',
        chat: '/api/styling-advice'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Health check error:', error);
    res.status(500).json({ 
      status: 'error',
      error: error.message 
    });
  }
};
