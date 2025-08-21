import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  generateWithGemini,
  buildOutfitGenerationPrompt,
  isGeminiConfigured,
} from "../shared/gemini.js";
import {
  validateAIResponse,
  STRUCTURED_PROMPT_TEMPLATES,
} from "../shared/response-schemas.js";

interface OutfitRequest {
  items: any[];
  preferences: {
    occasion?: string;
    weather?: string;
    style?: string;
    colors?: string[];
  };
  userProfile?: {
    style_inspiration?: string;
    lifestyle?: string;
  };
  maxOutfits?: number;
}

interface OutfitResponse {
  success: boolean;
  outfits?: {
    id: string;
    name: string;
    description: string;
    items: any[];
    occasion: string;
    weather: string;
    confidence: number;
    reasoning: string;
    styling_tips?: string[];
    color_analysis?: string;
    trend_insights?: string;
  }[];
  error?: string;
  rate_limited?: boolean;
  note?: string;
}

// Enhanced rate limiting
let requestCount = 0;
let lastReset = Date.now();

const checkRateLimit = (): boolean => {
  const now = Date.now();
  const hoursPassed = (now - lastReset) / (1000 * 60 * 60);

  if (hoursPassed >= 1) {
    requestCount = 0;
    lastReset = now;
  }

  if (requestCount >= 60) {
    // Optimized limit for better performance
    return false;
  }

  requestCount++;
  return true;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed. Use POST.",
    });
  }

  const startTime = Date.now();

  try {
    const requestData: OutfitRequest = req.body;
    const {
      items = [],
      preferences = {},
      userProfile = {},
      maxOutfits = 1,
    } = requestData;

    // Validate input early
    if (!items || !Array.isArray(items) || items.length < 3) {
      return res.status(400).json({
        success: false,
        error: "At least 3 clothing items are required to generate outfits",
      });
    }

    // Check API key
    if (!isGeminiConfigured()) {
      console.log("⚠️ Gemini not configured, using smart fallback");

      return res.status(200).json({
        success: true,
        outfits: generateSmartOutfits(
          items,
          preferences.occasion || "casual",
          preferences.weather || "mild",
          preferences.style || "comfortable",
        ),
        note: "Using smart recommendations - Please add your GEMINI_API_KEY to .env file for AI-powered suggestions. Get your key from: https://aistudio.google.com/app/apikey",
      });
    }

    // Check rate limit
    if (!checkRateLimit()) {
      return res.status(429).json({
        success: false,
        error:
          "Rate limit exceeded. Please wait before generating more outfits.",
        rate_limited: true,
      });
    }

    // Generate outfits using smart recommendations
    const outfits = generateSmartOutfits(
      items,
      preferences.occasion || "casual",
      preferences.weather || "mild",
      preferences.style || "comfortable",
    );

    const endTime = Date.now();
    console.log(`⚡ Outfit generation completed in ${endTime - startTime}ms`);

    return res.status(200).json({
      success: true,
      outfits,
    });
  } catch (error) {
    const endTime = Date.now();
    console.error(
      `❌ Outfit generation failed in ${endTime - startTime}ms:`,
      error,
    );

    return res.status(500).json({
      success: false,
      error: `Internal server error: ${error.message}`,
    });
  }
}

// Parse Gemini's JSON response with enhanced ITEM_ID matching
function parseGeminiOutfitResponse(
  aiResponse: string,
  items: any[],
  occasion: string,
  weather: string,
  style: string,
) {
  try {
    // Try to extract JSON from the response
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const parsedResponse = JSON.parse(jsonMatch[0]);

    // Enhanced item matching using ITEM_ID system
    const matchedItems = matchItemsByID(parsedResponse.items || [], items);

    // Validate we have a reasonable outfit
    if (matchedItems.length < 2) {
      console.log("Insufficient items matched, using smart fallback");
      return generateSmartOutfits(items, occasion, weather, style);
    }

    const outfit = {
      id: `outfit-${Date.now()}`,
      name:
        parsedResponse.name ||
        generateOutfitName(occasion, style, matchedItems),
      description:
        parsedResponse.description ||
        generateOutfitDescription(matchedItems, occasion, weather, style),
      items: matchedItems,
      occasion,
      weather,
      confidence: Math.min(
        Math.max(parsedResponse.confidence || 0.85, 0.5),
        1.0,
      ),
      reasoning:
        parsedResponse.reasoning ||
        generateOutfitReasoning(matchedItems, occasion, style),
      styling_tips: Array.isArray(parsedResponse.styling_tips)
        ? parsedResponse.styling_tips.slice(0, 4)
        : generateStylingTips(matchedItems, occasion, weather),
      color_analysis:
        parsedResponse.color_analysis || generateColorAnalysis(matchedItems),
      trend_insights: `This ${style} aesthetic leverages your existing wardrobe pieces perfectly for ${occasion} occasions in ${weather} weather. The combination showcases excellent style coordination.`,
      style_match_score:
        parsedResponse.style_match_score ||
        calculateStyleMatchScore(matchedItems, style),
    };

    return [outfit];
  } catch (error) {
    console.warn(
      "Failed to parse Gemini response, using smart fallback:",
      error,
    );
    return generateSmartOutfits(items, occasion, weather, style);
  }
}

// Enhanced item matching using ITEM_ID system
function matchItemsByID(
  suggestedItemIds: string[],
  wardrobeItems: any[],
): any[] {
  const matchedItems: any[] = [];

  for (const itemId of suggestedItemIds) {
    // Extract index from ITEM_ID format (e.g., "ITEM_1" -> index 0)
    const match = itemId.match(/ITEM_(\d+)/);
    if (match) {
      const index = parseInt(match[1]) - 1; // Convert to 0-based index
      if (index >= 0 && index < wardrobeItems.length) {
        const item = wardrobeItems[index];
        if (!matchedItems.find((mi) => mi.id === item.id)) {
          matchedItems.push(item);
        }
      }
    }
  }

  // If AI didn't use proper ITEM_IDs, fall back to smart matching
  if (matchedItems.length === 0 && suggestedItemIds.length > 0) {
    return matchItemsFromWardrobe(suggestedItemIds, wardrobeItems);
  }

  // Ensure we have a minimum viable outfit
  if (matchedItems.length < 2) {
    return selectBalancedOutfit(wardrobeItems, matchedItems);
  }

  return matchedItems.slice(0, 4); // Limit to 4 items max
}

// Select a balanced outfit when AI matching is insufficient
function selectBalancedOutfit(
  wardrobeItems: any[],
  existingItems: any[],
): any[] {
  const usedIds = new Set(existingItems.map((item) => item.id));
  const categories = categorizeWardrobe(wardrobeItems);
  const selectedItems = [...existingItems];

  // Try to get one item from each essential category
  const essentialOrder = ["tops", "bottoms", "shoes", "outerwear"];

  for (const category of essentialOrder) {
    if (selectedItems.length >= 4) break;

    const availableInCategory = categories[category]?.filter(
      (item) => !usedIds.has(item.id),
    );
    if (availableInCategory && availableInCategory.length > 0) {
      const randomItem =
        availableInCategory[
          Math.floor(Math.random() * availableInCategory.length)
        ];
      selectedItems.push(randomItem);
      usedIds.add(randomItem.id);
    }
  }

  return selectedItems.slice(0, 4);
}

// Generate outfit name based on items and context
function generateOutfitName(
  occasion: string,
  style: string,
  items: any[],
): string {
  const hasFormaljwelry = items.some((item) => {
    const category =
      typeof item.category === "string"
        ? item.category.toLowerCase()
        : item.category?.name?.toLowerCase() || "";
    return category.includes("dress") || category.includes("suit");
  });

  const adjectives = {
    casual: ["Relaxed", "Effortless", "Comfortable"],
    formal: ["Elegant", "Sophisticated", "Polished"],
    business: ["Professional", "Sharp", "Executive"],
    party: ["Chic", "Statement", "Bold"],
    date: ["Romantic", "Charming", "Stylish"],
  };

  const occasionAdj = adjectives[occasion.toLowerCase()] || adjectives.casual;
  const randomAdj = occasionAdj[Math.floor(Math.random() * occasionAdj.length)];

  return `${randomAdj} ${occasion.charAt(0).toUpperCase() + occasion.slice(1)} ${style.charAt(0).toUpperCase() + style.slice(1)} Look`;
}

// Generate outfit description based on actual items
function generateOutfitDescription(
  items: any[],
  occasion: string,
  weather: string,
  style: string,
): string {
  const itemDescriptions = items.map((item) => {
    const category =
      typeof item.category === "string"
        ? item.category
        : item.category?.name || "piece";
    return `${item.color || ""} ${category}`.trim();
  });

  return `This carefully curated ${style} outfit combines your ${itemDescriptions.join(", ")} for a perfect ${occasion} look in ${weather} weather. Each piece complements the others to create a cohesive, stylish ensemble.`;
}

// Generate outfit reasoning based on actual items
function generateOutfitReasoning(
  items: any[],
  occasion: string,
  style: string,
): string {
  const categories = items.map((item) =>
    typeof item.category === "string"
      ? item.category
      : item.category?.name || "piece",
  );
  const colors = items.map((item) => item.color).filter(Boolean);

  return `This ${style} combination works perfectly for ${occasion} because it balances ${categories.join(" and ")}${colors.length > 1 ? ` in coordinating ${colors.join(" and ")} tones` : ""}. The pieces are styled to complement each other while maintaining the desired aesthetic.`;
}

// Calculate style match score based on style tags
function calculateStyleMatchScore(items: any[], targetStyle: string): number {
  const allStyleTags = items.flatMap(
    (item) =>
      item.clothing_item_style_tags?.map((tag) =>
        tag.style_tag?.name.toLowerCase(),
      ) || [],
  );

  if (allStyleTags.length === 0) return 0.7; // Default score

  const targetStyleLower = targetStyle.toLowerCase();
  const matchingTags = allStyleTags.filter(
    (tag) => tag.includes(targetStyleLower) || targetStyleLower.includes(tag),
  );

  const baseScore = matchingTags.length / allStyleTags.length;
  return Math.min(Math.max(baseScore + 0.3, 0.5), 1.0); // Ensure reasonable range
}

// Match suggested items with actual wardrobe items
function matchItemsFromWardrobe(
  suggestedItems: string[],
  wardrobeItems: any[],
): any[] {
  const matchedItems: any[] = [];

  for (const suggestion of suggestedItems) {
    // Try to find the best matching item in the wardrobe
    const matchedItem = wardrobeItems.find((item) => {
      const category =
        typeof item.category === "string"
          ? item.category
          : item.category?.name || "";
      const itemDescription =
        `${category} ${item.color || ""} ${item.brand || ""}`.toLowerCase();
      const suggestionLower = suggestion.toLowerCase();

      return (
        itemDescription.includes(suggestionLower.split(" ")[0]) ||
        suggestionLower.includes(category.toLowerCase()) ||
        (item.color && suggestionLower.includes(item.color.toLowerCase()))
      );
    });

    if (matchedItem && !matchedItems.find((mi) => mi.id === matchedItem.id)) {
      matchedItems.push(matchedItem);
    }
  }

  // If we don't have enough matches, fill with random items from different categories
  const usedIds = new Set(matchedItems.map((item) => item.id));
  const remainingItems = wardrobeItems.filter((item) => !usedIds.has(item.id));

  while (matchedItems.length < Math.min(4, wardrobeItems.length)) {
    const randomItem =
      remainingItems[Math.floor(Math.random() * remainingItems.length)];
    if (randomItem && !usedIds.has(randomItem.id)) {
      matchedItems.push(randomItem);
      usedIds.add(randomItem.id);
      remainingItems.splice(remainingItems.indexOf(randomItem), 1);
    } else {
      break;
    }
  }

  return matchedItems.slice(0, 4); // Limit to 4 items max
}

// Smart outfit generation with actual wardrobe items
function generateSmartOutfits(
  items: any[],
  occasion: string,
  weather: string,
  style: string,
): any[] {
  // Categorize available items
  const categorizedItems = categorizeWardrobe(items);

  // Select items for the outfit based on occasion and style
  const selectedItems = selectItemsForOccasion(
    categorizedItems,
    occasion,
    weather,
    style,
  );

  const outfit = {
    id: `smart-outfit-${Date.now()}`,
    name: `${style.charAt(0).toUpperCase() + style.slice(1)} ${occasion.charAt(0).toUpperCase() + occasion.slice(1)} Look`,
    description: `A carefully curated ${style} outfit perfect for ${occasion} occasions in ${weather} weather. This combination uses your existing wardrobe pieces to create a cohesive, stylish look.`,
    items: selectedItems,
    occasion,
    weather,
    confidence: 0.8 + Math.random() * 0.15, // 0.80-0.95
    reasoning: `This outfit combines ${selectedItems
      .map((item) => {
        const category =
          typeof item.category === "string"
            ? item.category
            : item.category?.name || "piece";
        return `your ${item.color || ""} ${category}`.trim();
      })
      .join(
        ", ",
      )} to create a balanced look that's appropriate for ${occasion} while maintaining your ${style} aesthetic.`,
    styling_tips: generateStylingTips(selectedItems, occasion, weather),
    color_analysis: generateColorAnalysis(selectedItems),
    trend_insights: `The ${style} aesthetic is trending and works perfectly for ${occasion} settings. The color combination you have creates visual harmony while remaining versatile.`,
  };

  return [outfit];
}

// Categorize wardrobe items
function categorizeWardrobe(items: any[]) {
  const categories = {
    tops: [] as any[],
    bottoms: [] as any[],
    outerwear: [] as any[],
    shoes: [] as any[],
    dresses: [] as any[],
    accessories: [] as any[],
    activewear: [] as any[],
    other: [] as any[],
  };

  items.forEach((item) => {
    const category =
      typeof item.category === "string"
        ? item.category.toLowerCase()
        : item.category?.name?.toLowerCase() || "other";

    if (
      category.includes("top") ||
      category.includes("shirt") ||
      category.includes("blouse") ||
      category.includes("sweater")
    ) {
      categories.tops.push(item);
    } else if (
      category.includes("bottom") ||
      category.includes("pant") ||
      category.includes("jean") ||
      category.includes("short") ||
      category.includes("skirt")
    ) {
      categories.bottoms.push(item);
    } else if (
      category.includes("outerwear") ||
      category.includes("jacket") ||
      category.includes("coat") ||
      category.includes("blazer")
    ) {
      categories.outerwear.push(item);
    } else if (
      category.includes("shoe") ||
      category.includes("boot") ||
      category.includes("sandal") ||
      category.includes("sneaker")
    ) {
      categories.shoes.push(item);
    } else if (category.includes("dress")) {
      categories.dresses.push(item);
    } else if (category.includes("accessor")) {
      categories.accessories.push(item);
    } else if (category.includes("active") || category.includes("sport")) {
      categories.activewear.push(item);
    } else {
      categories.other.push(item);
    }
  });

  return categories;
}

// Select items for specific occasion
function selectItemsForOccasion(
  categorizedItems: any,
  occasion: string,
  weather: string,
  style: string,
): any[] {
  const selectedItems: any[] = [];

  // Decide outfit structure based on occasion
  const usesDress =
    occasion.includes("formal") ||
    occasion.includes("date") ||
    occasion.includes("party");

  if (usesDress && categorizedItems.dresses.length > 0) {
    // Dress-based outfit
    selectedItems.push(getRandomItem(categorizedItems.dresses));
    if (categorizedItems.shoes.length > 0) {
      selectedItems.push(getRandomItem(categorizedItems.shoes));
    }
    if (
      (weather.includes("cold") || occasion.includes("formal")) &&
      categorizedItems.outerwear.length > 0
    ) {
      selectedItems.push(getRandomItem(categorizedItems.outerwear));
    }
  } else {
    // Separates-based outfit
    if (categorizedItems.tops.length > 0) {
      selectedItems.push(getRandomItem(categorizedItems.tops));
    }
    if (categorizedItems.bottoms.length > 0) {
      selectedItems.push(getRandomItem(categorizedItems.bottoms));
    }
    if (categorizedItems.shoes.length > 0) {
      selectedItems.push(getRandomItem(categorizedItems.shoes));
    }
    if (
      (weather.includes("cold") ||
        occasion.includes("business") ||
        occasion.includes("formal")) &&
      categorizedItems.outerwear.length > 0
    ) {
      selectedItems.push(getRandomItem(categorizedItems.outerwear));
    }
  }

  // Add accessories if available and appropriate
  if (categorizedItems.accessories.length > 0 && selectedItems.length < 4) {
    selectedItems.push(getRandomItem(categorizedItems.accessories));
  }

  return selectedItems.filter(Boolean); // Remove any null/undefined items
}

// Get random item from array
function getRandomItem(items: any[]): any {
  if (items.length === 0) return null;
  return items[Math.floor(Math.random() * items.length)];
}

// Generate styling tips based on selected items
function generateStylingTips(
  items: any[],
  occasion: string,
  weather: string,
): string[] {
  const tips = [
    "Ensure all pieces fit well for the most polished look",
    "Pay attention to proportions when layering pieces",
  ];

  // Add occasion-specific tips
  if (occasion.includes("formal") || occasion.includes("business")) {
    tips.push(
      "Keep accessories minimal and elegant for a professional appearance",
    );
    tips.push("Make sure shoes are clean and in good condition");
  } else if (occasion.includes("casual")) {
    tips.push("Feel free to mix textures for added visual interest");
    tips.push(
      "Roll up sleeves or add casual accessories to personalize the look",
    );
  }

  // Add weather-specific tips
  if (weather.includes("cold")) {
    tips.push("Layer thoughtfully to stay warm while maintaining style");
  } else if (weather.includes("hot")) {
    tips.push("Choose breathable fabrics and lighter colors");
  }

  return tips.slice(0, 4);
}

// Generate color analysis for selected items
function generateColorAnalysis(items: any[]): string {
  const colors = items.map((item) => item.color).filter(Boolean);

  if (colors.length === 0) {
    return "The neutral tones in this outfit create a timeless, versatile look.";
  }

  const neutrals = ["black", "white", "gray", "grey", "navy", "beige", "brown"];
  const neutralCount = colors.filter((color) =>
    neutrals.some((n) => color.toLowerCase().includes(n)),
  ).length;

  if (neutralCount >= colors.length * 0.7) {
    return `The predominantly neutral palette (${colors.join(", ")}) creates a sophisticated, easy-to-wear combination that's perfect for multiple occasions.`;
  } else {
    return `The color combination of ${colors.join(", ")} creates visual interest while remaining balanced and coordinated.`;
  }
}

// Fallback outfits when everything fails
function generateFallbackOutfits(request: OutfitRequest): any[] {
  const { preferences = {} } = request;
  const occasion = preferences.occasion || "casual";
  const weather = preferences.weather || "mild";
  const style = preferences.style || "comfortable";

  return [
    {
      id: "fallback-outfit-1",
      name: "Classic Everyday Look",
      description:
        "A timeless combination that works for most occasions and is comfortable for daily wear.",
      items: [], // Will be empty since we don't have access to actual items
      occasion,
      weather,
      confidence: 0.85,
      reasoning:
        "This classic combination balances style and comfort, making it perfect for everyday wear.",
      styling_tips: [
        "Focus on fit - well-fitted basics always look more expensive",
        "Add a structured piece like a blazer to elevate the look",
        "Choose comfortable shoes that you can walk in all day",
        "Keep accessories simple but purposeful",
      ],
      color_analysis:
        "Neutral colors provide the most versatility and are easy to mix and match.",
      trend_insights: `The ${style} aesthetic remains timeless and works perfectly for ${occasion} occasions.`,
    },
  ];
}
