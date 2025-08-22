import { GoogleGenerativeAI } from "@google/generative-ai";
import { STRUCTURED_PROMPT_TEMPLATES } from "./response-schemas";

// Initialize Gemini AI
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Gemini API key not configured. Please add GEMINI_API_KEY to your environment variables.",
    );
  }
  return new GoogleGenerativeAI(apiKey);
};

// Performance-optimized Gemini generation
export const generateWithGemini = async (
  prompt: string,
  options?: {
    temperature?: number;
    maxOutputTokens?: number;
    model?: string;
  },
): Promise<string> => {
  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({
      model: options?.model || "gemini-1.5-flash", // Fast model for better performance
      generationConfig: {
        temperature: options?.temperature || 0.7,
        maxOutputTokens: options?.maxOutputTokens || 1200,
      },
    });

    const startTime = Date.now();

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    const endTime = Date.now();
    console.log(`Gemini response generated in ${endTime - startTime}ms`);

    return text;
  } catch (error: any) {
    console.error("Gemini API error:", error);
    throw new Error(
      `Failed to generate content with Gemini: ${error?.message || "Unknown error"}`,
    );
  }
};



// Check if Gemini is properly configured
export const isGeminiConfigured = (): boolean => {
  return !!process.env.GEMINI_API_KEY;
};

// Build a fashion-focused prompt for Gemini
export const buildFashionPrompt = (
  basePrompt: string,
  context?: {
    wardrobe?: any[];
    occasion?: string;
    weather?: string;
    style?: string;
    preferences?: any;
  },
): string => {
  let prompt = `You are FitMatch AI, a professional fashion stylist and wardrobe consultant with extensive expertise in personal styling, color theory, and fashion trends. You provide personalized, practical, and actionable fashion advice.

${basePrompt}`;

  if (context) {
    prompt += "\n\n**Context:**";
    if (context.wardrobe && context.wardrobe.length > 0) {
      prompt += `\n- User's wardrobe: ${context.wardrobe.length} items including ${context.wardrobe
        .map(
          (item) =>
            `${item.category || "item"} (${item.color || "unknown color"})${item.brand ? " by " + item.brand : ""}`,
        )
        .join(", ")}`;
    }
    if (context.occasion) prompt += `\n- Occasion: ${context.occasion}`;
    if (context.weather) prompt += `\n- Weather: ${context.weather}`;
    if (context.style) prompt += `\n- Preferred style: ${context.style}`;
  }

  prompt += `\n\n**Instructions:**
- Be specific and actionable in your recommendations
- Consider the user's existing wardrobe when making suggestions
- Provide styling tips that are practical and easy to implement
- Focus on creating cohesive, wearable outfits
- Include color coordination and styling advice
- Keep responses informative but concise
- Use a friendly, professional tone

**Response Format:** Provide clear, organized advice with specific recommendations.`;

  return prompt;
};

// Build outfit generation prompt specifically for Gemini with enhanced intelligence
export const buildOutfitGenerationPrompt = (
  items: any[],
  occasion: string,
  weather: string,
  style: string,
): string => {
  // Categorize items intelligently for better outfit creation
  const categorizedItems = categorizeItemsForOutfit(items);

  // Create detailed wardrobe description with style intelligence
  const wardrobeDescription = items
    .map((item, index) => {
      const category =
        typeof item.category === "string"
          ? item.category
          : item.category?.name || "item";
      const styleTags =
        item.clothing_item_style_tags
          ?.map((tag) => tag.style_tag?.name)
          .join(", ") || "";
      const itemId = `ITEM_${index + 1}`;
      return `${itemId}: ${category}${item.color ? ` in ${item.color}` : ""}${item.brand ? ` by ${item.brand}` : ""}${styleTags ? ` (styles: ${styleTags})` : ""}`;
    })
    .join("\n");

  // Build style preferences based on existing style tags
  const stylePreferences = extractStylePreferences(items, style);

  return buildFashionPrompt(
    `Create a cohesive outfit combination from the user's wardrobe for a ${occasion} occasion in ${weather} weather with a ${style} aesthetic.

**WARDROBE ANALYSIS:**
- Total items: ${items.length}
- Categories available: ${Object.keys(categorizedItems).join(", ")}
- Style preferences detected: ${stylePreferences}

**AVAILABLE WARDROBE ITEMS:**
${wardrobeDescription}

**OUTFIT CREATION RULES:**
1. Use ONLY items from the wardrobe above (reference by ITEM_ID)
2. Create a balanced outfit with proper proportions
3. Consider color coordination and style cohesion
4. Match the occasion and weather requirements
5. Prioritize items with matching style tags

Create outfits that are appropriate for the occasion, suitable for the weather, and match the requested style preference. Consider color coordination, seasonal appropriateness, and practical styling.`,
    {
      wardrobe: items,
      occasion,
      weather,
      style,
    },
  );
};

// Helper function to categorize items for outfit creation
function categorizeItemsForOutfit(items: any[]) {
  const categories: Record<string, any[]> = {
    tops: [],
    bottoms: [],
    dresses: [],
    outerwear: [],
    shoes: [],
    accessories: [],
  };

  items.forEach((item) => {
    const categoryName =
      typeof item.category === "string"
        ? item.category.toLowerCase()
        : item.category?.name?.toLowerCase() || "other";

    if (
      categoryName.includes("top") ||
      categoryName.includes("shirt") ||
      categoryName.includes("blouse") ||
      categoryName.includes("sweater")
    ) {
      categories.tops.push(item);
    } else if (
      categoryName.includes("bottom") ||
      categoryName.includes("pant") ||
      categoryName.includes("jean") ||
      categoryName.includes("short") ||
      categoryName.includes("skirt")
    ) {
      categories.bottoms.push(item);
    } else if (categoryName.includes("dress")) {
      categories.dresses.push(item);
    } else if (
      categoryName.includes("outerwear") ||
      categoryName.includes("jacket") ||
      categoryName.includes("coat") ||
      categoryName.includes("blazer")
    ) {
      categories.outerwear.push(item);
    } else if (
      categoryName.includes("shoe") ||
      categoryName.includes("boot") ||
      categoryName.includes("sandal") ||
      categoryName.includes("sneaker")
    ) {
      categories.shoes.push(item);
    } else if (categoryName.includes("accessor")) {
      categories.accessories.push(item);
    }
  });

  return categories;
}

// Extract style preferences from existing items
function extractStylePreferences(items: any[], preferredStyle: string): string {
  const styleTags = items.flatMap(
    (item) =>
      item.clothing_item_style_tags?.map((tag) => tag.style_tag?.name) || [],
  );

  const styleCount = styleTags.reduce(
    (acc, style) => {
      acc[style] = (acc[style] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const topStyles = Object.entries(styleCount)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 3)
    .map(([style]) => style);

  const preferences = [preferredStyle, ...topStyles]
    .filter(Boolean)
    .slice(0, 3);
  return preferences.join(", ") || preferredStyle;
}

// Build enhanced wardrobe analysis prompt for Gemini with deep insights
export const buildWardrobeAnalysisPrompt = (
  items: any[],
  preferences?: any,
): string => {
  // Advanced categorization with detailed analysis
  const categorizedItems = categorizeItemsForOutfit(items);
  const styleAnalysis = analyzeStyleConsistency(items);
  const colorAnalysis = analyzeColorPalette(items);

  const categories = items.reduce(
    (acc, item) => {
      const category =
        typeof item.category === "string"
          ? item.category
          : item.category?.name || "unknown";
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const brands = items.reduce(
    (acc, item) => {
      if (item.brand) {
        acc[item.brand] = (acc[item.brand] || 0) + 1;
      }
      return acc;
    },
    {} as Record<string, number>,
  );

  return buildFashionPrompt(
    `Perform a comprehensive wardrobe analysis as an expert fashion consultant. Focus on actionable insights and personalized recommendations.

**WARDROBE OVERVIEW:**
- Total Items: ${items.length}
- Categories Available: ${Object.keys(categorizedItems)
      .map((cat) => `${cat} (${categorizedItems[cat].length})`)
      .join(", ")}
- Primary Colors: ${colorAnalysis.dominant.join(", ")}
- Style Coherence: ${styleAnalysis.consistency}%
- Key Brands: ${Object.entries(brands)
      .slice(0, 3)
      .map(([brand, count]) => `${brand} (${count})`)
      .join(", ")}

**DETAILED STYLE ANALYSIS:**
- Most Common Styles: ${styleAnalysis.topStyles.join(", ")}
- Style Distribution: ${styleAnalysis.distribution}
- Missing Style Categories: ${styleAnalysis.gaps.join(", ")}

**COLOR PALETTE ANALYSIS:**
- Dominant Colors: ${colorAnalysis.dominant.join(", ")}
- Supporting Colors: ${colorAnalysis.supporting.join(", ")}
- Color Harmony Score: ${colorAnalysis.harmonyScore}/100
- Missing Neutrals: ${colorAnalysis.missingNeutrals.join(", ")}

**WARDROBE INVENTORY:**
${items
  .map((item, index) => {
    const category =
      typeof item.category === "string"
        ? item.category
        : item.category?.name || "item";
    const styleTags =
      item.clothing_item_style_tags
        ?.map((tag) => tag.style_tag?.name)
        .join(", ") || "untagged";
    return `${index + 1}. ${category}${item.color ? ` - ${item.color}` : ""}${item.brand ? ` by ${item.brand}` : ""} [${styleTags}]`;
  })
  .join("\n")}

**ANALYSIS PRIORITIES:**
1. Identify high-impact investment pieces that multiply outfit options
2. Spot color coordination opportunities and gaps
3. Assess style consistency and suggest refinements
4. Calculate realistic outfit combinations from existing pieces
5. Provide actionable organization and styling advice
6. Consider seasonal versatility and occasion coverage

**FOCUS ON ACTIONABILITY:** Every recommendation should be specific, achievable, and directly improve the user's styling options.`,
    {
      wardrobe: items,
      preferences,
    },
  );
};

// Analyze style consistency across wardrobe items
function analyzeStyleConsistency(items: any[]) {
  const allStyleTags = items.flatMap(
    (item) =>
      item.clothing_item_style_tags?.map((tag) => tag.style_tag?.name) || [],
  );

  if (allStyleTags.length === 0) {
    return {
      consistency: 60,
      topStyles: ["casual"],
      distribution: "mixed",
      gaps: ["formal", "business"],
    };
  }

  const styleCount = allStyleTags.reduce(
    (acc, style) => {
      acc[style] = (acc[style] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const topStyles = Object.entries(styleCount)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 3)
    .map(([style]) => style);

  const totalStyles = Object.keys(styleCount).length;
  const dominantStyleCount = Math.max(
    ...(Object.values(styleCount) as number[]),
  );
  const consistency = Math.round(
    (dominantStyleCount / allStyleTags.length) * 100,
  );

  const commonStyles = ["casual", "formal", "business", "party"];
  const gaps = commonStyles.filter((style) => !styleCount[style]);

  return {
    consistency,
    topStyles,
    distribution:
      totalStyles > 5 ? "diverse" : totalStyles > 2 ? "balanced" : "focused",
    gaps: gaps.slice(0, 3),
  };
}

// Analyze color palette with sophisticated color theory
function analyzeColorPalette(items: any[]) {
  const colors = items.map((item) => item.color).filter(Boolean);

  if (colors.length === 0) {
    return {
      dominant: ["neutral tones"],
      supporting: [],
      harmonyScore: 50,
      missingNeutrals: ["black", "white", "navy"],
    };
  }

  const colorCount = colors.reduce(
    (acc, color) => {
      const normalizedColor = color.toLowerCase();
      acc[normalizedColor] = (acc[normalizedColor] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const sortedColors = Object.entries(colorCount).sort(
    ([, a], [, b]) => (b as number) - (a as number),
  );

  const dominant = sortedColors.slice(0, 3).map(([color]) => color);
  const supporting = sortedColors.slice(3, 6).map(([color]) => color);

  // Calculate harmony score based on neutral presence and color balance
  const neutralColors = [
    "black",
    "white",
    "gray",
    "grey",
    "navy",
    "beige",
    "brown",
    "cream",
  ];
  const neutralCount = dominant.filter((color) =>
    neutralColors.some((neutral) => color.includes(neutral)),
  ).length;

  const harmonyScore = Math.min(
    50 + neutralCount * 20 + (colors.length > 5 ? 10 : 0),
    100,
  );

  const essentialNeutrals = ["black", "white", "navy"];
  const missingNeutrals = essentialNeutrals.filter(
    (neutral) => !colors.some((color) => color.toLowerCase().includes(neutral)),
  );

  return {
    dominant,
    supporting,
    harmonyScore,
    missingNeutrals,
  };
}

// Create intelligent user style profile for enhanced personalization
export const createUserStyleProfile = (items: any[], userPreferences?: any) => {
  const styleAnalysis = analyzeStyleConsistency(items);
  const colorAnalysis = analyzeColorPalette(items);
  const categoryDistribution = categorizeItemsForOutfit(items);

  // Analyze brand preferences
  const brandPreferences = items.reduce(
    (acc, item) => {
      if (item.brand) {
        acc[item.brand] = (acc[item.brand] || 0) + 1;
      }
      return acc;
    },
    {} as Record<string, number>,
  );

  const topBrands = Object.entries(brandPreferences)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 3)
    .map(([brand]) => brand);

  // Calculate style sophistication level
  const sophisticationScore = calculateSophisticationScore(items);

  // Determine lifestyle patterns
  const lifestylePatterns = analyzeLifestylePatterns(items);

  return {
    stylePreferences: {
      primaryStyles: styleAnalysis.topStyles,
      consistency: styleAnalysis.consistency,
      sophistication: sophisticationScore,
    },
    colorPreferences: {
      dominantColors: colorAnalysis.dominant,
      harmonyLevel: colorAnalysis.harmonyScore,
      neutralBalance: calculateNeutralBalance(items),
    },
    wardrobeComposition: {
      totalItems: items.length,
      categoryDistribution: Object.fromEntries(
        Object.entries(categoryDistribution).map(([key, value]) => [
          key,
          value.length,
        ]),
      ),
      brandLoyalty: topBrands.length > 0 ? topBrands : ["varied"],
    },
    lifestyleIndicators: lifestylePatterns,
    personalizedRecommendations: generatePersonalizedRecommendations(
      items,
      styleAnalysis,
      colorAnalysis,
    ),
  };
};

// Calculate sophistication score based on wardrobe items
function calculateSophisticationScore(items: any[]): number {
  let score = 50; // Base score

  // Check for formal/business items
  const formalItems = items.filter((item) => {
    const category =
      typeof item.category === "string"
        ? item.category.toLowerCase()
        : item.category?.name?.toLowerCase() || "";
    const styleTags =
      item.clothing_item_style_tags?.map((tag) =>
        tag.style_tag?.name.toLowerCase(),
      ) || [];

    return (
      category.includes("suit") ||
      category.includes("blazer") ||
      category.includes("dress") ||
      styleTags.includes("formal") ||
      styleTags.includes("business") ||
      styleTags.includes("elegant")
    );
  });

  score += Math.min(formalItems.length * 10, 30);

  // Check for luxury brands (simplified)
  const luxuryBrands = [
    "gucci",
    "prada",
    "chanel",
    "dior",
    "versace",
    "armani",
    "hugo boss",
  ];
  const hasLuxuryBrands = items.some((item) =>
    luxuryBrands.some((brand) => item.brand?.toLowerCase().includes(brand)),
  );

  if (hasLuxuryBrands) score += 15;

  // Check color sophistication (neutral dominance)
  const colors = items.map((item) => item.color).filter(Boolean);
  const neutrals = ["black", "white", "navy", "gray", "beige", "brown"];
  const neutralCount = colors.filter((color) =>
    neutrals.some((neutral) => color.toLowerCase().includes(neutral)),
  ).length;

  const neutralRatio = neutralCount / colors.length;
  score += neutralRatio * 20;

  return Math.min(Math.max(score, 0), 100);
}

// Analyze lifestyle patterns from wardrobe
function analyzeLifestylePatterns(items: any[]): string[] {
  const patterns: string[] = [];

  const categories = items.reduce(
    (acc, item) => {
      const category =
        typeof item.category === "string"
          ? item.category.toLowerCase()
          : item.category?.name?.toLowerCase() || "";
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const styleTags = items.flatMap(
    (item) =>
      item.clothing_item_style_tags?.map((tag) =>
        tag.style_tag?.name.toLowerCase(),
      ) || [],
  );

  // Professional lifestyle
  if (
    styleTags.includes("business") ||
    styleTags.includes("formal") ||
    categories["blazer"] > 0
  ) {
    patterns.push("professional");
  }

  // Active lifestyle
  if (
    categories["activewear"] > 0 ||
    styleTags.includes("sport") ||
    styleTags.includes("athletic")
  ) {
    patterns.push("active");
  }

  // Social lifestyle
  if (
    styleTags.includes("party") ||
    styleTags.includes("elegant") ||
    categories["dress"] > 2
  ) {
    patterns.push("social");
  }

  // Casual lifestyle (default if nothing else detected)
  if (patterns.length === 0 || styleTags.includes("casual")) {
    patterns.push("casual");
  }

  return patterns;
}

// Calculate neutral color balance
function calculateNeutralBalance(items: any[]): number {
  const colors = items.map((item) => item.color).filter(Boolean);
  if (colors.length === 0) return 0;

  const neutrals = [
    "black",
    "white",
    "navy",
    "gray",
    "grey",
    "beige",
    "brown",
    "cream",
  ];
  const neutralCount = colors.filter((color) =>
    neutrals.some((neutral) => color.toLowerCase().includes(neutral)),
  ).length;

  return Math.round((neutralCount / colors.length) * 100);
}

// Generate personalized recommendations based on analysis
function generatePersonalizedRecommendations(
  items: any[],
  styleAnalysis: any,
  colorAnalysis: any,
): string[] {
  const recommendations: string[] = [];

  // Style-based recommendations
  if (styleAnalysis.consistency < 60) {
    recommendations.push(
      "Consider focusing on 2-3 core styles for better wardrobe cohesion",
    );
  }

  if (
    styleAnalysis.topStyles.includes("casual") &&
    !styleAnalysis.topStyles.includes("business")
  ) {
    recommendations.push(
      "Add some business-casual pieces to increase versatility",
    );
  }

  // Color-based recommendations
  if (colorAnalysis.harmonyScore < 70) {
    recommendations.push(
      `Incorporate more ${colorAnalysis.missingNeutrals.join(" and ")} pieces for better color harmony`,
    );
  }

  if (colorAnalysis.dominant.length < 2) {
    recommendations.push(
      "Expand your color palette with 1-2 additional core colors",
    );
  }

  // Category-based recommendations
  const categories = categorizeItemsForOutfit(items);
  if (categories.outerwear.length === 0) {
    recommendations.push(
      "Add versatile outerwear like a blazer or structured jacket",
    );
  }

  if (categories.shoes.length < 2) {
    recommendations.push(
      "Expand shoe collection with both casual and dressy options",
    );
  }

  return recommendations.slice(0, 4); // Limit to most important recommendations
}
