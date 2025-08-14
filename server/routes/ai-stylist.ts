import { RequestHandler } from "express";
import { 
  generateAIOutfitSuggestions, 
  analyzeClothingImage, 
  getPersonalStylingAdvice,
  analyzeWardrobeGaps,
  type ClothingItem,
  type StylePreferences,
  type OutfitSuggestion,
  type AnalyzedClothingItem
} from "../services/gemini";
import {
  validateBody,
  rateLimit,
  outfitGenerationSchema,
  stylingAdviceSchema,
  itemAnalysisSchema,
  wardrobeAnalysisSchema
} from "../middleware/validation";

// Enhanced outfit generation with Gemini AI
export const handleGenerateOutfits: RequestHandler = async (req, res) => {
  try {
    const { items, preferences, userProfile, maxOutfits = 1 } = req.body;

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: 'Invalid clothing items provided' });
    }

    if (!preferences) {
      return res.status(400).json({ error: 'Style preferences are required' });
    }

    // Validate that we have enough items
    if (items.length < 3) {
      return res.status(400).json({ 
        error: 'Insufficient items',
        message: 'At least 3 clothing items are required to generate outfits'
      });
    }

    // Skip individual item analysis for outfit generation to speed up the process
    // Use items as-is and let the AI work with basic item data
    const quickAnalyzedItems: AnalyzedClothingItem[] = items.map(item => ({
      ...item,
      ai_analysis: item.ai_analysis || {
        detailed_color: item.color || 'Unknown',
        style_category: typeof item.category === 'string' ? item.category : item.category?.name || 'General',
        formality_level: 5,
        season_appropriateness: ['spring', 'summer', 'fall', 'winter'],
        styling_notes: 'Versatile piece',
        versatility_score: 7
      }
    }));
    
    // Generate outfit suggestions using Gemini AI (fast mode - no individual analysis)
    const outfits = await generateAIOutfitSuggestions(quickAnalyzedItems, preferences, userProfile, maxOutfits);

    if (outfits.length === 0) {
      return res.json({
        outfits: [],
        message: 'No suitable outfit combinations found. Try adjusting your preferences or adding more items to your wardrobe.',
        analyzedItems: quickAnalyzedItems // Return the analyzed items for future use
      });
    }

    // Also get wardrobe gap analysis
    const wardrobeAnalysis = await analyzeWardrobeGaps(quickAnalyzedItems, preferences);

    res.json({
      outfits,
      message: `Generated ${outfits.length} personalized outfit suggestion${outfits.length === 1 ? '' : 's'}`,
      preferences,
      wardrobeAnalysis,
      analyzedItems: quickAnalyzedItems // Return analyzed items to save for future requests
    });

  } catch (error) {
    console.error('Error generating AI outfits:', error);
    res.status(500).json({ 
      error: 'Failed to generate outfit suggestions',
      message: 'Our AI stylist is temporarily unavailable. Please try again in a few moments.'
    });
  }
};

// New endpoint for styling advice chat
export const handleStylingAdvice: RequestHandler = async (req, res) => {
  try {
    const { query, question, wardrobe, userProfile, preferences } = req.body;
    
    // Accept both 'query' and 'question' for backwards compatibility
    const userQuery = query || question;

    if (!userQuery) {
      return res.status(400).json({ error: 'Styling question is required' });
    }

    const advice = await getPersonalStylingAdvice(userQuery, wardrobe || [], userProfile);

    res.json({
      advice,
      query: userQuery,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in handleStylingAdvice route:', error);
    res.status(500).json({ 
      error: 'Failed to get styling advice',
      message: 'Our AI stylist is temporarily unavailable. Please try again in a few moments.'
    });
  }
};

// New endpoint for item analysis
export const handleAnalyzeItem: RequestHandler = async (req, res) => {
  try {
    const { imageUrl, existingData } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ error: 'Image URL is required' });
    }

    const analysis = await analyzeClothingImage(imageUrl, existingData);

    res.json({
      analysis,
      message: 'Item analyzed successfully'
    });

  } catch (error) {
    console.error('Error analyzing item:', error);
    res.status(500).json({ 
      error: 'Failed to analyze item',
      message: 'Our AI analysis is temporarily unavailable. Please try again in a few moments.'
    });
  }
};

// Wardrobe gap analysis endpoint
export const handleWardrobeAnalysis: RequestHandler = async (req, res) => {
  try {
    const { wardrobe, preferences } = req.body;

    if (!wardrobe || !Array.isArray(wardrobe)) {
      return res.status(400).json({ error: 'Wardrobe items are required' });
    }

    const analysis = await analyzeWardrobeGaps(wardrobe, preferences);

    res.json({
      analysis,
      message: 'Wardrobe analysis completed'
    });

  } catch (error) {
    console.error('Error analyzing wardrobe:', error);
    res.status(500).json({ 
      error: 'Failed to analyze wardrobe',
      message: 'Our AI analysis is temporarily unavailable. Please try again in a few moments.'
    });
  }
};
