import { z } from "zod";

/**
 * Comprehensive JSON schema validation for all AI responses
 * Ensures structured, consistent output from Gemini API calls
 */

// Base response schema with common fields
const BaseResponseSchema = z.object({
  confidence: z.number().min(0).max(1).optional(),
  reasoning: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

// Outfit generation response schema
export const OutfitResponseSchema = BaseResponseSchema.extend({
  name: z.string().min(1, "Outfit name is required"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  items: z.array(z.string()).min(1, "At least one item is required"),
  reasoning: z.string().min(20, "Reasoning must be detailed"),
  styling_tips: z
    .array(z.string())
    .min(1, "At least one styling tip is required"),
  color_analysis: z.string().min(10, "Color analysis is required"),
  confidence: z.number().min(0.1).max(1),
  style_match_score: z.number().min(0).max(1),
  occasion_suitability: z.number().min(0).max(1).optional(),
  weather_appropriateness: z.number().min(0).max(1).optional(),
});

// Wardrobe analysis response schema
export const WardrobeAnalysisSchema = BaseResponseSchema.extend({
  overall_assessment: z.string().min(50, "Assessment must be comprehensive"),
  strengths: z
    .array(z.string())
    .min(1, "At least one strength must be identified"),
  gaps: z.array(z.string()).min(0, "Gaps array is required"),
  color_analysis: z.object({
    dominant_colors: z.array(z.string()),
    missing_colors: z.array(z.string()),
    harmony_score: z.number().min(0).max(100),
    recommendations: z.string().min(20),
  }),
  style_consistency: z.object({
    score: z.number().min(0).max(100),
    description: z.string().min(20),
  }),
  versatility: z.object({
    score: z.number().min(0).max(100),
    possible_outfits: z.string(),
    description: z.string().min(20),
  }),
  investment_priorities: z.array(
    z.object({
      item: z.string().min(1),
      reason: z.string().min(20),
      impact: z.string().min(10),
      priority: z.number().min(1).max(5),
    }),
  ),
  organization_tips: z.array(z.string()).min(1),
  styling_opportunities: z.array(
    z.object({
      outfit_name: z.string().min(1),
      items: z.array(z.string()).min(1),
      occasion: z.string().min(1),
      styling_notes: z.string().min(10),
    }),
  ),
});

// Styling advice response schema
export const StylingAdviceSchema = BaseResponseSchema.extend({
  advice: z.string().min(50, "Advice must be comprehensive"),
  specific_recommendations: z.array(z.string()).min(1),
  color_suggestions: z.array(z.string()).optional(),
  styling_tips: z.array(z.string()).min(1),
  do_and_dont: z
    .object({
      do: z.array(z.string()).min(1),
      dont: z.array(z.string()).min(1),
    })
    .optional(),
  confidence: z.number().min(0.1).max(1),
});

// Item analysis response schema
export const ItemAnalysisSchema = BaseResponseSchema.extend({
  category: z.string().min(1, "Category is required"),
  style_tags: z.array(z.string()).min(1, "At least one style tag is required"),
  color: z.string().min(1, "Color is required"),
  versatility_score: z.number().min(0).max(10),
  styling_suggestions: z.array(z.string()).min(1),
  pairing_recommendations: z.array(z.string()).min(1),
  occasion_suitability: z.array(z.string()).min(1),
  care_instructions: z.string().optional(),
  confidence: z.number().min(0.1).max(1),
});

// Type definitions for validated responses
export type ValidatedOutfitResponse = z.infer<typeof OutfitResponseSchema>;
export type ValidatedWardrobeAnalysis = z.infer<typeof WardrobeAnalysisSchema>;
export type ValidatedStylingAdvice = z.infer<typeof StylingAdviceSchema>;
export type ValidatedItemAnalysis = z.infer<typeof ItemAnalysisSchema>;

/**
 * Validate and parse AI response based on prompt type
 */
export function validateAIResponse(
  response: string,
  promptType:
    | "outfit-generation"
    | "wardrobe-analysis"
    | "styling-advice"
    | "item-analysis",
): { success: boolean; data?: any; error?: string; fallback?: any } {
  try {
    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        success: false,
        error: "No valid JSON found in response",
        fallback: { rawResponse: response },
      };
    }

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      return {
        success: false,
        error: `JSON parsing failed: ${parseError.message}`,
        fallback: { rawResponse: response },
      };
    }

    // Validate against appropriate schema
    let validationResult;
    switch (promptType) {
      case "outfit-generation":
        validationResult = OutfitResponseSchema.safeParse(parsedResponse);
        break;
      case "wardrobe-analysis":
        validationResult = WardrobeAnalysisSchema.safeParse(parsedResponse);
        break;
      case "styling-advice":
        validationResult = StylingAdviceSchema.safeParse(parsedResponse);
        break;
      case "item-analysis":
        validationResult = ItemAnalysisSchema.safeParse(parsedResponse);
        break;
      default:
        return {
          success: false,
          error: `Unknown prompt type: ${promptType}`,
          fallback: { rawResponse: response },
        };
    }

    if (validationResult.success) {
      console.log(`Response validation successful for ${promptType}`);
      return {
        success: true,
        data: validationResult.data,
      };
    } else {
      console.warn(
        `Response validation failed for ${promptType}:`,
        validationResult.error.issues,
      );

      // Attempt to create a fallback response with available data
      const fallback = createFallbackResponse(
        parsedResponse,
        promptType,
        validationResult.error,
      );

      return {
        success: false,
        error: `Validation failed: ${validationResult.error.issues.map((i) => i.message).join(", ")}`,
        fallback,
      };
    }
  } catch (error) {
    return {
      success: false,
      error: `Response validation error: ${error.message}`,
      fallback: { rawResponse: response },
    };
  }
}

/**
 * Create fallback response when validation fails
 */
function createFallbackResponse(
  parsedResponse: any,
  promptType: string,
  validationError: z.ZodError,
): any {
  const base = {
    rawResponse: JSON.stringify(parsedResponse),
    validationErrors: validationError.issues,
    confidence: 0.3, // Low confidence for fallback
  };

  switch (promptType) {
    case "outfit-generation":
      return {
        ...base,
        name: parsedResponse.name || "Generated Outfit",
        description:
          parsedResponse.description || "AI-generated outfit combination",
        items: Array.isArray(parsedResponse.items) ? parsedResponse.items : [],
        reasoning: parsedResponse.reasoning || "Automated outfit generation",
        styling_tips: Array.isArray(parsedResponse.styling_tips)
          ? parsedResponse.styling_tips
          : ["Style as desired"],
        color_analysis:
          parsedResponse.color_analysis ||
          "Color coordination analysis unavailable",
        style_match_score:
          typeof parsedResponse.style_match_score === "number"
            ? parsedResponse.style_match_score
            : 0.5,
      };

    case "wardrobe-analysis":
      return {
        ...base,
        overall_assessment:
          parsedResponse.overall_assessment ||
          "Wardrobe analysis completed with limited data",
        strengths: Array.isArray(parsedResponse.strengths)
          ? parsedResponse.strengths
          : ["Diverse wardrobe collection"],
        gaps: Array.isArray(parsedResponse.gaps) ? parsedResponse.gaps : [],
        color_analysis: parsedResponse.color_analysis || {
          dominant_colors: [],
          missing_colors: [],
          harmony_score: 50,
          recommendations: "Color analysis unavailable",
        },
        style_consistency: parsedResponse.style_consistency || {
          score: 50,
          description: "Style consistency analysis unavailable",
        },
        versatility: parsedResponse.versatility || {
          score: 50,
          possible_outfits: "Multiple combinations possible",
          description: "Versatility analysis unavailable",
        },
        investment_priorities: Array.isArray(
          parsedResponse.investment_priorities,
        )
          ? parsedResponse.investment_priorities
          : [],
        organization_tips: Array.isArray(parsedResponse.organization_tips)
          ? parsedResponse.organization_tips
          : ["Organize by category"],
        styling_opportunities: Array.isArray(
          parsedResponse.styling_opportunities,
        )
          ? parsedResponse.styling_opportunities
          : [],
      };

    case "styling-advice":
      return {
        ...base,
        advice: parsedResponse.advice || "General styling advice provided",
        specific_recommendations: Array.isArray(
          parsedResponse.specific_recommendations,
        )
          ? parsedResponse.specific_recommendations
          : ["Follow current trends"],
        styling_tips: Array.isArray(parsedResponse.styling_tips)
          ? parsedResponse.styling_tips
          : ["Dress for your body type"],
      };

    case "item-analysis":
      return {
        ...base,
        category: parsedResponse.category || "clothing",
        style_tags: Array.isArray(parsedResponse.style_tags)
          ? parsedResponse.style_tags
          : ["casual"],
        color: parsedResponse.color || "unknown",
        versatility_score:
          typeof parsedResponse.versatility_score === "number"
            ? parsedResponse.versatility_score
            : 5,
        styling_suggestions: Array.isArray(parsedResponse.styling_suggestions)
          ? parsedResponse.styling_suggestions
          : ["Versatile piece"],
        pairing_recommendations: Array.isArray(
          parsedResponse.pairing_recommendations,
        )
          ? parsedResponse.pairing_recommendations
          : ["Pairs well with basics"],
        occasion_suitability: Array.isArray(parsedResponse.occasion_suitability)
          ? parsedResponse.occasion_suitability
          : ["casual"],
      };

    default:
      return base;
  }
}

/**
 * Enhanced prompt templates that explicitly request structured JSON
 */
export const STRUCTURED_PROMPT_TEMPLATES = {
  outfit_generation: `
**CRITICAL: Your response MUST be valid JSON matching this exact structure:**
{
  "name": "Creative outfit name",
  "description": "Detailed description (minimum 10 characters)",
  "items": ["ITEM_1", "ITEM_2", "ITEM_3"],
  "reasoning": "Detailed explanation (minimum 20 characters)",
  "styling_tips": ["Tip 1", "Tip 2", "Tip 3"],
  "color_analysis": "Color coordination explanation (minimum 10 characters)",
  "confidence": 0.85,
  "style_match_score": 0.90,
  "occasion_suitability": 0.95,
  "weather_appropriateness": 0.88
}

**VALIDATION REQUIREMENTS:**
- All string fields must meet minimum length requirements
- Arrays must contain at least one item
- Confidence scores must be between 0.1 and 1.0
- Reference items by exact ITEM_ID format
`,

  wardrobe_analysis: `
**CRITICAL: Your response MUST be valid JSON matching this exact structure:**
{
  "overall_assessment": "Comprehensive assessment (minimum 50 characters)",
  "strengths": ["Strength 1", "Strength 2"],
  "gaps": ["Gap 1", "Gap 2"],
  "color_analysis": {
    "dominant_colors": ["color1", "color2"],
    "missing_colors": ["color3", "color4"],
    "harmony_score": 75,
    "recommendations": "Color recommendations (minimum 20 characters)"
  },
  "style_consistency": {
    "score": 80,
    "description": "Style consistency description (minimum 20 characters)"
  },
  "versatility": {
    "score": 85,
    "possible_outfits": "Outfit possibilities description",
    "description": "Versatility description (minimum 20 characters)"
  },
  "investment_priorities": [
    {
      "item": "Specific item recommendation",
      "reason": "Detailed reason (minimum 20 characters)",
      "impact": "Impact description (minimum 10 characters)",
      "priority": 1
    }
  ],
  "organization_tips": ["Tip 1", "Tip 2"],
  "styling_opportunities": [
    {
      "outfit_name": "Outfit name",
      "items": ["item1", "item2"],
      "occasion": "Occasion type",
      "styling_notes": "Styling notes (minimum 10 characters)"
    }
  ],
  "confidence": 0.85
}
`,

  styling_advice: `
**CRITICAL: Your response MUST be valid JSON matching this exact structure:**
{
  "advice": "Comprehensive styling advice (minimum 50 characters)",
  "specific_recommendations": ["Recommendation 1", "Recommendation 2"],
  "color_suggestions": ["Color 1", "Color 2"],
  "styling_tips": ["Tip 1", "Tip 2"],
  "do_and_dont": {
    "do": ["Do this", "Do that"],
    "dont": ["Don't do this", "Don't do that"]
  },
  "confidence": 0.85
}
`,

  item_analysis: `
**CRITICAL: Your response MUST be valid JSON matching this exact structure:**
{
  "category": "Item category",
  "style_tags": ["tag1", "tag2", "tag3"],
  "color": "Primary color",
  "versatility_score": 8,
  "styling_suggestions": ["Suggestion 1", "Suggestion 2"],
  "pairing_recommendations": ["Pairs with X", "Pairs with Y"],
  "occasion_suitability": ["casual", "formal", "business"],
  "care_instructions": "Care instructions",
  "confidence": 0.85
}
`,
};
