import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  getStyleTags,
  getClothingItemsByStyle,
  getUserClothingItems,
  signOut,
  getCurrentSession,
  onAuthStateChange,
} from "../lib/supabase";
import { toast } from "sonner";
import type { StyleTag, ClothingItemWithTags } from "../lib/supabase";
import {
  Plus,
  LogOut,
  Upload,
  Sparkles,
  Grid3X3,
  List,
  Filter,
  Search,
  Trash2,
  X,
} from "lucide-react";
import OptimizedImage from "../components/OptimizedImage";

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [styleTags, setStyleTags] = useState<StyleTag[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<StyleTag | null>(null);
  const [clothingItems, setClothingItems] = useState<ClothingItemWithTags[]>(
    [],
  );
  const [allItems, setAllItems] = useState<ClothingItemWithTags[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchQuery, setSearchQuery] = useState("");
  const [styleSearchQuery, setStyleSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [showStyleSuggestions, setShowStyleSuggestions] = useState(false);
  const [selectedImageModal, setSelectedImageModal] =
    useState<ClothingItemWithTags | null>(null);
  const navigate = useNavigate();

  // Memoize expensive calculations
  const styleItemCounts = useMemo(() => {
    return styleTags.reduce(
      (acc, style) => {
        acc[style.id] = allItems.filter((item) =>
          item.clothing_item_style_tags?.some(
            (tag) => tag.style_tag.id === style.id,
          ),
        ).length;
        return acc;
      },
      {} as Record<number, number>,
    );
  }, [allItems, styleTags]);

  const getItemCountForStyle = useCallback(
    (styleId: number): number => {
      return styleItemCounts[styleId] || 0;
    },
    [styleItemCounts],
  );

  // Memoize filtered items for search
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return clothingItems;

    const query = searchQuery.toLowerCase();
    return clothingItems.filter((item) => {
      const category =
        typeof item.category === "string"
          ? item.category
          : item.category?.name || "";
      return (
        category.toLowerCase().includes(query) ||
        item.brand?.toLowerCase().includes(query) ||
        item.color?.toLowerCase().includes(query) ||
        item.clothing_item_style_tags?.some((tag) =>
          tag.style_tag.name.toLowerCase().includes(query),
        )
      );
    });
  }, [clothingItems, searchQuery]);

  // Memoize filtered style suggestions
  const filteredStyleSuggestions = useMemo(() => {
    const query = styleSearchQuery.toLowerCase();
    return styleTags.filter((style) => {
      // Always filter out styles with no items
      const hasItems = getItemCountForStyle(style.id) > 0;
      if (!hasItems) return false;

      // If no search query, show all styles that have items
      if (!query.trim()) return true;

      // If there's a search query, check if it matches
      const matchesSearch = style.name.toLowerCase().includes(query);
      return matchesSearch;
    });
  }, [styleTags, styleSearchQuery, getItemCountForStyle]);

  useEffect(() => {
    let mounted = true;

    const checkAuthAndLoadData = async () => {
      try {
        const sessionResult = await getCurrentSession();

        if (!mounted) return; // Prevent state updates if component unmounted

        if (sessionResult?.data?.session?.user) {
          setUser(sessionResult.data.session.user);
          // Load data after setting user
          await loadStyleTags(sessionResult.data.session.user);
        } else {
          navigate("/");
          return;
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        if (mounted) {
          navigate("/");
        }
        return;
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    checkAuthAndLoadData();

    const {
      data: { subscription },
    } = onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === "SIGNED_OUT" || !session?.user) {
        navigate("/");
      }
      // Remove the duplicate navigation that was causing issues
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  // Handle keyboard events for modal
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && selectedImageModal) {
        setSelectedImageModal(null);
      }
    };

    if (selectedImageModal) {
      document.addEventListener("keydown", handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [selectedImageModal]);

  const loadStyleTags = async (currentUser: any = user) => {
    if (!currentUser) return;

    try {
      const tags = await getStyleTags();
      setStyleTags(tags);

      // Load all items first
      const items = await getUserClothingItems(currentUser.id);
      setAllItems(items);

      // Set selectedStyle to null so "All Items" is shown by default
      setSelectedStyle(null);
      setClothingItems(items);
    } catch (error: any) {
      console.error("Error loading style tags:", error);
      if (error.message.includes('relation "style_tags" does not exist')) {
        toast.error(
          "Database not set up. Please run the database setup script in Supabase.",
        );
      } else {
        toast.error("Failed to load style tags");
      }
    }
  };

  const loadClothingItems = async (
    styleTagId: number,
    currentUser: any = user,
  ) => {
    if (!currentUser) return;

    try {
      const items = await getClothingItemsByStyle(currentUser.id, styleTagId);
      setClothingItems(items);
    } catch (error: any) {
      toast.error("Failed to load clothing items");
      console.error(error);
    }
  };

  const handleStyleChange = (style: StyleTag | null) => {
    setSelectedStyle(style);
    if (style) {
      loadClothingItems(style.id);
    } else {
      // Show all items when no style is selected
      setClothingItems(allItems);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/");
    } catch (error: any) {
      toast.error("Failed to sign out");
    }
  };

  // Memoize grouped items by category
  const groupedItems = useMemo(() => {
    return filteredItems.reduce(
      (acc, item) => {
        const categoryName = item.category?.name || "Uncategorized";
        if (!acc[categoryName]) {
          acc[categoryName] = [];
        }
        acc[categoryName].push(item);
        return acc;
      },
      {} as Record<string, ClothingItemWithTags[]>,
    );
  }, [filteredItems]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-mejiwoo-cream flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="font-montserrat text-lg text-mejiwoo-gray">
            Loading your wardrobe...
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Full Screen Image Modal */}
      {selectedImageModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4"
          onClick={() => setSelectedImageModal(null)}
        >
          <div className="relative max-w-6xl max-h-full w-full mx-2">
            {/* Close Button - Larger and more accessible on mobile */}
            <button
              onClick={() => setSelectedImageModal(null)}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 bg-white bg-opacity-95 hover:bg-opacity-100 text-black rounded-full p-3 sm:p-3 transition-all shadow-lg touch-manipulation"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>

            {/* Main Content Container */}
            <div className="bg-white rounded-xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] sm:max-h-[90vh] flex flex-col lg:flex-row">
              {/* Image Section */}
              <div
                className="flex-1 bg-gray-50 flex items-center justify-center p-3 sm:p-6 lg:p-8 min-h-[45vh] lg:min-h-0"
                onClick={(e) => e.stopPropagation()}
              >
                <OptimizedImage
                  src={selectedImageModal.image_url}
                  alt={`${selectedImageModal.brand || ""} ${selectedImageModal.color || ""}`}
                  width={600}
                  height={600}
                  className="max-w-full max-h-[45vh] sm:max-h-[50vh] lg:max-h-[70vh] object-contain rounded-lg shadow-lg"
                />
              </div>

              {/* Details Section - Better mobile layout */}
              <div className="w-full lg:w-80 bg-white p-4 sm:p-6 lg:p-8 flex flex-col justify-between max-h-[45vh] lg:max-h-none overflow-y-auto lg:overflow-visible">
                <div>
                  {/* Header */}
                  <div className="mb-4 sm:mb-6">
                    <h2 className="font-playfair text-xl sm:text-2xl font-bold text-black mb-2">
                      {selectedImageModal.brand || "Item Details"}
                    </h2>
                    <p className="text-mejiwoo-gray font-montserrat text-sm">
                      {typeof selectedImageModal.category === "string"
                        ? selectedImageModal.category
                        : selectedImageModal.category?.name || "No Category"}
                    </p>
                  </div>

                  {/* Color */}
                  {selectedImageModal.color && (
                    <div className="mb-6">
                      <h3 className="font-playfair text-sm font-semibold text-black mb-3">
                        Color
                      </h3>
                      <div className="inline-flex items-center bg-gradient-to-r from-mejiwoo-cream to-gray-50 border border-gray-200 px-4 py-2 rounded-lg shadow-sm">
                        <div className="w-3 h-3 rounded-full bg-gray-400 mr-2 border border-gray-300"></div>
                        <span className="text-sm font-medium text-black">
                          {selectedImageModal.color}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Style Tags */}
                  {selectedImageModal.clothing_item_style_tags &&
                    selectedImageModal.clothing_item_style_tags.length > 0 && (
                      <div className="mb-6">
                        <h3 className="font-playfair text-sm font-semibold text-black mb-3">
                          Style Tags
                        </h3>
                        <div className="flex flex-wrap gap-2">
                          {selectedImageModal.clothing_item_style_tags.map(
                            (tagRelation) => (
                              <span
                                key={tagRelation.style_tag.id}
                                className="bg-gradient-to-r from-black to-gray-800 text-white px-4 py-2 rounded-lg text-xs font-medium shadow-sm hover:shadow-md transition-shadow border border-gray-700"
                              >
                                {tagRelation.style_tag.name}
                              </span>
                            ),
                          )}
                        </div>
                      </div>
                    )}
                </div>

                {/* Footer - Better mobile layout */}
                <div className="pt-4 sm:pt-6 border-t border-gray-100 mt-auto">
                  <p className="text-xs text-mejiwoo-gray font-montserrat text-center">
                    Tap outside or swipe down to close
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-mejiwoo-cream">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
            <div className="flex items-center justify-between h-14 sm:h-16">
              <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                <h1 className="font-playfair text-lg sm:text-xl lg:text-2xl font-bold text-black truncate">
                  My FitMatch
                </h1>
                <div className="hidden md:flex items-center gap-2 text-xs sm:text-sm text-mejiwoo-gray font-montserrat">
                  <span>{allItems.length} items</span>
                  {selectedStyle && (
                    <>
                      <span>•</span>
                      <span className="truncate">
                        {filteredItems.length}{" "}
                        {selectedStyle.name.toLowerCase()}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 sm:gap-2 lg:gap-3">
                {/* Mobile View Toggle - Show on small screens */}
                <div className="sm:hidden flex items-center bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`p-1.5 rounded-md transition-colors ${
                      viewMode === "grid"
                        ? "bg-white shadow-sm"
                        : "hover:bg-gray-200"
                    }`}
                    title="Grid view"
                  >
                    <Grid3X3 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`p-1.5 rounded-md transition-colors ${
                      viewMode === "list"
                        ? "bg-white shadow-sm"
                        : "hover:bg-gray-200"
                    }`}
                    title="List view"
                  >
                    <List className="w-3 h-3" />
                  </button>
                </div>

                {/* Desktop View Toggle */}
                <div className="hidden sm:flex items-center bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`p-1.5 sm:p-2 rounded-md transition-colors ${
                      viewMode === "grid"
                        ? "bg-white shadow-sm"
                        : "hover:bg-gray-200"
                    }`}
                    title="Grid view"
                  >
                    <Grid3X3 className="w-3 h-3 sm:w-4 sm:h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`p-1.5 sm:p-2 rounded-md transition-colors ${
                      viewMode === "list"
                        ? "bg-white shadow-sm"
                        : "hover:bg-gray-200"
                    }`}
                    title="List view"
                  >
                    <List className="w-3 h-3 sm:w-4 sm:h-4" />
                  </button>
                </div>

                {/* Filter Toggle */}
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="p-1.5 sm:p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  title="Filters"
                >
                  <Filter className="w-3 h-3 sm:w-4 sm:h-4" />
                </button>

                {/* Add Item Button - More prominent on mobile */}
                <button
                  onClick={() => navigate("/upload")}
                  className="bg-black text-white px-3 sm:px-3 lg:px-4 py-1.5 sm:py-2 rounded-lg font-montserrat font-medium hover:bg-gray-800 transition-colors flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
                >
                  <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="sm:hidden">Add</span>
                  <span className="hidden sm:inline lg:hidden">Add</span>
                  <span className="hidden lg:inline">Add Item</span>
                </button>

                {/* Manage Items Button - Hide on mobile when space is tight */}
                {allItems.length > 0 && (
                  <button
                    onClick={() => navigate("/manage-items")}
                    className="hidden sm:flex bg-red-600 text-white px-2 sm:px-3 lg:px-4 py-1.5 sm:py-2 rounded-lg font-montserrat font-medium hover:bg-red-700 transition-colors items-center gap-1 sm:gap-2 text-xs sm:text-sm"
                  >
                    <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden lg:inline">Manage</span>
                  </button>
                )}

                {/* AI Stylist Button */}
                <button
                  onClick={() => navigate("/ai-stylist")}
                  className="bg-purple-600 text-white px-2 sm:px-3 lg:px-4 py-1.5 sm:py-2 rounded-lg font-montserrat font-medium hover:bg-purple-700 transition-colors flex items-center gap-1 sm:gap-2 text-xs sm:text-sm"
                  title="AI Personal Stylist"
                >
                  <Sparkles className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline lg:hidden">AI</span>
                  <span className="hidden lg:inline">AI Stylist</span>
                </button>

                <button
                  onClick={handleSignOut}
                  className="text-mejiwoo-gray hover:text-black transition-colors p-1"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-3 sm:py-4 lg:py-6">
          {/* Enhanced Filters Section */}
          {showFilters && (
            <div className="bg-white rounded-lg shadow-sm border p-4 sm:p-6 mb-4 sm:mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-playfair text-base sm:text-lg font-semibold text-black">
                  Filters & Search
                </h3>
                <button
                  onClick={() => setShowFilters(false)}
                  className="text-xs sm:text-sm text-mejiwoo-gray hover:text-black transition-colors flex items-center gap-1 font-montserrat"
                >
                  <X className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">
                    Back to Simple Search
                  </span>
                  <span className="sm:hidden">Back</span>
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative mb-4 sm:mb-6">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search by brand, color, or category..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 sm:py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none text-sm sm:text-base"
                />
              </div>

              {/* Style Tags Filter */}
              <div>
                <h4 className="font-inter text-xs sm:text-sm font-medium text-black mb-3">
                  Filter by Style
                </h4>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleStyleChange(null)}
                    className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full font-inter font-medium transition-colors text-xs sm:text-sm ${
                      !selectedStyle
                        ? "bg-black text-white"
                        : "bg-gray-100 text-black hover:bg-gray-200"
                    }`}
                  >
                    All Styles ({allItems.length})
                  </button>
                  {[...styleTags]
                    .sort((a, b) => {
                      const countA = getItemCountForStyle(a.id);
                      const countB = getItemCountForStyle(b.id);
                      // Sort by item count (descending), then by name (ascending)
                      if (countB !== countA) return countB - countA;
                      return a.name.localeCompare(b.name);
                    })
                    .map((style) => {
                      const itemCount = getItemCountForStyle(style.id);
                      return (
                        <button
                          key={style.id}
                          onClick={() => handleStyleChange(style)}
                          className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full font-inter font-medium transition-colors text-xs sm:text-sm ${
                            selectedStyle?.id === style.id
                              ? "bg-black text-white"
                              : itemCount > 0
                                ? "bg-gray-100 text-black hover:bg-gray-200"
                                : "bg-gray-50 text-gray-400 hover:bg-gray-100"
                          }`}
                        >
                          {style.name} ({itemCount})
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>
          )}

          {/* Style Search Section (Always Visible) */}
          {!showFilters && (
            <div className="mb-4 sm:mb-6">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h2 className="font-playfair text-lg sm:text-xl font-semibold text-black">
                  Find Your Style
                </h2>
                <button
                  onClick={() => setShowFilters(true)}
                  className="text-xs sm:text-sm text-mejiwoo-gray hover:text-black transition-colors flex items-center gap-1"
                >
                  <Search className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Advanced Filters</span>
                  <span className="sm:hidden">Filters</span>
                </button>
              </div>

              {/* Style Search Input */}
              <div className="relative mb-3 sm:mb-4">
                <Search className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5 z-10" />
                <input
                  type="text"
                  placeholder="Search for styles (e.g. casual, formal, vintage)..."
                  value={styleSearchQuery}
                  onFocus={() => setShowStyleSuggestions(true)}
                  onBlur={() => {
                    // Delay hiding to allow clicking on suggestions
                    setTimeout(() => setShowStyleSuggestions(false), 200);
                  }}
                  onChange={(e) => {
                    setStyleSearchQuery(e.target.value);
                    setShowStyleSuggestions(true);

                    // Filter styles based on search and update selection
                    const matchingStyle = styleTags.find((style) =>
                      style.name
                        .toLowerCase()
                        .includes(e.target.value.toLowerCase().trim()),
                    );
                    if (e.target.value.trim() === "") {
                      handleStyleChange(null); // Show all items when empty
                    } else if (
                      matchingStyle &&
                      e.target.value.toLowerCase() ===
                        matchingStyle.name.toLowerCase()
                    ) {
                      handleStyleChange(matchingStyle);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const matchingStyle = styleTags.find((style) =>
                        style.name
                          .toLowerCase()
                          .includes(styleSearchQuery.toLowerCase().trim()),
                      );
                      if (matchingStyle) {
                        handleStyleChange(matchingStyle);
                        setShowStyleSuggestions(false);
                      }
                    }
                    if (e.key === "Escape") {
                      setShowStyleSuggestions(false);
                    }
                  }}
                  className="w-full pl-10 sm:pl-12 pr-10 sm:pr-12 py-3 sm:py-4 text-sm sm:text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none font-montserrat"
                />
                {styleSearchQuery && (
                  <button
                    onClick={() => {
                      setStyleSearchQuery("");
                      handleStyleChange(null);
                      setShowStyleSuggestions(false);
                    }}
                    className="absolute right-3 sm:right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-black transition-colors z-10"
                  >
                    <X className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                )}

                {/* Style Suggestions Dropdown */}
                {showStyleSuggestions && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
                    {/* Show All Items option */}
                    <button
                      onClick={() => {
                        setStyleSearchQuery("");
                        handleStyleChange(null);
                        setShowStyleSuggestions(false);
                      }}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 ${
                        !selectedStyle
                          ? "bg-black text-white hover:bg-gray-800"
                          : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">All Items</span>
                        <span
                          className={`text-sm ${!selectedStyle ? "text-gray-300" : "text-gray-500"}`}
                        >
                          {allItems.length} items
                        </span>
                      </div>
                    </button>

                    {/* Filtered Style Suggestions */}
                    {filteredStyleSuggestions.length > 0 ? (
                      filteredStyleSuggestions.map((style) => {
                        const itemCount = getItemCountForStyle(style.id);

                        return (
                          <button
                            key={style.id}
                            onClick={() => {
                              setStyleSearchQuery(style.name);
                              handleStyleChange(style);
                              setShowStyleSuggestions(false);
                            }}
                            className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                              selectedStyle?.id === style.id
                                ? "bg-black text-white hover:bg-gray-800"
                                : ""
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{style.name}</span>
                              <span
                                className={`text-sm ${
                                  selectedStyle?.id === style.id
                                    ? "text-gray-300"
                                    : "text-gray-500"
                                }`}
                              >
                                {itemCount} items
                              </span>
                            </div>
                          </button>
                        );
                      })
                    ) : styleSearchQuery.trim() ? (
                      <div className="px-4 py-3 text-gray-500 text-sm">
                        No styles found matching "{styleSearchQuery}"
                      </div>
                    ) : null}

                    {/* Help text */}
                    {!styleSearchQuery.trim() && (
                      <div className="px-4 py-2 text-xs text-gray-400 border-t border-gray-100">
                        Start typing to search through your available styles
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Show current selection */}
              <div className="flex items-center gap-2 text-xs sm:text-sm text-mejiwoo-gray font-montserrat">
                {selectedStyle ? (
                  <>
                    <span>Showing</span>
                    <span className="bg-black text-white px-2 sm:px-3 py-1 rounded-full text-xs font-medium">
                      {selectedStyle.name}
                    </span>
                    <span>•</span>
                    <span>{filteredItems.length} items</span>
                  </>
                ) : (
                  <>
                    <span>Showing</span>
                    <span className="bg-gray-100 text-black px-2 sm:px-3 py-1 rounded-full text-xs font-medium">
                      All Items
                    </span>
                    <span>•</span>
                    <span>{allItems.length} items</span>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Enhanced Clothing Items Display */}
          <div className="mb-6 sm:mb-8">
            {selectedStyle ? (
              <h3 className="font-inter text-lg sm:text-xl lg:text-2xl font-bold text-black mb-4 sm:mb-6">
                {selectedStyle.name} Items
                <span className="text-sm sm:text-lg font-normal text-mejiwoo-gray ml-2">
                  ({filteredItems.length} items)
                </span>
              </h3>
            ) : (
              <h3 className="font-inter text-lg sm:text-xl lg:text-2xl font-bold text-black mb-4 sm:mb-6">
                All Items
                <span className="text-sm sm:text-lg font-normal text-mejiwoo-gray ml-2">
                  ({filteredItems.length} items)
                </span>
              </h3>
            )}

            {Object.keys(groupedItems).length === 0 ? (
              <div className="bg-white rounded-lg p-12 text-center">
                <Upload className="w-16 h-16 text-mejiwoo-gray mx-auto mb-4" />
                <h4 className="font-inter text-xl font-semibold text-black mb-2">
                  {selectedStyle
                    ? `No ${selectedStyle.name.toLowerCase()} items yet`
                    : "Your wardrobe is empty"}
                </h4>
                <p className="font-inter text-mejiwoo-gray mb-6">
                  {searchQuery
                    ? `No items match "${searchQuery}". Try adjusting your search.`
                    : "Start building your digital wardrobe by uploading photos of your favorite clothes."}
                </p>
                {!searchQuery && (
                  <div className="space-y-3">
                    <button
                      onClick={() => navigate("/upload")}
                      className="bg-black text-white px-6 py-3 rounded-lg font-inter font-medium hover:bg-gray-800 transition-colors inline-flex items-center gap-2"
                    >
                      <Plus className="w-5 h-5" />
                      Upload Your First Item
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6 sm:space-y-8">
                {Object.entries(groupedItems).map(([category, items]) => (
                  <div
                    key={category}
                    className="bg-white rounded-lg shadow-sm border p-4 sm:p-6"
                  >
                    <div className="flex items-center justify-between mb-4 sm:mb-6">
                      <h4 className="font-inter text-base sm:text-lg font-semibold text-black">
                        {category}
                        <span className="text-xs sm:text-sm font-normal text-mejiwoo-gray ml-2">
                          ({items.length} items)
                        </span>
                      </h4>
                    </div>

                    {/* Grid View */}
                    {viewMode === "grid" && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3 lg:gap-4">
                        {items.map((item) => (
                          <div
                            key={item.id}
                            className="group relative aspect-square rounded-lg overflow-hidden bg-gray-100 hover:shadow-lg transition-all duration-200 cursor-pointer touch-manipulation"
                            onClick={() => setSelectedImageModal(item)}
                          >
                            <OptimizedImage
                              src={item.image_url}
                              alt={`${item.brand || ""} ${item.color || ""} ${category}`}
                              width={300}
                              height={300}
                              className="w-full h-full group-hover:scale-105 transition-transform duration-200"
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200">
                              <div className="absolute bottom-0 left-0 right-0 p-1.5 sm:p-2 lg:p-3 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                <p className="text-white text-xs font-inter font-medium truncate">
                                  {item.brand && `${item.brand}`}
                                  {item.brand && item.color && " • "}
                                  {item.color}
                                </p>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {item.clothing_item_style_tags
                                    ?.slice(0, 1)
                                    .map((tagRelation) => (
                                      <span
                                        key={tagRelation.style_tag.id}
                                        className="text-xs bg-white/20 text-white px-1.5 py-0.5 rounded-full"
                                      >
                                        {tagRelation.style_tag.name}
                                      </span>
                                    ))}
                                  {item.clothing_item_style_tags &&
                                    item.clothing_item_style_tags.length >
                                      1 && (
                                      <span className="text-xs bg-white/20 text-white px-1.5 py-0.5 rounded-full">
                                        +
                                        {item.clothing_item_style_tags.length -
                                          1}
                                      </span>
                                    )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* List View */}
                    {viewMode === "list" && (
                      <div className="space-y-2 sm:space-y-3">
                        {items.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer"
                            onClick={() => setSelectedImageModal(item)}
                          >
                            <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                              <OptimizedImage
                                src={item.image_url}
                                alt={`${item.brand || ""} ${item.color || ""} ${category}`}
                                width={64}
                                height={64}
                                className="w-full h-full"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h5 className="font-inter font-medium text-black text-sm sm:text-base truncate">
                                  {item.brand || "No Brand"}
                                </h5>
                                {item.color && (
                                  <span className="text-xs sm:text-sm text-mejiwoo-gray flex-shrink-0">
                                    • {item.color}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {item.clothing_item_style_tags
                                  ?.slice(0, 3)
                                  .map((tagRelation) => (
                                    <span
                                      key={tagRelation.style_tag.id}
                                      className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full"
                                    >
                                      {tagRelation.style_tag.name}
                                    </span>
                                  ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Mobile Bottom Navigation */}
        <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 z-40">
          <div className="flex items-center justify-around">
            {/* Upload Button */}
            <button
              onClick={() => navigate("/upload")}
              className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Plus className="w-5 h-5 text-black" />
              <span className="text-xs font-montserrat text-black">Upload</span>
            </button>

            {/* AI Stylist */}
            <button
              onClick={() => navigate("/ai-stylist")}
              className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-gray-50 transition-colors"
              title="AI Personal Stylist"
            >
              <Sparkles className="w-5 h-5 text-purple-600" />
              <span className="text-xs font-montserrat text-purple-600">
                AI
              </span>
            </button>

            {/* Manage Items (if items exist) */}
            {allItems.length > 0 && (
              <button
                onClick={() => navigate("/manage-items")}
                className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Trash2 className="w-5 h-5 text-red-600" />
                <span className="text-xs font-montserrat text-red-600">
                  Manage
                </span>
              </button>
            )}

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex flex-col items-center gap-1 p-2 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Filter
                className={`w-5 h-5 ${showFilters ? "text-black" : "text-gray-600"}`}
              />
              <span
                className={`text-xs font-montserrat ${showFilters ? "text-black" : "text-gray-600"}`}
              >
                {showFilters ? "Close" : "Filter"}
              </span>
            </button>
          </div>
        </div>

        {/* Add bottom padding for mobile to account for bottom navigation */}
        <div className="sm:hidden h-16"></div>
      </div>
    </>
  );
}
