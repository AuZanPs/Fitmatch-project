import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  getCategories,
  getStyleTags,
  uploadClothingImage,
  createClothingItem,
  getCurrentSession,
} from "../lib/supabase";
import { toast } from "sonner";
import type { Category, StyleTag } from "../lib/supabase";
import { Upload as UploadIcon, X, ArrowLeft, Check } from "lucide-react";

export default function Upload() {
  const [user, setUser] = useState<any>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [styleTags, setStyleTags] = useState<StyleTag[]>([]);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedStyleTags, setSelectedStyleTags] = useState<number[]>([]);
  const [brand, setBrand] = useState("");
  const [color, setColor] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const sessionResult = await getCurrentSession();
        if (sessionResult.error || !sessionResult.data.session?.user) {
          navigate("/");
          return;
        }
        setUser(sessionResult.data.session.user);
        await loadData();
      } catch (error) {
        navigate("/");
      }
    };

    checkAuth();
  }, [navigate]);

  const loadData = async () => {
    try {
      const [categoriesData, styleTagsData] = await Promise.all([
        getCategories(),
        getStyleTags(),
      ]);

      setCategories(categoriesData);
      setStyleTags(styleTagsData);

      if (categoriesData.length === 0) {
        toast.error("No categories found. Please set up the database first.");
      }
      if (styleTagsData.length === 0) {
        toast.error("No style tags found. Please set up the database first.");
      }
    } catch (error: any) {
      console.error("Error loading data:", error);
      if (
        error.message.includes("relation") &&
        error.message.includes("does not exist")
      ) {
        toast.error(
          "Database tables not found. Please run the database setup script.",
        );
      } else {
        toast.error("Failed to load data: " + error.message);
      }
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const toggleStyleTag = (tagId: number) => {
    setSelectedStyleTags((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedImage || !selectedCategory || selectedStyleTags.length === 0) {
      toast.error("Please fill in all required fields");
      return;
    }

    setIsUploading(true);

    try {
      // Upload image
      const imageUrl = await uploadClothingImage(selectedImage, user.id);

      // Create clothing item
      await createClothingItem(
        user.id,
        imageUrl,
        selectedCategory,
        selectedStyleTags,
        brand || undefined,
        color || undefined,
      );

      toast.success("Clothing item added successfully! 🎉");

      // Small delay to show success before navigation
      setTimeout(() => {
        navigate("/dashboard");
      }, 800);
    } catch (error: any) {
      toast.error("Failed to add clothing item");
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setSelectedImage(null);
    setImagePreview(null);
    setSelectedCategory(null);
    setSelectedStyleTags([]);
    setBrand("");
    setColor("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-mejiwoo-cream">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center gap-2 sm:gap-4">
              <button
                onClick={() => navigate("/dashboard")}
                className="text-mejiwoo-gray hover:text-black transition-colors p-2 -ml-2 touch-manipulation"
                title="Back to Dashboard"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h1 className="font-playfair text-lg sm:text-xl lg:text-2xl font-bold text-black">
                Upload New Item
              </h1>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-6 lg:py-8">
        <form
          onSubmit={handleSubmit}
          className="space-y-4 sm:space-y-6 lg:space-y-8"
        >
          {/* Image Upload */}
          <div className="bg-white rounded-lg p-4 sm:p-6">
            <h2 className="font-playfair text-lg sm:text-xl font-semibold text-black mb-3 sm:mb-4">
              Upload Photo *
            </h2>

            {!imagePreview ? (
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 sm:p-12 text-center hover:border-gray-400 transition-colors cursor-pointer touch-manipulation"
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadIcon className="w-8 h-8 sm:w-12 sm:h-12 text-mejiwoo-gray mx-auto mb-3 sm:mb-4" />
                <p className="font-montserrat text-base sm:text-lg text-black mb-1 sm:mb-2">
                  Drag and drop an image here
                </p>
                <p className="font-montserrat text-xs sm:text-sm text-mejiwoo-gray">
                  or tap to browse your files
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="Preview"
                  className="w-full max-w-xs sm:max-w-sm mx-auto rounded-lg shadow-md"
                />
                <button
                  type="button"
                  onClick={resetForm}
                  className="absolute top-2 right-2 bg-black text-white rounded-full p-2 hover:bg-gray-800 transition-colors touch-manipulation"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Category Selection */}
          <div className="bg-white rounded-lg p-4 sm:p-6">
            <h2 className="font-playfair text-lg sm:text-xl font-semibold text-black mb-3 sm:mb-4">
              Category *
            </h2>
            {categories.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                {categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setSelectedCategory(category.id)}
                    className={`p-2 sm:p-3 rounded-lg font-montserrat font-medium transition-colors text-sm sm:text-base touch-manipulation min-h-[44px] ${
                      selectedCategory === category.id
                        ? "bg-black text-white"
                        : "bg-gray-100 text-black hover:bg-gray-200"
                    }`}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 sm:py-8">
                <p className="text-mejiwoo-gray mb-4">No categories found</p>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4 text-left">
                  <p className="text-xs sm:text-sm text-yellow-800 mb-2">
                    <strong>Database Setup Required:</strong>
                  </p>
                  <p className="text-xs sm:text-sm text-yellow-700">
                    Please run the database setup script in your Supabase SQL
                    Editor to create categories.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Style Tags Selection */}
          <div className="bg-white rounded-lg p-4 sm:p-6">
            <h2 className="font-playfair text-lg sm:text-xl font-semibold text-black mb-3 sm:mb-4">
              Style Tags * (select at least one)
            </h2>
            {styleTags.length > 0 ? (
              <div className="flex flex-wrap gap-2 sm:gap-3">
                {styleTags.map((tag) => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleStyleTag(tag.id)}
                    className={`px-3 sm:px-4 py-2 rounded-full font-montserrat font-medium transition-colors flex items-center gap-1 sm:gap-2 text-sm sm:text-base touch-manipulation min-h-[44px] ${
                      selectedStyleTags.includes(tag.id)
                        ? "bg-black text-white"
                        : "bg-gray-100 text-black hover:bg-gray-200"
                    }`}
                  >
                    {selectedStyleTags.includes(tag.id) && (
                      <Check className="w-3 h-3 sm:w-4 sm:h-4" />
                    )}
                    {tag.name}
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 sm:py-8">
                <p className="text-mejiwoo-gray mb-4">No style tags found</p>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4 text-left">
                  <p className="text-xs sm:text-sm text-yellow-800 mb-2">
                    <strong>Database Setup Required:</strong>
                  </p>
                  <p className="text-xs sm:text-sm text-yellow-700">
                    Please run the database setup script in your Supabase SQL
                    Editor to create style tags.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Optional Details */}
          <div className="bg-white rounded-lg p-4 sm:p-6">
            <h2 className="font-inter text-lg sm:text-xl font-semibold text-black mb-3 sm:mb-4">
              Additional Details (Optional)
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block font-inter text-sm font-medium text-black mb-2">
                  Brand
                </label>
                <input
                  type="text"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="w-full px-3 sm:px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none text-sm sm:text-base touch-manipulation"
                  placeholder="e.g. Nike, Zara, H&M"
                />
              </div>

              <div>
                <label className="block font-montserrat text-sm font-medium text-black mb-2">
                  Color
                </label>
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-full px-3 sm:px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none text-sm sm:text-base touch-manipulation"
                  placeholder="e.g. Black, Navy Blue, Red"
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pb-4 sm:pb-0">
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="w-full sm:flex-1 bg-gray-100 text-black py-3 rounded-lg font-montserrat font-medium hover:bg-gray-200 transition-colors text-sm sm:text-base touch-manipulation min-h-[44px] order-2 sm:order-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                isUploading ||
                !selectedImage ||
                !selectedCategory ||
                selectedStyleTags.length === 0
              }
              className="w-full sm:flex-1 bg-black text-white py-3 rounded-lg font-montserrat font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base touch-manipulation min-h-[44px] order-1 sm:order-2"
            >
              {isUploading ? "Adding Item..." : "Add Item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
