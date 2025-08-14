// Application constants and configuration

export const APP_CONFIG = {
  name: 'FitMatch',
  description: 'AI-Powered Personal Styling Platform',
  version: '1.0.0'
} as const;

export const DEFAULT_CATEGORIES = [
  { id: 1, name: 'Tops' },
  { id: 2, name: 'Bottoms' },
  { id: 3, name: 'Outerwear' },
  { id: 4, name: 'Shoes' },
  { id: 5, name: 'Accessories' },
  { id: 6, name: 'Dresses' },
  { id: 7, name: 'Activewear' }
];

export const DEFAULT_STYLE_TAGS = [
  { id: 1, name: 'Casual' },
  { id: 2, name: 'Formal' },
  { id: 3, name: 'Business' },
  { id: 4, name: 'Sport' },
  { id: 5, name: 'Party' },
  { id: 6, name: 'Beach' },
  { id: 7, name: 'Vintage' },
  { id: 8, name: 'Modern' }
];

export const STYLE_PREFERENCES = {
  occasions: ['casual', 'work', 'formal', 'date', 'party', 'travel'] as const,
  weather: ['hot', 'mild', 'cold', 'rainy'] as const,
  styles: ['comfortable', 'elegant', 'edgy', 'romantic', 'minimalist', 'bohemian', 'classic'] as const
} as const;

export const API_ENDPOINTS = {
  ping: '/api',
  generateOutfits: '/api/generate-outfits',
  stylingAdvice: '/api/styling-advice'
} as const;

export const GEMINI_CONFIG = {
  model: 'gemini-2.5-flash-latest',
  maxRetries: 2,
  timeout: 30000 // 30 seconds
} as const;
