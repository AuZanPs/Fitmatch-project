import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Sparkles,
  Wand2,
  Heart,
  RefreshCw,
  ArrowLeft,
  Calendar,
  ShoppingBag,
  TrendingUp,
  Lightbulb,
  Star,
  LogOut,
  Upload,
  Plus,
  AlertTriangle,
} from "lucide-react";
import {
  getUserClothingItems,
  signOut,
  getCurrentSession,
  onAuthStateChange,
} from "../lib/supabase";
import type { ClothingItemWithTags } from "../lib/supabase";
import OptimizedImage from "../components/OptimizedImage";

interface OutfitSuggestion {
  id: string;
  name: string;
  description: string;
  items: ClothingItemWithTags[];
  occasion: string;
  weather: string;
  confidence: number;
  reasoning: string;
  styling_tips?: string[];
  color_analysis?: string;
  trend_insights?: string;
}

interface StylePreferences {
  occasion: string;
  weather: string;
  style: string;
  colors: string[];
}

interface WardrobeAnalysis {
  overall_score: number;
  overall_assessment: string;
  strengths: string[];
  gaps: string[];
  color_analysis: {
    dominant_colors: string[];
    missing_colors: string[];
    harmony_score: number;
    recommendations: string;
  };
  style_consistency: {
    score: number;
    description: string;
  };
  versatility: {
    score: number;
    possible_outfits: number;
    description: string;
  };
  seasonal_coverage: {
    spring: number;
    summer: number;
    fall: number;
    winter: number;
    recommendations: string;
  };
  investment_priorities: Array<{
    item: string;
    reason: string;
    impact: string;
    priority: number;
  }>;
  organization_tips: string[];
  styling_opportunities: Array<{
    outfit_name: string;
    items: string[];
    occasion: string;
    styling_notes: string;
  }>;
}

export default function AIStylist() {
  const [user, setUser] = useState<any>(null);
  const [clothingItems, setClothingItems] = useState<ClothingItemWithTags[]>(
    [],
  );
  const [outfitSuggestions, setOutfitSuggestions] = useState<
    OutfitSuggestion[]
  >([]);
  const [wardrobeAnalysis, setWardrobeAnalysis] =
    useState<WardrobeAnalysis | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"outfits" | "analysis">("outfits");

  const [preferences, setPreferences] = useState<StylePreferences>({
    occasion: "casual",
    weather: "mild",
    style: "comfortable",
    colors: [],
  });
  const navigate = useNavigate();

  // Authentication and loading logic
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const sessionResult = await getCurrentSession();
        if (!sessionResult?.data?.session?.user) {
          navigate("/");
          return;
        }
        setUser(sessionResult.data.session.user);
      } catch (error) {
        console.error("Auth check failed:", error);
        navigate("/");
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();

    const {
      data: { subscription },
    } = onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        navigate("/");
      }
    });

    return () => subscription?.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (user) {
      loadClothingItems();
    }
  }, [user]);

  // Memoized expensive calculations
  const wardrobeStats = useMemo(() => {
    if (!clothingItems.length) return { total: 0, categories: {}, brands: {} };

    const categories: Record<string, number> = {};
    const brands: Record<string, number> = {};

    clothingItems.forEach((item) => {
      const category =
        typeof item.category === "string"
          ? item.category
          : item.category?.name || "Unknown";
      const brand = item.brand || "Unknown";

      categories[category] = (categories[category] || 0) + 1;
      brands[brand] = (brands[brand] || 0) + 1;
    });

    return {
      total: clothingItems.length,
      categories,
      brands,
    };
  }, [clothingItems]);

  const canGenerateOutfits = useMemo(() => {
    return clothingItems.length >= 3;
  }, [clothingItems.length]);

  const loadClothingItems = useCallback(async () => {
    if (!user) return;

    try {
      const items = await getUserClothingItems(user.id);
      setClothingItems(items);
    } catch (error) {
      console.error("Error loading clothing items:", error);
      toast.error("Failed to load your wardrobe");
    }
  }, [user]);

  const generateOutfits = useCallback(async () => {
    if (!canGenerateOutfits) {
      toast.error(
        "You need at least 3 clothing items to generate outfits. Upload more items first!",
      );
      return;
    }

    setIsGenerating(true);
    const loadingToast = toast.loading(
      "AI stylist is creating your perfect outfit...",
      {
        duration: Infinity, // Keep loading until we dismiss it manually
      },
    );

    // Add timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      setIsGenerating(false);
      toast.dismiss(loadingToast);
      toast.error("Request timed out. Please try again.");
    }, 30000); // 30 second timeout

    try {
      const response = await fetch("/api/generate-outfits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id, // Add userId for caching system
          items: clothingItems,
          preferences: preferences,
          userProfile: {
            style_inspiration: preferences.style,
            lifestyle: preferences.occasion,
          },
          maxOutfits: 1,
        }),
      });

      clearTimeout(timeoutId);
      toast.dismiss(loadingToast);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (data.outfits && data.outfits.length > 0) {
        setOutfitSuggestions(data.outfits);
        if (data.note) {
          toast.success("Generated outfit suggestions!", {
            description: data.note,
            duration: 5000,
          });
        } else {
          toast.success("Generated your AI outfit suggestion!");
        }
      } else {
        toast.error(
          "No outfit suggestions were generated. Try again with different preferences.",
        );
      }
    } catch (error) {
      clearTimeout(timeoutId);
      toast.dismiss(loadingToast);
      console.error("Error generating outfits:", error);
      
      if (error.message.includes("500")) {
        toast.error("AI service is currently unavailable. Please check your API configuration and try again.", {
          description: "Make sure your GEMINI_API_KEY is properly set in the .env file.",
          duration: 6000,
        });
      } else if (error.message.includes("FUNCTION_INVOCATION_FAILED")) {
        toast.error("AI function failed to execute. Please check your API key configuration.", {
          description: "Visit https://aistudio.google.com/app/apikey to get your Gemini API key.",
          duration: 6000,
        });
      } else {
        toast.error(`Failed to generate outfits: ${error.message}`);
      }
    } finally {
      setIsGenerating(false);
    }
  }, [canGenerateOutfits, clothingItems, preferences]);

  const analyzeWardrobe = useCallback(async () => {
    if (clothingItems.length === 0) {
      toast.error("Add some clothing items to your wardrobe first!");
      return;
    }

    setIsAnalyzing(true);
    setAnalysisProgress(0);

    // More controlled progress simulation for better visibility
    const progressInterval = setInterval(() => {
      setAnalysisProgress((prev) => {
        if (prev >= 90) return prev;
        // Smaller, more frequent increments for smoother progress
        return prev + Math.random() * 8 + 2; // 2-10% increments
      });
    }, 150); // Faster updates for smoother animation

    try {
      const response = await fetch("/api/wardrobe-analysis", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: user.id, // Add userId for caching system
          wardrobe: clothingItems,
          preferences: preferences,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to analyze wardrobe");
      }

      const data = await response.json();
      clearInterval(progressInterval);
      setAnalysisProgress(100);

      setTimeout(() => {
        setWardrobeAnalysis(data.analysis);
        setActiveTab("analysis");
        toast.success("Wardrobe analysis completed!");
        setIsAnalyzing(false);
        setAnalysisProgress(0);
      }, 800); // Longer delay to show 100% completion
    } catch (error) {
      console.error("Error analyzing wardrobe:", error);
      toast.error("Failed to analyze wardrobe. Please try again.");
      clearInterval(progressInterval);
      setIsAnalyzing(false);
      setAnalysisProgress(0);
    }
  }, [clothingItems]);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
      navigate("/");
    } catch (error) {
      console.error("Sign out error:", error);
      toast.error("Failed to sign out");
    }
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-mejiwoo-cream flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="font-montserrat text-lg text-mejiwoo-gray">
            Loading your AI stylist...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mejiwoo-cream">
      {/* Header - Matching Dashboard Style */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20 lg:h-16">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
              <button
                onClick={() => navigate("/dashboard")}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
                title="Back to dashboard"
              >
                <ArrowLeft className="w-5 h-5 text-mejiwoo-gray" />
              </button>
              <div className="flex flex-col lg:flex-row lg:items-center gap-1 lg:gap-4 min-w-0">
                <h1 className="font-playfair text-lg sm:text-xl lg:text-2xl font-bold text-black flex items-center gap-2 min-w-0">
                  <Sparkles className="w-5 h-5 lg:w-6 lg:h-6 text-black flex-shrink-0" />
                  <span className="truncate">AI Personal Stylist</span>
                </h1>
                <div className="hidden lg:flex items-center gap-2 text-sm text-mejiwoo-gray font-montserrat">
                  <span>{clothingItems.length} items in wardrobe</span>
                  {outfitSuggestions.length > 0 && (
                    <>
                      <span>•</span>
                      <span>{outfitSuggestions.length} outfits generated</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate("/upload")}
                className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-montserrat font-medium hover:bg-gray-200 transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Add Item</span>
              </button>

              <button
                onClick={() => navigate("/dashboard")}
                className="bg-black text-white px-4 py-2 rounded-lg font-montserrat font-medium hover:bg-gray-800 transition-colors flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">My Wardrobe</span>
              </button>

              <button
                onClick={handleSignOut}
                className="text-mejiwoo-gray hover:text-black transition-colors"
                title="Sign out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-sm border p-2 mb-6">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setActiveTab("outfits")}
              className={`py-3 px-4 rounded-md font-montserrat font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === "outfits"
                  ? "bg-black text-white shadow-sm"
                  : "text-mejiwoo-gray hover:text-black hover:bg-gray-50"
              }`}
            >
              <Wand2 className="w-4 h-4" />
              AI Outfit Generator
            </button>
            <button
              onClick={() => setActiveTab("analysis")}
              className={`py-3 px-4 rounded-md font-montserrat font-medium transition-colors flex items-center justify-center gap-2 ${
                activeTab === "analysis"
                  ? "bg-black text-white shadow-sm"
                  : "text-mejiwoo-gray hover:text-black hover:bg-gray-50"
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              AI Wardrobe Analysis
            </button>
          </div>
        </div>

        {/* Loading Progress Bar for Wardrobe Analysis */}
        {isAnalyzing && (
          <div className="bg-white rounded-lg shadow-lg border-2 border-black p-8 mb-6">
            <div className="text-center">
              <div className="flex items-center justify-center gap-3 mb-6">
                <Sparkles className="w-8 h-8 text-black animate-pulse" />
                <h2 className="font-playfair text-3xl font-bold text-black">
                  Analyzing Your Wardrobe with AI
                </h2>
              </div>
              <p className="font-montserrat text-lg text-gray-700 mb-8 max-w-md mx-auto">
                Our AI is examining your {clothingItems.length} items to
                identify gaps and opportunities...
              </p>

              {/* Progress Bar */}
              <div className="w-full max-w-md mx-auto bg-gray-300 rounded-full h-2 mb-6">
                <div
                  className="bg-black h-2 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${analysisProgress}%` }}
                ></div>
              </div>

              <div className="flex items-center justify-center gap-3 text-base font-montserrat text-gray-600">
                <span className="font-semibold text-black">
                  {Math.round(analysisProgress)}% complete
                </span>
                <span>•</span>
                <span>
                  {analysisProgress < 30 && "Scanning clothing items..."}
                  {analysisProgress >= 30 &&
                    analysisProgress < 60 &&
                    "Analyzing color combinations..."}
                  {analysisProgress >= 60 &&
                    analysisProgress < 90 &&
                    "Identifying style gaps..."}
                  {analysisProgress >= 90 && "Generating recommendations..."}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content */}
        <div className="space-y-6">
          {/* Outfit Generator Tab */}
          {activeTab === "outfits" && !isAnalyzing && (
            <div className="space-y-6">
              {/* Style Preferences */}
              <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="font-playfair text-xl font-semibold text-black mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-purple-500" />
                  Style Preferences
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block font-montserrat text-sm font-medium text-black mb-2">
                      Occasion
                    </label>
                    <select
                      value={preferences.occasion}
                      onChange={(e) =>
                        setPreferences({
                          ...preferences,
                          occasion: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-montserrat"
                    >
                      <option value="casual">Casual</option>
                      <option value="work">Work</option>
                      <option value="formal">Formal</option>
                      <option value="date">Date Night</option>
                      <option value="party">Party</option>
                      <option value="travel">Travel</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-montserrat text-sm font-medium text-black mb-2">
                      Weather
                    </label>
                    <select
                      value={preferences.weather}
                      onChange={(e) =>
                        setPreferences({
                          ...preferences,
                          weather: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-montserrat"
                    >
                      <option value="hot">Hot</option>
                      <option value="mild">Mild</option>
                      <option value="cold">Cold</option>
                      <option value="rainy">Rainy</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-montserrat text-sm font-medium text-black mb-2">
                      Style Vibe
                    </label>
                    <select
                      value={preferences.style}
                      onChange={(e) =>
                        setPreferences({
                          ...preferences,
                          style: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-montserrat"
                    >
                      <option value="comfortable">Comfortable</option>
                      <option value="elegant">Elegant</option>
                      <option value="edgy">Edgy</option>
                      <option value="romantic">Romantic</option>
                      <option value="minimalist">Minimalist</option>
                      <option value="classic">Classic</option>
                    </select>
                  </div>
                </div>

                {/* Generate Button */}
                <div className="text-center mt-6">
                  <button
                    onClick={generateOutfits}
                    disabled={isGenerating || clothingItems.length < 3}
                    className="bg-black text-white px-8 py-4 rounded-lg font-montserrat font-medium hover:bg-gray-800 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
                  >
                    {isGenerating ? (
                      <>
                        <RefreshCw className="w-5 h-5 animate-spin" />
                        Generating AI Outfit...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        Generate AI Outfit Suggestion
                      </>
                    )}
                  </button>
                  {clothingItems.length < 3 && (
                    <p className="text-sm text-mejiwoo-gray mt-3 font-montserrat">
                      You need at least 3 clothing items to generate an outfit.
                      <button
                        onClick={() => navigate("/upload")}
                        className="text-black hover:text-gray-700 ml-1 underline font-medium"
                      >
                        Upload more items
                      </button>
                    </p>
                  )}
                </div>
              </div>

              {/* Outfit Suggestions */}
              {outfitSuggestions.length > 0 && (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="font-playfair text-xl font-semibold text-black flex items-center gap-2">
                      <Heart className="w-5 h-5 text-red-500" />
                      Your AI-Generated Outfit
                      <span className="text-lg font-normal text-mejiwoo-gray ml-2">
                        (personalized for you)
                      </span>
                    </h2>

                    <button
                      onClick={generateOutfits}
                      disabled={isGenerating}
                      className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg font-montserrat font-medium hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      <RefreshCw
                        className={`w-4 h-4 ${isGenerating ? "animate-spin" : ""}`}
                      />
                      Regenerate
                    </button>
                  </div>

                  <div className="flex justify-center">
                    {outfitSuggestions.map((outfit) => (
                      <div
                        key={outfit.id}
                        className="bg-white rounded-lg shadow-lg border-2 border-black max-w-3xl w-full"
                      >
                        <div className="p-8 border-b-2 border-gray-200">
                          <div className="flex items-center justify-between mb-4">
                            <h3 className="font-playfair text-2xl font-bold text-black">
                              {outfit.name}
                            </h3>
                            <div className="flex items-center gap-2 bg-black text-white px-4 py-2 rounded-lg">
                              <Star className="w-5 h-5 fill-current" />
                              <span className="text-lg font-montserrat font-semibold">
                                {Math.round(outfit.confidence * 100)}%
                              </span>
                            </div>
                          </div>
                          <p className="font-montserrat text-lg text-gray-700 mb-6 leading-relaxed">
                            {outfit.description}
                          </p>

                          <div className="grid grid-cols-3 gap-6 mb-8">
                            {outfit.items.slice(0, 3).map((item) => (
                              <div
                                key={item.id}
                                className="relative group flex flex-col items-center"
                              >
                                <div className="relative w-full aspect-square bg-gray-50 rounded-xl overflow-hidden shadow-sm">
                                  <OptimizedImage
                                    src={item.image_url}
                                    alt={`${item.category} item`}
                                    width={250}
                                    height={250}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                  />
                                  <div className="absolute bottom-3 left-3 bg-black text-white text-xs px-3 py-1.5 rounded-full font-montserrat font-medium shadow-lg">
                                    {typeof item.category === "string"
                                      ? item.category
                                      : item.category?.name}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="p-8 space-y-6">
                          <div className="bg-gray-50 border-l-4 border-black p-6 rounded-r-lg">
                            <h4 className="font-playfair text-xl font-bold text-black mb-3 flex items-center gap-2">
                              <span className="w-2 h-2 bg-black rounded-full"></span>
                              AI Reasoning
                            </h4>
                            <p className="font-montserrat text-base text-gray-800 leading-relaxed">
                              {outfit.reasoning}
                            </p>
                          </div>

                          {outfit.styling_tips &&
                            outfit.styling_tips.length > 0 && (
                              <div className="bg-gray-50 border-l-4 border-black p-6 rounded-r-lg">
                                <h4 className="font-playfair text-xl font-bold text-black mb-4 flex items-center gap-2">
                                  <Lightbulb className="w-6 h-6 text-black" />
                                  Styling Tips
                                </h4>
                                <ul className="space-y-3">
                                  {outfit.styling_tips.map((tip, index) => (
                                    <li
                                      key={index}
                                      className="font-montserrat text-base text-gray-800 flex items-start gap-3"
                                    >
                                      <span className="w-2 h-2 bg-black rounded-full mt-2 flex-shrink-0"></span>
                                      {tip}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                          {outfit.color_analysis && (
                            <div className="bg-gray-50 border-l-4 border-black p-6 rounded-r-lg">
                              <h4 className="font-playfair text-xl font-bold text-black mb-3 flex items-center gap-2">
                                <span className="w-2 h-2 bg-black rounded-full"></span>
                                Color Analysis
                              </h4>
                              <p className="font-montserrat text-base text-gray-800 leading-relaxed">
                                {outfit.color_analysis}
                              </p>
                            </div>
                          )}

                          {outfit.trend_insights && (
                            <div className="bg-gray-50 border-l-4 border-black p-6 rounded-r-lg">
                              <h4 className="font-playfair text-xl font-bold text-black mb-3 flex items-center gap-2">
                                <TrendingUp className="w-6 h-6 text-black" />
                                Trend Insights
                              </h4>
                              <p className="font-montserrat text-base text-gray-800 leading-relaxed">
                                {outfit.trend_insights}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Wardrobe Analysis Tab */}
          {activeTab === "analysis" && !isAnalyzing && (
            <div className="space-y-6">
              {wardrobeAnalysis ? (
                <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
                  {/* Header */}
                  <div className="bg-gradient-to-r from-black to-gray-800 p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
                          <TrendingUp className="w-6 h-6 text-black" />
                        </div>
                        <div>
                          <h3 className="font-playfair text-xl font-bold text-white">
                            Wardrobe Analysis
                          </h3>
                          <p className="font-montserrat text-sm text-gray-300">
                            AI-powered insights for your style
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={analyzeWardrobe}
                        disabled={isAnalyzing}
                        className="bg-white bg-opacity-20 text-white px-4 py-2 rounded-lg font-montserrat font-medium hover:bg-opacity-30 transition-colors disabled:opacity-50 flex items-center gap-2"
                      >
                        <RefreshCw
                          className={`w-4 h-4 ${isAnalyzing ? "animate-spin" : ""}`}
                        />
                        Re-analyze
                      </button>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-8 space-y-6">
                    {/* Wardrobe Gaps */}
                    {wardrobeAnalysis.gaps.length > 0 && (
                      <div className="bg-gray-50 border-l-4 border-black p-4 sm:p-6 rounded-r-lg">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-4">
                          <h4 className="font-playfair text-lg sm:text-xl font-bold text-black flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 flex-shrink-0" />
                            <span>Wardrobe Gaps</span>
                          </h4>
                          <span className="bg-gray-200 text-black text-xs sm:text-sm px-2 py-1 rounded-full self-start sm:self-auto">
                            {wardrobeAnalysis.gaps.length} items identified
                          </span>
                        </div>
                        <ul className="space-y-3">
                          {wardrobeAnalysis.gaps.map((gap, index) => (
                            <li
                              key={index}
                              className="font-montserrat text-sm sm:text-base text-gray-800 flex items-start gap-3"
                            >
                              <span className="w-2 h-2 bg-black rounded-full mt-2 flex-shrink-0"></span>
                              {gap}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Shopping Recommendations */}
                    {wardrobeAnalysis.investment_priorities.length > 0 && (
                      <div className="bg-gray-50 border-l-4 border-black p-4 sm:p-6 rounded-r-lg">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-4">
                          <h4 className="font-playfair text-lg sm:text-xl font-bold text-black flex items-center gap-2">
                            <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-600 flex-shrink-0" />
                            <span>Investment Priorities</span>
                          </h4>
                          <span className="bg-gray-200 text-black text-xs sm:text-sm px-2 py-1 rounded-full self-start sm:self-auto">
                            {wardrobeAnalysis.investment_priorities.length}{" "}
                            recommendations
                          </span>
                        </div>
                        <ul className="space-y-3">
                          {wardrobeAnalysis.investment_priorities.map(
                            (item, index) => (
                              <li
                                key={index}
                                className="font-montserrat text-sm sm:text-base text-gray-800 flex items-start gap-3"
                              >
                                <span className="w-2 h-2 bg-black rounded-full mt-2 flex-shrink-0"></span>
                                <div>
                                  <strong>{item.item}</strong> - {item.reason}
                                  <div className="text-xs text-gray-600 mt-1">
                                    Impact: {item.impact}
                                  </div>
                                </div>
                              </li>
                            ),
                          )}
                        </ul>
                      </div>
                    )}

                    {/* Organization Tips */}
                    {wardrobeAnalysis.organization_tips.length > 0 && (
                      <div className="bg-gray-50 border-l-4 border-black p-4 sm:p-6 rounded-r-lg">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-4">
                          <h4 className="font-playfair text-lg sm:text-xl font-bold text-black flex items-center gap-2">
                            <Star className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600 flex-shrink-0" />
                            <span>Organization Tips</span>
                          </h4>
                          <span className="bg-gray-200 text-black text-xs sm:text-sm px-2 py-1 rounded-full self-start sm:self-auto">
                            {wardrobeAnalysis.organization_tips.length} tips
                          </span>
                        </div>
                        <ul className="space-y-3">
                          {wardrobeAnalysis.organization_tips.map(
                            (tip, index) => (
                              <li
                                key={index}
                                className="font-montserrat text-sm sm:text-base text-gray-800 flex items-start gap-3"
                              >
                                <span className="w-2 h-2 bg-black rounded-full mt-2 flex-shrink-0"></span>
                                {tip}
                              </li>
                            ),
                          )}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-white rounded-lg shadow-sm border">
                  <div className="text-center py-12">
                    <TrendingUp className="w-16 h-16 text-mejiwoo-gray mx-auto mb-4" />
                    <h3 className="font-inter text-xl font-semibold text-black mb-2">
                      Get AI-Powered Wardrobe Insights
                    </h3>
                    <p className="font-montserrat text-mejiwoo-gray mb-6 max-w-md mx-auto">
                      Discover gaps in your wardrobe, get personalized shopping
                      recommendations, and find priority items to enhance your
                      style.
                    </p>
                    {clothingItems.length === 0 ? (
                      <div className="space-y-4">
                        <p className="font-montserrat text-sm text-mejiwoo-gray">
                          Add some clothing items to your wardrobe first.
                        </p>
                        <button
                          onClick={() => navigate("/upload")}
                          className="bg-black text-white px-6 py-3 rounded-lg font-montserrat font-medium hover:bg-gray-800 transition-colors inline-flex items-center gap-2"
                        >
                          <Upload className="w-5 h-5" />
                          Upload Your First Item
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={analyzeWardrobe}
                        disabled={isAnalyzing}
                        className="bg-black text-white px-6 py-3 rounded-lg font-montserrat font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 inline-flex items-center gap-2"
                      >
                        <TrendingUp className="w-5 h-5" />
                        Analyze My Wardrobe ({clothingItems.length} items)
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
