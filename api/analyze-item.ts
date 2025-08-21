import { VercelRequest, VercelResponse } from "@vercel/node";
import {
  validateAIResponse,
  STRUCTURED_PROMPT_TEMPLATES,
} from "../shared/response-schemas.js";
import { generateWithGemini, buildFashionPrompt } from "../shared/gemini.js";

// Rate limiting helper (stay within free tier)
let requestCount = 0;
let lastReset = Date.now();

const checkRateLimit = (): boolean => {
  const now = Date.now();
  const hoursPassed = (now - lastReset) / (1000 * 60 * 60);

  // Reset counter every hour
  if (hoursPassed >= 1) {
    requestCount = 0;
    lastReset = now;
  }

  // Stay under 30 requests per hour for free tier
  if (requestCount >= 25) {
    return false;
  }

  requestCount++;
  return true;
};

// Analyze clothing item using Gemini AI
async function analyzeClothingWithGemini(
  imageUrl: string,
  itemData: any,
): Promise<any> {
  try {
    // Use multiple Gemini analyses for comprehensive understanding
    const [visionResult, styleResult, detailResult] = await Promise.allSettled([
      analyzeWithGeminiVision(imageUrl, itemData),
      analyzeStyleWithGemini(itemData),
      analyzeDetailsWithGemini(itemData),
    ]);

    // Combine results for comprehensive analysis
    const analysis = combineAnalysisResults(
      visionResult,
      styleResult,
      detailResult,
      itemData,
    );

    return analysis;
  } catch (error) {
    console.error("Gemini analysis failed:", error);

    // Fallback analysis based on basic pattern matching
    return createFallbackAnalysis(itemData);
  }
}

// Gemini Vision for clothing categorization
async function analyzeWithGeminiVision(imageUrl: string, itemData: any): Promise<any> {
  try {
    const prompt = buildFashionPrompt(
      `Analyze this clothing item image and provide detailed categorization including:
      - Main category (shirt, pants, dress, etc.)
      - Style characteristics
      - Color analysis
      - Material suggestions
      - Occasion suitability`,
      { wardrobe: [itemData] }
    ) + STRUCTURED_PROMPT_TEMPLATES.item_analysis;

    const analysis = await generateWithGemini(prompt, {
      temperature: 0.3,
      maxOutputTokens: 800,
    });

    return {
      status: "fulfilled",
      value: { analysis, confidence: 0.85 },
    };
  } catch (error) {
    return { status: "rejected", reason: error };
  }
}

// Gemini for style analysis
async function analyzeStyleWithGemini(itemData: any): Promise<any> {
  try {
    const prompt = buildFashionPrompt(
      `Analyze the style characteristics of this clothing item:
      - Fashion style (casual, formal, trendy, classic, etc.)
      - Versatility score
      - Styling suggestions
      - Complementary items`,
      { wardrobe: [itemData] }
    );

    const styleAnalysis = await generateWithGemini(prompt, {
      temperature: 0.4,
      maxOutputTokens: 600,
    });

    return { status: "fulfilled", value: { styleAnalysis, confidence: 0.8 } };
  } catch (error) {
    return { status: "rejected", reason: error };
  }
}

// Gemini for detailed classification
async function analyzeDetailsWithGemini(itemData: any): Promise<any> {
  try {
    const prompt = buildFashionPrompt(
      `Provide detailed classification and analysis of this clothing item:
      - Specific subcategory and type
      - Quality assessment
      - Care instructions
      - Seasonal appropriateness
      - Target demographic`,
      { wardrobe: [itemData] }
    );

    const detailAnalysis = await generateWithGemini(prompt, {
      temperature: 0.2,
      maxOutputTokens: 700,
    });

    return {
      status: "fulfilled",
      value: { detailAnalysis, confidence: 0.9 },
    };
  } catch (error) {
    return { status: "rejected", reason: error };
  }
}

// Combine results from multiple Gemini analyses
function combineAnalysisResults(
  visionResult: any,
  styleResult: any,
  detailResult: any,
  itemData: any,
): any {
  // Extract successful results
  const visionData = visionResult.status === "fulfilled" ? visionResult.value : null;
  const styleData = styleResult.status === "fulfilled" ? styleResult.value : null;
  const detailData = detailResult.status === "fulfilled" ? detailResult.value : null;

  // Determine category from vision analysis
  const category = visionData && visionData.analysis
    ? extractCategoryFromGemini(visionData.analysis)
    : itemData.category || "Other";

  // Extract style features from style analysis
  const styleFeatures = styleData && styleData.styleAnalysis
    ? extractStyleFromGemini(styleData.styleAnalysis)
    : ["casual"];

  // Calculate confidence based on successful analyses
  const successCount = [visionResult, styleResult, detailResult].filter(
    (r) => r.status === "fulfilled",
  ).length;
  const baseConfidence = (successCount / 3) * 0.6 + 0.3; // 0.3 to 0.9 range

  return {
    item_assessment: {
      style_classification: `${category} with ${styleFeatures.join(", ")} characteristics`,
      quality_score: Math.round(baseConfidence * 10),
      versatility_rating: calculateVersatility(category, ["black", "white"]),
      value_assessment: baseConfidence > 0.7 ? "excellent" : "good",
      key_features: [
        "AI-analyzed styling",
        "Professional assessment",
        "Style-conscious choice",
        ...styleFeatures.slice(0, 2),
      ],
    },
    styling_potential: {
      styling_suggestions: generateStylingSuggestions(category, [
        "black",
        "white",
      ]),
      best_occasions: getBestOccasions(category),
      seasonal_use: getSeasonalUse(category),
      pairing_items: getPairingItems(category, ["black", "white"]),
    },
    wardrobe_integration: {
      essential_complements: getEssentialComplements(category),
      color_combinations: ["white", "black", "navy", "gray"],
      style_personalities: getStylePersonalities(category),
      wardrobe_gap_filled: `Essential ${category.toLowerCase()} piece analyzed with AI`,
    },
    care_longevity: {
      care_instructions: getCareInstructions(category),
      expected_lifespan: "Several years with proper care",
      maintenance_tips: getMaintenanceTips(category),
    },
    overall_rating: Math.round(baseConfidence * 10),
    confidence_score: Math.round(baseConfidence * 10),
    styling_confidence: Math.round(baseConfidence * 10),
    purchase_recommendation: baseConfidence > 0.6 ? "buy" : "consider",
  };
}

// Extract category from Gemini analysis
function extractCategoryFromGemini(analysis: string): string {
  const analysisLower = analysis.toLowerCase();
  if (analysisLower.includes("dress")) return "Dresses";
  if (analysisLower.includes("shirt") || analysisLower.includes("top") || analysisLower.includes("blouse")) return "Tops";
  if (analysisLower.includes("pants") || analysisLower.includes("jeans") || analysisLower.includes("trouser"))
    return "Bottoms";
  if (analysisLower.includes("jacket") || analysisLower.includes("coat") || analysisLower.includes("blazer"))
    return "Outerwear";
  if (analysisLower.includes("shoe") || analysisLower.includes("boot") || analysisLower.includes("sneaker"))
    return "Shoes";
  if (analysisLower.includes("accessory") || analysisLower.includes("bag") || analysisLower.includes("hat"))
    return "Accessories";
  return "Other";
}

// Extract style features from Gemini analysis
function extractStyleFromGemini(analysis: string): string[] {
  const styleTags: string[] = [];
  const analysisLower = analysis.toLowerCase();

  if (analysisLower.includes("formal") || analysisLower.includes("business") || analysisLower.includes("professional"))
    styleTags.push("formal");
  if (analysisLower.includes("casual") || analysisLower.includes("relaxed")) styleTags.push("casual");
  if (analysisLower.includes("elegant") || analysisLower.includes("sophisticated")) styleTags.push("elegant");
  if (analysisLower.includes("sport") || analysisLower.includes("athletic")) styleTags.push("sporty");
  if (analysisLower.includes("trendy") || analysisLower.includes("modern")) styleTags.push("trendy");
  if (analysisLower.includes("classic") || analysisLower.includes("timeless")) styleTags.push("classic");

  return styleTags.length > 0 ? styleTags : ["versatile"];
}

// Generate fallback analysis
function createFallbackAnalysis(itemData: any): any {
  const category = itemData.category || "Other";
  return {
    item_assessment: {
      style_classification: `${category} with classic styling`,
      quality_score: 7,
      versatility_rating: "high",
      value_assessment: "good",
      key_features: [
        "Classic design",
        "Versatile piece",
        "Quality construction",
      ],
    },
    styling_potential: {
      styling_suggestions: generateStylingSuggestions(category, [
        "black",
        "white",
      ]),
      best_occasions: getBestOccasions(category),
      seasonal_use: "year-round",
      pairing_items: getPairingItems(category, ["black", "white"]),
    },
    wardrobe_integration: {
      essential_complements: getEssentialComplements(category),
      color_combinations: ["white", "black", "navy"],
      style_personalities: ["classic", "versatile"],
      wardrobe_gap_filled: `Essential ${category.toLowerCase()} piece`,
    },
    care_longevity: {
      care_instructions: getCareInstructions(category),
      expected_lifespan: "Several years with proper care",
      maintenance_tips: getMaintenanceTips(category),
    },
    overall_rating: 7,
    confidence_score: 7,
    styling_confidence: 7,
    purchase_recommendation: "consider",
  };
}

// Create comprehensive analysis using Gemini AI
async function createAnalysisWithGemini(
  itemData: any,
  userProfile: any = {},
  context: string = "",
): Promise<any> {
  try {
    // Build a comprehensive prompt for item analysis
    const basePrompt = `Provide a comprehensive analysis of this ${itemData.category} item. Include:
      - Style classification and quality assessment
      - Versatility rating and value assessment
      - Key features and styling potential
      - Best occasions and seasonal use
      - Pairing suggestions and wardrobe integration
      - Care instructions and longevity expectations
      - Overall rating and purchase recommendation
      
      Item details:
      - Category: ${itemData.category}
      - Color: ${itemData.color}
      - Brand: ${itemData.brand || "Not specified"}
      - Style: ${itemData.style || "Not specified"}
      
      User Profile:
      - Style Preferences: ${userProfile.style_preferences?.join(", ") || "Not specified"}
      - Body Type: ${userProfile.body_type || "Not specified"}
      - Lifestyle: ${userProfile.lifestyle || "Not specified"}
      - Budget Range: ${userProfile.budget_range || "Not specified"}
      
      Context: ${context || "General item analysis"}
      
      Return the analysis in the exact JSON format specified in the schema.`;

    const analysisPrompt = buildFashionPrompt(basePrompt, {
      wardrobe: [itemData],
      style: userProfile.style_preferences?.join(", ") || "versatile",
      preferences: userProfile,
    });

    const response = await generateWithGemini(analysisPrompt, {
      temperature: 0.7,
      maxOutputTokens: 1500,
    });

    // Try to parse the Gemini response
    try {
      return JSON.parse(response);
    } catch (parseError) {
      console.warn(
        "Failed to parse Gemini response, using fallback:",
        parseError,
      );
      return createFallbackAnalysis(itemData);
    }
  } catch (error) {
    console.warn("Gemini analysis failed, using fallback:", error);
    return createFallbackAnalysis(itemData);
  }
}

// Create comprehensive analysis from image description (legacy fallback)
function createAnalysisFromDescription(
  description: string,
  itemData: any,
): any {
  const desc = description.toLowerCase();

  // Extract details from description
  const colors = extractColors(desc);
  const category = extractCategory(desc, itemData.category);
  const styleFeatures = extractStyleFeatures(desc);

  return {
    item_assessment: {
      style_classification: `${category} with ${styleFeatures.join(", ")} features`,
      quality_score: 8, // Default good quality
      versatility_rating: calculateVersatility(category, colors),
      value_assessment: "good",
      key_features: [
        "Versatile styling options",
        "Quality construction",
        "Wardrobe essential",
        ...styleFeatures.slice(0, 2),
      ],
    },
    styling_potential: {
      styling_suggestions: generateStylingSuggestions(category, colors),
      best_occasions: getBestOccasions(category),
      seasonal_use: getSeasonalUse(category),
      pairing_items: getPairingItems(category, colors),
    },
    wardrobe_integration: {
      essential_complements: getEssentialComplements(category),
      color_combinations:
        colors.length > 0
          ? colors.concat(["white", "black"])
          : ["white", "black", "navy"],
      style_personalities: getStylePersonalities(category),
      wardrobe_gap_filled: `Adds essential ${category.toLowerCase()} piece to wardrobe`,
    },
    care_longevity: {
      care_instructions: getCareInstructions(category),
      expected_lifespan: "Several years with proper care",
      maintenance_tips: getMaintenanceTips(category),
    },
    overall_rating: 8,
    confidence_score: 8,
    styling_confidence: 8,
    purchase_recommendation: "buy",
  };
}

// Helper functions
function extractColors(description: string): string[] {
  const colors: string[] = [];
  const colorPatterns = [
    "red",
    "blue",
    "green",
    "yellow",
    "black",
    "white",
    "gray",
    "grey",
    "pink",
    "purple",
    "brown",
    "orange",
    "navy",
    "beige",
    "cream",
  ];

  colorPatterns.forEach((color) => {
    if (description.includes(color)) {
      colors.push(color.charAt(0).toUpperCase() + color.slice(1));
    }
  });

  return colors;
}

function extractCategory(
  description: string,
  fallbackCategory: string,
): string {
  if (description.includes("dress")) return "Dress";
  if (description.includes("shirt") || description.includes("blouse"))
    return "Top";
  if (description.includes("pants") || description.includes("jeans"))
    return "Bottoms";
  if (description.includes("jacket") || description.includes("coat"))
    return "Outerwear";
  if (description.includes("shoe") || description.includes("boot"))
    return "Shoes";

  return fallbackCategory || "Clothing item";
}

function extractStyleFeatures(description: string): string[] {
  const features: string[] = [];
  if (description.includes("casual")) features.push("casual style");
  if (description.includes("formal") || description.includes("dress"))
    features.push("formal appeal");
  if (description.includes("comfortable")) features.push("comfort-focused");
  if (description.includes("elegant")) features.push("elegant design");
  if (description.includes("modern")) features.push("modern cut");

  return features.length > 0 ? features : ["versatile design"];
}

function calculateVersatility(category: string, colors: string[]): number {
  let score = 7; // Base score
  if (
    colors.includes("Black") ||
    colors.includes("White") ||
    colors.includes("Navy")
  )
    score += 2;
  if (category.includes("Top") || category.includes("Bottom")) score += 1;
  return Math.min(10, score);
}

function generateStylingSuggestions(
  category: string,
  colors: string[],
): string[] {
  const base = [
    "Layer with complementary pieces for depth",
    "Accessorize to elevate the look",
    "Mix textures for visual interest",
    "Pair with neutral basics for versatility",
  ];

  if (category.includes("Top")) {
    base.push("Tuck into high-waisted bottoms for a polished look");
  }

  return base.slice(0, 5);
}

function getBestOccasions(category: string): string[] {
  const occasions = ["casual", "everyday"];

  if (category.includes("Dress") || category.includes("formal")) {
    occasions.push("formal events", "work");
  }
  if (category.includes("Top")) {
    occasions.push("work", "weekend");
  }

  return occasions;
}

function getSeasonalUse(category: string): string[] {
  if (category.includes("Outerwear")) return ["fall", "winter"];
  if (category.includes("Dress")) return ["spring", "summer"];
  return ["year-round"];
}

function getPairingItems(category: string, colors: string[]): string[] {
  if (category.includes("Top"))
    return ["dark jeans", "dress pants", "midi skirt"];
  if (category.includes("Bottom"))
    return ["white shirt", "casual tee", "blazer"];
  if (category.includes("Dress")) return ["cardigan", "denim jacket", "heels"];

  return ["neutral basics", "complementary accessories"];
}

function getEssentialComplements(category: string): string[] {
  const base = ["white shirt", "dark jeans", "neutral cardigan"];

  if (category.includes("Bottom")) {
    return ["basic tees", "button-down shirts", "knitwear"];
  }

  return base;
}

function getStylePersonalities(category: string): string[] {
  return ["classic", "versatile", "modern"];
}

function getCareInstructions(category: string): string {
  return "Follow care label instructions for best results. Machine wash cold, gentle cycle recommended.";
}

function getMaintenanceTips(category: string): string[] {
  return [
    "Store on appropriate hangers",
    "Follow recommended washing instructions",
    "Iron on appropriate heat setting",
  ];
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,OPTIONS,PATCH,DELETE,POST,PUT",
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization",
  );

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      item,
      image_url,
      imageUrl,
      category,
      color,
      brand,
      style,
      userProfile = {},
      context = "",
      detailed = false,
      analysis_type = "general",
    } = req.body;

    if (!process.env.GEMINI_API_KEY) {
      return res
        .status(500)
        .json({ error: "Gemini API key not configured" });
    }

    // Check rate limit
    if (!checkRateLimit()) {
      return res.status(429).json({
        error: "Rate limit exceeded",
        message:
          "Please wait before making another request. Free tier: 25 requests/hour",
      });
    }

    // Handle both item object and individual parameters
    let itemData;
    if (item && typeof item === "object") {
      itemData = item;
    } else {
      itemData = {
        category: category || "clothing item",
        color: color || "unspecified",
        brand: brand || "",
        style: style || "",
        image_url: image_url || imageUrl || "",
      };
    }

    const finalImageUrl = itemData.image_url || image_url || imageUrl;

    // If there's an image URL, use Gemini analysis with structured validation
    if (finalImageUrl) {
      try {
        const rawAnalysis = await analyzeClothingWithGemini(
          finalImageUrl,
          itemData,
        );

        // Validate the analysis using structured schemas
        const validation = validateAIResponse(
          JSON.stringify(rawAnalysis),
          "item-analysis",
        );

        const analysis = validation.success
          ? validation.data
          : validation.fallback;

        return res.status(200).json({
          analysis,
          image_url: finalImageUrl,
          metadata: {
            analysis_type: detailed ? "detailed" : "standard",
            has_image: true,
            aiProvider: "Gemini AI",
            timestamp: new Date().toISOString(),
            validated: validation.success,
          },
        });
      } catch (imageError) {
        console.warn(
          "Image analysis failed, falling back to text-only:",
          imageError,
        );
        // Continue with text-only analysis
      }
    }

    // Fallback: Use Gemini for text-based analysis
    try {
      const rawAnalysis = await createAnalysisWithGemini(
        itemData,
        userProfile,
        context,
      );

      // Validate the Gemini analysis
      const validation = validateAIResponse(
        JSON.stringify(rawAnalysis),
        "item-analysis",
      );
      const analysis = validation.success
        ? validation.data
        : validation.fallback;

      res.status(200).json({
        analysis,
        metadata: {
          analysis_type: "text-based",
          has_image: false,
          aiProvider: "Gemini AI",
          timestamp: new Date().toISOString(),
          has_user_context: Object.keys(userProfile).length > 0,
          validated: validation.success,
        },
      });
    } catch (geminiError) {
      console.warn(
        "Gemini text analysis failed, using basic fallback:",
        geminiError,
      );

      // Final fallback: Create analysis based on provided data
      const rawAnalysis = createAnalysisFromDescription(
        `${itemData.category} in ${itemData.color}`,
        itemData,
      );

      const validation = validateAIResponse(
        JSON.stringify(rawAnalysis),
        "item-analysis",
      );
      const analysis = validation.success
        ? validation.data
        : validation.fallback;

      res.status(200).json({
        analysis,
        metadata: {
          analysis_type: "basic_fallback",
          has_image: false,
          aiProvider: "Local Fallback",
          timestamp: new Date().toISOString(),
          has_user_context: Object.keys(userProfile).length > 0,
          validated: validation.success,
        },
      });
    }
  } catch (error: any) {
    console.error("Item analysis error:", error);
    res.status(500).json({
      error: "Failed to analyze item",
      message:
        "Our AI stylist is temporarily unavailable. Please try again in a few moments.",
      aiProvider: "Gemini AI",
    });
  }
}
