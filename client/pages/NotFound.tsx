import { Link } from 'react-router-dom';
import { Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-mejiwoo-cream to-white flex items-center justify-center px-3 sm:px-4">
      <div className="text-center max-w-md w-full">
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl p-6 sm:p-8 mx-2 sm:mx-0">
          {/* 404 Number */}
          <div className="mb-6 sm:mb-8">
            <h1 className="font-playfair text-6xl sm:text-8xl lg:text-9xl font-bold text-black mb-2 opacity-20">
              404
            </h1>
            <div className="w-16 sm:w-20 h-1 bg-black mx-auto"></div>
          </div>
          
          {/* Error Message */}
          <div className="mb-6 sm:mb-8">
            <h2 className="font-playfair text-xl sm:text-2xl lg:text-3xl font-bold text-black mb-3 sm:mb-4">
              Page Not Found
            </h2>
            <p className="font-montserrat text-sm sm:text-base text-mejiwoo-gray leading-relaxed">
              Sorry, the page you're looking for doesn't exist. It might have been moved, deleted, or you entered the wrong URL.
            </p>
          </div>
          
          {/* Action Buttons */}
          <div className="space-y-3 sm:space-y-4">
            <Link
              to="/dashboard"
              className="w-full bg-black text-white py-3 sm:py-4 rounded-lg font-montserrat font-medium hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 sm:gap-3 text-sm sm:text-base touch-manipulation min-h-[44px]"
            >
              <Home className="w-4 h-4 sm:w-5 sm:h-5" />
              Go to Dashboard
            </Link>
            
            <button
              onClick={() => window.history.back()}
              className="w-full bg-gray-100 text-black py-3 sm:py-4 rounded-lg font-montserrat font-medium hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 sm:gap-3 text-sm sm:text-base touch-manipulation min-h-[44px]"
            >
              <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              Go Back
            </button>
          </div>
          
          {/* Help Text */}
          <p className="font-montserrat text-xs sm:text-sm text-mejiwoo-gray mt-6 sm:mt-8">
            Need help? Check your URL or navigate using the buttons above.
          </p>
        </div>
      </div>
    </div>
  );
}
