import React, { useState, useCallback } from "react";

interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  quality?: number;
  onLoad?: () => void;
  onError?: () => void;
}

const OptimizedImage: React.FC<OptimizedImageProps> = ({
  src,
  alt,
  width = 300,
  height = 400,
  className = "",
  quality = 80,
  onLoad,
  onError,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Generate optimized image URL for Supabase
  const getOptimizedImageUrl = useCallback(
    (url: string) => {
      if (!url) return "";

      // Check if it's a Supabase URL
      if (url.includes("supabase")) {
        // Add image transformation parameters
        const transformations = `?width=${width}&height=${height}&quality=${quality}&format=webp`;
        return `${url}${transformations}`;
      }

      return url;
    },
    [width, height, quality],
  );

  const handleLoad = useCallback(() => {
    setIsLoading(false);
    onLoad?.();
  }, [onLoad]);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
    onError?.();
  }, [onError]);

  const optimizedSrc = getOptimizedImageUrl(src);

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {isLoading && !hasError && (
        <div
          className="absolute inset-0 bg-gray-200 animate-pulse rounded-lg"
          style={{ width, height }}
        />
      )}

      {hasError ? (
        <div
          className="bg-gray-100 flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300"
          style={{ width, height }}
        >
          <div className="text-center text-gray-500">
            <svg
              className="w-8 h-8 mx-auto mb-2"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-sm">Image not found</span>
          </div>
        </div>
      ) : (
        <img
          src={optimizedSrc}
          alt={alt}
          width={width}
          height={height}
          loading="lazy"
          decoding="async"
          onLoad={handleLoad}
          onError={handleError}
          className={`${isLoading ? "opacity-0" : "opacity-100"} transition-opacity duration-300 object-cover rounded-lg`}
          style={{ width, height }}
        />
      )}
    </div>
  );
};

export default OptimizedImage;
