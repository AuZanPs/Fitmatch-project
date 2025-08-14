import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getStyleTags, getClothingItemsByStyle, getUserClothingItems, signOut, getCurrentSession, onAuthStateChange } from '../lib/supabase';
import { toast } from 'sonner';
import type { StyleTag, ClothingItemWithTags } from '../lib/supabase';
import { Plus, LogOut, Upload, Sparkles, Grid3X3, List, Filter, Search, Trash2 } from 'lucide-react';
import OptimizedImage from '../components/OptimizedImage';

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [styleTags, setStyleTags] = useState<StyleTag[]>([]);
  const [selectedStyle, setSelectedStyle] = useState<StyleTag | null>(null);
  const [clothingItems, setClothingItems] = useState<ClothingItemWithTags[]>([]);
  const [allItems, setAllItems] = useState<ClothingItemWithTags[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const navigate = useNavigate();

  // Memoize expensive calculations
  const styleItemCounts = useMemo(() => {
    return styleTags.reduce((acc, style) => {
      acc[style.id] = allItems.filter(item => 
        item.clothing_item_style_tags?.some(tag => tag.style_tag.id === style.id)
      ).length;
      return acc;
    }, {} as Record<number, number>);
  }, [allItems, styleTags]);

  const getItemCountForStyle = useCallback((styleId: number): number => {
    return styleItemCounts[styleId] || 0;
  }, [styleItemCounts]);

  // Memoize filtered items for search
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return clothingItems;
    
    const query = searchQuery.toLowerCase();
    return clothingItems.filter(item => {
      const category = typeof item.category === 'string' ? item.category : item.category?.name || '';
      return (
        category.toLowerCase().includes(query) ||
        item.brand?.toLowerCase().includes(query) ||
        item.color?.toLowerCase().includes(query) ||
        item.clothing_item_style_tags?.some(tag => 
          tag.style_tag.name.toLowerCase().includes(query)
        )
      );
    });
  }, [clothingItems, searchQuery]);

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
          navigate('/');
          return;
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        if (mounted) {
          navigate('/');
        }
        return;
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    checkAuthAndLoadData();

    const { data: { subscription } } = onAuthStateChange((event, session) => {
      if (!mounted) return;
      
      if (event === 'SIGNED_OUT' || !session?.user) {
        navigate('/');
      }
      // Remove the duplicate navigation that was causing issues
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  const loadStyleTags = async (currentUser: any = user) => {
    if (!currentUser) return;
    
    try {
      const tags = await getStyleTags();
      setStyleTags(tags);
      
      // Load all items first
      const items = await getUserClothingItems(currentUser.id);
      setAllItems(items);
      
      if (tags.length > 0) {
        setSelectedStyle(tags[0]);
        loadClothingItems(tags[0].id, currentUser);
      } else {
        setClothingItems(items);
      }
    } catch (error: any) {
      console.error('Error loading style tags:', error);
      if (error.message.includes('relation "style_tags" does not exist')) {
        toast.error('Database not set up. Please run the database setup script in Supabase.');
      } else {
        toast.error('Failed to load style tags');
      }
    }
  };

  const loadClothingItems = async (styleTagId: number, currentUser: any = user) => {
    if (!currentUser) return;
    
    try {
      const items = await getClothingItemsByStyle(currentUser.id, styleTagId);
      setClothingItems(items);
    } catch (error: any) {
      toast.error('Failed to load clothing items');
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
      navigate('/');
    } catch (error: any) {
      toast.error('Failed to sign out');
    }
  };

  // Memoize grouped items by category
  const groupedItems = useMemo(() => {
    return filteredItems.reduce((acc, item) => {
      const categoryName = item.category?.name || 'Uncategorized';
      if (!acc[categoryName]) {
        acc[categoryName] = [];
      }
      acc[categoryName].push(item);
      return acc;
    }, {} as Record<string, ClothingItemWithTags[]>);
  }, [filteredItems]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-mejiwoo-cream flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="font-montserrat text-lg text-mejiwoo-gray">Loading your wardrobe...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mejiwoo-cream">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <h1 className="font-playfair text-2xl font-bold text-black">
                My FitMatch
              </h1>
              <div className="hidden sm:flex items-center gap-2 text-sm text-mejiwoo-gray font-montserrat">
                <span>{allItems.length} items</span>
                {selectedStyle && (
                  <>
                    <span>•</span>
                    <span>{filteredItems.length} {selectedStyle.name.toLowerCase()} items</span>
                  </>
                )}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* View Toggle */}
              <div className="hidden sm:flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'grid' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
                  }`}
                  title="Grid view"
                >
                  <Grid3X3 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-md transition-colors ${
                    viewMode === 'list' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
                  }`}
                  title="List view"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>

              {/* Filter Toggle */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                title="Filters"
              >
                <Filter className="w-4 h-4" />
              </button>

              {/* Add Item Button */}
              <button
                onClick={() => navigate('/upload')}
                className="bg-black text-white px-4 py-2 rounded-lg font-montserrat font-medium hover:bg-gray-800 transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Add Item</span>
              </button>

              {/* Manage Items Button */}
              {allItems.length > 0 && (
                <button
                  onClick={() => navigate('/manage-items')}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg font-montserrat font-medium hover:bg-red-700 transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Manage</span>
                </button>
              )}

              {/* AI Stylist Button (Coming Soon) */}
                            {/* AI Stylist Button */}
              <button
                onClick={() => navigate('/ai-stylist')}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg font-montserrat font-medium hover:bg-purple-700 transition-colors flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span className="hidden lg:inline">AI Stylist</span>
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

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Enhanced Filters Section */}
        {showFilters && (
          <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
            <h3 className="font-playfair text-lg font-semibold text-black mb-4">Filters & Search</h3>
            
            {/* Search Bar */}
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search by brand, color, or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none"
              />
            </div>
            
            {/* Style Tags Filter */}
            <div>
              <h4 className="font-inter text-sm font-medium text-black mb-3">Filter by Style</h4>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleStyleChange(null)}
                  className={`px-4 py-2 rounded-full font-inter font-medium transition-colors ${
                    !selectedStyle
                      ? 'bg-black text-white'
                      : 'bg-gray-100 text-black hover:bg-gray-200'
                  }`}
                >
                  All Styles ({allItems.length})
                </button>
                {styleTags.map((style) => {
                  const itemCount = getItemCountForStyle(style.id);
                  return (
                    <button
                      key={style.id}
                      onClick={() => handleStyleChange(style)}
                      className={`px-4 py-2 rounded-full font-inter font-medium transition-colors ${
                        selectedStyle?.id === style.id
                          ? 'bg-black text-white'
                          : 'bg-gray-100 text-black hover:bg-gray-200'
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

        {/* Quick Style Selector (Always Visible) */}
        {!showFilters && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-playfair text-xl font-semibold text-black">
                Browse by Style
              </h2>
              <button
                onClick={() => setShowFilters(true)}
                className="text-sm text-mejiwoo-gray hover:text-black transition-colors flex items-center gap-1"
              >
                <Search className="w-4 h-4" />
                Search & Filters
              </button>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => handleStyleChange(null)}
                className={`px-4 py-2 rounded-full font-inter font-medium transition-colors ${
                  !selectedStyle
                    ? 'bg-black text-white'
                    : 'bg-gray-100 text-black hover:bg-gray-200'
                }`}
              >
                All Items ({allItems.length})
              </button>
              {styleTags.map((style) => {
                const count = allItems.filter(item => 
                  item.clothing_item_style_tags?.some(tag => tag.style_tag.id === style.id)
                ).length;
                return (
                  <button
                    key={style.id}
                    onClick={() => handleStyleChange(style)}
                    className={`px-4 py-2 rounded-full font-inter font-medium transition-colors ${
                      selectedStyle?.id === style.id
                        ? 'bg-black text-white'
                        : 'bg-gray-100 text-black hover:bg-gray-200'
                    }`}
                  >
                    {style.name} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Enhanced Clothing Items Display */}
        <div className="mb-8">
          {selectedStyle ? (
            <h3 className="font-inter text-2xl font-bold text-black mb-6">
              {selectedStyle.name} Items
              <span className="text-lg font-normal text-mejiwoo-gray ml-2">
                ({filteredItems.length} items)
              </span>
            </h3>
          ) : (
            <h3 className="font-inter text-2xl font-bold text-black mb-6">
              All Items
              <span className="text-lg font-normal text-mejiwoo-gray ml-2">
                ({filteredItems.length} items)
              </span>
            </h3>
          )}
          
          {Object.keys(groupedItems).length === 0 ? (
            <div className="bg-white rounded-lg p-12 text-center">
              <Upload className="w-16 h-16 text-mejiwoo-gray mx-auto mb-4" />
              <h4 className="font-inter text-xl font-semibold text-black mb-2">
                {selectedStyle ? `No ${selectedStyle.name.toLowerCase()} items yet` : 'Your wardrobe is empty'}
              </h4>
              <p className="font-inter text-mejiwoo-gray mb-6">
                {searchQuery 
                  ? `No items match "${searchQuery}". Try adjusting your search.`
                  : 'Start building your digital wardrobe by uploading photos of your favorite clothes.'
                }</p>
              {!searchQuery && (
                <div className="space-y-3">
                  <button
                    onClick={() => navigate('/upload')}
                    className="bg-black text-white px-6 py-3 rounded-lg font-inter font-medium hover:bg-gray-800 transition-colors inline-flex items-center gap-2"
                  >
                    <Plus className="w-5 h-5" />
                    Upload Your First Item
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-8">
              {Object.entries(groupedItems).map(([category, items]) => (
                <div key={category} className="bg-white rounded-lg shadow-sm border p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h4 className="font-inter text-lg font-semibold text-black">
                      {category}
                      <span className="text-sm font-normal text-mejiwoo-gray ml-2">
                        ({items.length} items)
                      </span>
                    </h4>
                  </div>
                  
                  {/* Grid View */}
                  {viewMode === 'grid' && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="group relative aspect-square rounded-lg overflow-hidden bg-gray-100 hover:shadow-lg transition-all duration-200 cursor-pointer"
                        >
                          <OptimizedImage
                            src={item.image_url}
                            alt={`${item.brand || ''} ${item.color || ''} ${category}`}
                            width={300}
                            height={300}
                            className="w-full h-full group-hover:scale-105 transition-transform duration-200"
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all duration-200">
                            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                              <p className="text-white text-xs font-inter font-medium">
                                {item.brand && `${item.brand}`}
                                {item.brand && item.color && ' • '}
                                {item.color}
                              </p>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {item.clothing_item_style_tags?.slice(0, 2).map((tagRelation) => (
                                  <span
                                    key={tagRelation.style_tag.id}
                                    className="text-xs bg-white/20 text-white px-2 py-1 rounded-full"
                                  >
                                    {tagRelation.style_tag.name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {/* List View */}
                  {viewMode === 'list' && (
                    <div className="space-y-3">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer"
                        >
                          <div className="w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                            <OptimizedImage
                              src={item.image_url}
                              alt={`${item.brand || ''} ${item.color || ''} ${category}`}
                              width={64}
                              height={64}
                              className="w-full h-full"
                            />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h5 className="font-inter font-medium text-black">
                                {item.brand || 'No Brand'}
                              </h5>
                              {item.color && (
                                <span className="text-sm text-mejiwoo-gray">
                                  • {item.color}
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {item.clothing_item_style_tags?.map((tagRelation) => (
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
    </div>
  );
}
