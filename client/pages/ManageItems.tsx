import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getUserClothingItems, getCurrentSession, deleteClothingItem } from '../lib/supabase';
import { toast } from 'sonner';
import type { ClothingItemWithTags } from '../lib/supabase';
import { ArrowLeft, Trash2, Search, Filter, Grid3X3, List, CheckCircle, X } from 'lucide-react';
import OptimizedImage from '../components/OptimizedImage';

export default function ManageItems() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [allItems, setAllItems] = useState<ClothingItemWithTags[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<string>('');
  const [selectedBrand, setSelectedBrand] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  
  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);
  
  // Memoize derived filter options
  const availableStyles = useMemo(() => {
    return Array.from(new Set(
      allItems.flatMap(item => 
        item.clothing_item_style_tags?.map(tag => tag.style_tag.name) || []
      )
    )).sort();
  }, [allItems]);
  
  const availableBrands = useMemo(() => {
    return Array.from(new Set(
      allItems.map(item => item.brand).filter(Boolean)
    )).sort();
  }, [allItems]);
  
  const availableColors = useMemo(() => {
    return Array.from(new Set(
      allItems.map(item => item.color).filter(Boolean)
    )).sort();
  }, [allItems]);

  // Memoize filtered items
  const filteredItems = useMemo(() => {
    let filtered = allItems;

    // Search filter
    if (debouncedSearchQuery) {
      const searchLower = debouncedSearchQuery.toLowerCase();
      filtered = filtered.filter(item => {
        const category = typeof item.category === 'string' ? item.category : item.category?.name || '';
        return (
          category.toLowerCase().includes(searchLower) ||
          item.brand?.toLowerCase().includes(searchLower) ||
          item.color?.toLowerCase().includes(searchLower) ||
          item.clothing_item_style_tags?.some(tag => 
            tag.style_tag.name.toLowerCase().includes(searchLower)
          )
        );
      });
    }

    // Style filter
    if (selectedStyle) {
      filtered = filtered.filter(item =>
        item.clothing_item_style_tags?.some(tag => tag.style_tag.name === selectedStyle)
      );
    }

    // Brand filter
    if (selectedBrand) {
      filtered = filtered.filter(item => item.brand === selectedBrand);
    }

    // Color filter
    if (selectedColor) {
      filtered = filtered.filter(item => item.color === selectedColor);
    }

    return filtered;
  }, [allItems, debouncedSearchQuery, selectedStyle, selectedBrand, selectedColor]);

  useEffect(() => {
    checkAuthAndLoadData();
  }, []);

  const checkAuthAndLoadData = async () => {
    try {
      const sessionResult = await getCurrentSession();
      
      if (sessionResult?.data?.session?.user) {
        setUser(sessionResult.data.session.user);
        await loadItems(sessionResult.data.session.user);
      } else {
        navigate('/');
        return;
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      navigate('/');
      return;
    } finally {
      setIsLoading(false);
    }
  };

  const loadItems = async (currentUser: any) => {
    try {
      const items = await getUserClothingItems(currentUser.id);
      setAllItems(items);
    } catch (error: any) {
      toast.error('Failed to load clothing items');
      console.error(error);
    }
  };

  const toggleItemSelection = useCallback((itemId: string) => {
    setSelectedItems(prev => {
      const newSelection = new Set(prev);
      if (newSelection.has(itemId)) {
        newSelection.delete(itemId);
      } else {
        newSelection.add(itemId);
      }
      return newSelection;
    });
  }, []);

  const selectAllItems = useCallback(() => {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredItems.map(item => item.id)));
    }
  }, [selectedItems.size, filteredItems]);

  const handleDeleteSelected = async () => {
    if (selectedItems.size === 0) return;

    const confirmMessage = `Are you sure you want to delete ${selectedItems.size} item(s)? This action cannot be undone.`;
    if (!window.confirm(confirmMessage)) return;

    setIsDeleting(true);
    
    try {
      const deletePromises = Array.from(selectedItems).map(itemId => 
        deleteClothingItem(itemId)
      );
      
      await Promise.all(deletePromises);
      
      toast.success(`Successfully deleted ${selectedItems.size} item(s)`);
      setSelectedItems(new Set());
      
      // Reload items
      if (user) {
        await loadItems(user);
      }
    } catch (error) {
      console.error('Error deleting items:', error);
      toast.error('Failed to delete some items. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedStyle('');
    setSelectedBrand('');
    setSelectedColor('');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-mejiwoo-cream flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto mb-4"></div>
          <p className="font-montserrat text-lg text-mejiwoo-gray">Loading your items...</p>
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
              <button
                onClick={() => navigate('/dashboard')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="font-playfair text-2xl font-bold text-black">
                Manage Items
              </h1>
              <div className="hidden sm:flex items-center gap-2 text-sm text-mejiwoo-gray font-montserrat">
                <span>{allItems.length} total items</span>
                <span>•</span>
                <span>{filteredItems.length} showing</span>
                {selectedItems.size > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-red-600 font-medium">{selectedItems.size} selected</span>
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

              {/* Delete Selected Button */}
              {selectedItems.size > 0 && (
                <button
                  onClick={handleDeleteSelected}
                  disabled={isDeleting}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg font-montserrat font-medium hover:bg-red-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete ({selectedItems.size})
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
          {/* Search Bar */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-mejiwoo-gray w-5 h-5" />
            <input
              type="text"
              placeholder="Search your wardrobe by name, brand, color, or style..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent font-montserrat"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-mejiwoo-gray hover:text-black transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Filter Dropdowns */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-montserrat font-medium text-gray-700 mb-2">Style</label>
              <select
                value={selectedStyle}
                onChange={(e) => setSelectedStyle(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent font-montserrat"
              >
                <option value="">All Styles</option>
                {availableStyles.map(style => (
                  <option key={style} value={style}>{style}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-montserrat font-medium text-gray-700 mb-2">Brand</label>
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent font-montserrat"
              >
                <option value="">All Brands</option>
                {availableBrands.map(brand => (
                  <option key={brand} value={brand}>{brand}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-montserrat font-medium text-gray-700 mb-2">Color</label>
              <select
                value={selectedColor}
                onChange={(e) => setSelectedColor(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent font-montserrat"
              >
                <option value="">All Colors</option>
                {availableColors.map(color => (
                  <option key={color} value={color}>{color}</option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={clearAllFilters}
                className="w-full bg-gray-100 text-gray-700 px-4 py-3 rounded-lg font-montserrat font-medium hover:bg-gray-200 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>

          {/* Select All Checkbox */}
          <div className="flex items-center gap-3">
            <button
              onClick={selectAllItems}
              className="flex items-center gap-2 text-sm font-montserrat font-medium text-gray-700 hover:text-black transition-colors"
            >
              <div className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-colors ${
                selectedItems.size === filteredItems.length && filteredItems.length > 0
                  ? 'bg-black border-black' 
                  : 'border-gray-300'
              }`}>
                {selectedItems.size === filteredItems.length && filteredItems.length > 0 && (
                  <CheckCircle className="w-3 h-3 text-white" />
                )}
              </div>
              {selectedItems.size === filteredItems.length && filteredItems.length > 0 
                ? 'Deselect All' 
                : `Select All (${filteredItems.length})`}
            </button>
          </div>
        </div>

        {/* Items Display */}
        {filteredItems.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border">
            <div className="text-center py-12">
              <Trash2 className="w-16 h-16 text-mejiwoo-gray mx-auto mb-4" />
              <h3 className="font-playfair text-xl font-semibold text-black mb-2">
                {allItems.length === 0 ? 'No Items to Manage' : 'No Items Found'}
              </h3>
              <p className="font-montserrat text-mejiwoo-gray mb-6 max-w-md mx-auto">
                {allItems.length === 0 
                  ? 'You have no items in your wardrobe yet. Add some items first.'
                  : 'No items match your current filters. Try adjusting your search or filters.'}
              </p>
              {allItems.length === 0 && (
                <button
                  onClick={() => navigate('/upload')}
                  className="bg-black text-white px-6 py-3 rounded-lg font-montserrat font-medium hover:bg-gray-800 transition-colors"
                >
                  Add Your First Item
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-sm border p-6">
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {filteredItems.map((item) => (
                  <div
                    key={item.id}
                    className={`relative group aspect-square rounded-lg overflow-hidden bg-gray-100 hover:shadow-lg transition-all duration-200 cursor-pointer border-2 ${
                      selectedItems.has(item.id) ? 'border-black ring-2 ring-black' : 'border-transparent'
                    }`}
                    onClick={() => toggleItemSelection(item.id)}
                  >
                    <OptimizedImage
                      src={item.image_url}
                      alt={`${item.brand || ''} ${item.color || ''} ${typeof item.category === 'string' ? item.category : item.category?.name}`}
                      width={250}
                      height={300}
                      className="w-full h-full"
                    />
                    
                    {/* Selection Overlay */}
                    <div className={`absolute inset-0 bg-black transition-opacity ${
                      selectedItems.has(item.id) ? 'bg-opacity-30' : 'bg-opacity-0 group-hover:bg-opacity-20'
                    }`}>
                      <div className="absolute top-2 right-2">
                        <div className={`w-6 h-6 border-2 rounded-full flex items-center justify-center transition-colors ${
                          selectedItems.has(item.id) 
                            ? 'bg-black border-black' 
                            : 'bg-white bg-opacity-80 border-white'
                        }`}>
                          {selectedItems.has(item.id) && (
                            <CheckCircle className="w-4 h-4 text-white" />
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Item Info */}
                    <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                      <p className="text-white text-xs font-montserrat font-medium">
                        {typeof item.category === 'string' ? item.category : item.category?.name}
                      </p>
                      <p className="text-white text-xs font-montserrat">
                        {item.brand && `${item.brand}`}
                        {item.brand && item.color && ' • '}
                        {item.color}
                      </p>
                      {item.clothing_item_style_tags && item.clothing_item_style_tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {item.clothing_item_style_tags.slice(0, 2).map((tagRelation) => (
                            <span
                              key={tagRelation.style_tag.id}
                              className="text-xs bg-white bg-opacity-20 text-white px-2 py-0.5 rounded-full backdrop-blur-sm"
                            >
                              {tagRelation.style_tag.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredItems.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-4 p-4 rounded-lg border-2 transition-all cursor-pointer hover:shadow-md ${
                      selectedItems.has(item.id) ? 'border-black bg-gray-50' : 'border-gray-200'
                    }`}
                    onClick={() => toggleItemSelection(item.id)}
                  >
                    <div className={`w-6 h-6 border-2 rounded-full flex items-center justify-center transition-colors ${
                      selectedItems.has(item.id) 
                        ? 'bg-black border-black' 
                        : 'border-gray-300'
                    }`}>
                      {selectedItems.has(item.id) && (
                        <CheckCircle className="w-4 h-4 text-white" />
                      )}
                    </div>

                    <OptimizedImage
                      src={item.image_url}
                      alt={`${item.brand || ''} ${item.color || ''} ${typeof item.category === 'string' ? item.category : item.category?.name}`}
                      width={64}
                      height={64}
                      className="w-16 h-16 rounded-lg"
                    />

                    <div className="flex-1">
                      <h4 className="font-montserrat font-medium text-black">
                        {typeof item.category === 'string' ? item.category : item.category?.name}
                      </h4>
                      <p className="font-montserrat text-sm text-mejiwoo-gray">
                        {item.brand && `${item.brand}`}
                        {item.brand && item.color && ' • '}
                        {item.color}
                      </p>
                      {item.clothing_item_style_tags && item.clothing_item_style_tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {item.clothing_item_style_tags.slice(0, 3).map((tagRelation) => (
                            <span
                              key={tagRelation.style_tag.id}
                              className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full"
                            >
                              {tagRelation.style_tag.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
