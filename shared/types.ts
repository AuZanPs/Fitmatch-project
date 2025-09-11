/**
 * Shared TypeScript interfaces and types for the FitMatch application
 * Replaces 'any' types with proper type definitions
 */

import { STYLE_PREFERENCES } from './constants';

// User and Authentication Types
export interface User {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  user: User;
}

// Clothing Item Types
export interface ClothingItem {
  id: string;
  user_id: string;
  category_id: number;
  image_url: string;
  brand?: string;
  color?: string;
  sub_category?: string;
  material?: string;
  pattern?: string;
  formality_score?: number;
  style_tag_ids: number[];
  created_at: string;
  updated_at: string;
  // Computed fields
  category?: Category;
  style_tags?: StyleTag[];
  clothing_item_style_tags?: Array<{ style_tag: StyleTag }>;
}

export interface Category {
  id: number;
  name: string;
}

export interface StyleTag {
  id: number;
  name: string;
}

// Wardrobe Analysis Types
export interface WardrobeAnalysis {
  overall_assessment: string;
  strengths: string[];
  gaps: string[];
  color_analysis: ColorAnalysis;
  style_consistency: StyleConsistency;
  versatility: VersatilityAnalysis;
  investment_priorities: InvestmentPriority[];
  organization_tips: string[];
  styling_opportunities: StylingOpportunity[];
  confidence: number;
}

export interface ColorAnalysis {
  dominant_colors: string[];
  missing_colors: string[];
  harmony_score: number;
  recommendations: string;
}

export interface StyleConsistency {
  score: number;
  description: string;
}

export interface VersatilityAnalysis {
  score: number;
  possible_outfits: string;
  description: string;
}

export interface InvestmentPriority {
  item: string;
  reason: string;
  impact: string;
  priority: number;
}

export interface StylingOpportunity {
  outfit_name: string;
  items: string[];
  occasion: string;
  styling_notes: string;
}

// Outfit Generation Types
export interface OutfitRequest {
  user_id: string;
  items: ClothingItem[];
  occasion?: string;
  weather?: string;
  style_preference?: string;
  color_preference?: string;
  exclude_items?: string[];
}

export interface OutfitResponse {
  name: string;
  description: string;
  items: string[];
  reasoning: string;
  styling_tips: string[];
  color_analysis: string;
  confidence: number;
  style_match_score: number;
  occasion_suitability?: number;
  weather_appropriateness?: number;
}

// Styling Advice Types
export interface StylingAdvice {
  advice: string;
  specific_recommendations: string[];
  color_suggestions?: string[];
  styling_tips: string[];
  do_and_dont?: {
    do: string[];
    dont: string[];
  };
  confidence: number;
}

// Item Analysis Types
export interface ItemAnalysis {
  category: string;
  style_tags: string[];
  color: string;
  versatility_score: number;
  styling_suggestions: string[];
  pairing_recommendations: string[];
  occasion_suitability: string[];
  care_instructions?: string;
  confidence: number;
}

// Gemini API Types
export interface GeminiRequest {
  wardrobe?: ClothingItem[];
  occasion?: string;
  weather?: string;
  style?: string;
  preferences?: UserPreferences;
}

export interface UserPreferences {
  occasions: readonly (typeof STYLE_PREFERENCES.occasions)[number][];
  weather: readonly (typeof STYLE_PREFERENCES.weather)[number][];
  styles: readonly (typeof STYLE_PREFERENCES.styles)[number][];
  colors?: string[];
  brands?: string[];
  formality_range?: [number, number];
}

// Style Profile Types
export interface UserStyleProfile {
  dominant_styles: string[];
  color_preferences: string[];
  formality_preference: number;
  versatility_score: number;
  sophistication_score: number;
  lifestyle_patterns: string[];
  neutral_balance: number;
}

// Wardrobe Statistics Types
export interface WardrobeStats {
  total_items: number;
  items_by_category: Record<string, number>;
  items_by_color: Record<string, number>;
  items_by_style: Record<string, number>;
  formality_distribution: Record<number, number>;
  completeness_score: number;
}

// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface ValidationResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  fallback?: T;
}

// Component Props Types
export interface EditItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ClothingItem | null;
  categories: Category[];
  styleTags: StyleTag[];
  onSave: (updatedItem: ClothingItem) => void;
}

export interface DashboardFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedStyleTags: number[];
  onStyleTagToggle: (tagId: number) => void;
  styleTags: StyleTag[];
  totalItems: number;
  filteredItemsCount: number;
}

export interface ItemsDisplayProps {
  filteredItems: ClothingItem[];
  allItems: ClothingItem[];
  groupedItems: Record<string, ClothingItem[]>;
  viewMode: 'grid' | 'list';
  searchQuery: string;
  onItemClick: (item: ClothingItem) => void;
  onStyleSelect: (style: string) => void;
}

// Utility Types
export type Occasion = typeof STYLE_PREFERENCES.occasions[number];
export type Weather = typeof STYLE_PREFERENCES.weather[number];
export type StylePreference = typeof STYLE_PREFERENCES.styles[number];

export type PromptType = 'outfit-generation' | 'wardrobe-analysis' | 'styling-advice' | 'item-analysis';

export type ViewMode = 'grid' | 'list';

export type FormalityLevel = 1 | 2 | 3 | 4 | 5;

// Event Handler Types
export type AuthEventCallback = (event: string, session: AuthSession | null) => void;

export type ItemSaveHandler = (updatedItem: ClothingItem) => void;

export type SearchChangeHandler = (query: string) => void;

export type StyleTagToggleHandler = (tagId: number) => void;

export type ItemClickHandler = (item: ClothingItem) => void;

export type StyleSelectHandler = (style: string) => void;

// Error Types
export interface AppError extends Error {
  code?: string;
  statusCode?: number;
  details?: Record<string, unknown>;
}

// Database Types
export interface DatabaseClothingItem {
  id: string;
  user_id: string;
  category_id: number;
  image_url: string;
  brand: string | null;
  color: string | null;
  sub_category: string | null;
  material: string | null;
  pattern: string | null;
  formality_score: number | null;
  created_at: string;
  updated_at: string;
}

export interface DatabaseStyleTag {
  id: number;
  name: string;
  created_at: string;
}

export interface DatabaseCategory {
  id: number;
  name: string;
  created_at: string;
}

// Form Types
export interface ClothingItemFormData {
  category_id: number;
  brand?: string;
  color?: string;
  sub_category?: string;
  material?: string;
  pattern?: string;
  formality_score?: number;
  style_tag_ids: number[];
}

export interface ClothingItemUpdateData extends Partial<ClothingItemFormData> {
  // All fields are optional for updates
}