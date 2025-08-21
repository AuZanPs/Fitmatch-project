import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "../components/ui/card";

export default function EmailConfirmed() {
  const [isAnimating, setIsAnimating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Trigger animation after component mounts
    const timer = setTimeout(() => {
      setIsAnimating(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  const handleSignIn = () => {
    navigate("/", { state: { scrollToAuth: true } });
  };

  return (
    <div className="min-h-screen bg-mejiwoo-cream flex items-center justify-center p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-gray-100 rounded-full mix-blend-multiply filter blur-xl opacity-40 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gray-200 rounded-full mix-blend-multiply filter blur-xl opacity-40 animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 left-40 w-80 h-80 bg-gray-50 rounded-full mix-blend-multiply filter blur-xl opacity-40 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative z-10 max-w-md w-full">
        <Card
          className={`shadow-sm border border-gray-200 bg-white transition-all duration-700 ${
            isAnimating
              ? "transform translate-y-0 opacity-100"
              : "transform translate-y-8 opacity-0"
          }`}
        >
          <CardContent className="p-8 text-center">
            {/* Success Icon */}
            <div className="mb-6 relative">
              <div
                className={`inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-50 border-2 border-green-200 transition-all duration-500 ${
                  isAnimating ? "scale-100" : "scale-0"
                }`}
              >
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              {/* Subtle decorative elements */}
              <div
                className={`absolute -top-2 -right-2 transition-all duration-700 delay-300 ${
                  isAnimating ? "opacity-100 scale-100" : "opacity-0 scale-0"
                }`}
              >
                <div className="w-2 h-2 bg-black rounded-full"></div>
              </div>
              <div
                className={`absolute -bottom-1 -left-2 transition-all duration-700 delay-500 ${
                  isAnimating ? "opacity-100 scale-100" : "opacity-0 scale-0"
                }`}
              >
                <div className="w-1.5 h-1.5 bg-gray-400 rounded-full"></div>
              </div>
            </div>

            {/* Main Content */}
            <div
              className={`space-y-4 transition-all duration-700 delay-200 ${
                isAnimating
                  ? "transform translate-y-0 opacity-100"
                  : "transform translate-y-4 opacity-0"
              }`}
            >
              <h1 className="text-2xl font-bold text-black font-playfair">
                Email Confirmed
              </h1>

              <p className="text-mejiwoo-gray font-montserrat leading-relaxed">
                Perfect! Your email has been successfully verified. You can now
                access all features of
                <span className="font-semibold text-black"> FitMatch</span> and
                start building your digital wardrobe.
              </p>

              <div className="bg-mejiwoo-cream rounded-lg p-4 my-6 border border-gray-100">
                <p className="text-sm text-mejiwoo-gray font-montserrat">
                  <strong className="text-black">What's next?</strong> Sign in
                  to upload your clothing items and discover new style
                  possibilities with AI-powered recommendations.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div
              className={`space-y-3 mt-8 transition-all duration-700 delay-400 ${
                isAnimating
                  ? "transform translate-y-0 opacity-100"
                  : "transform translate-y-4 opacity-0"
              }`}
            >
              <Button
                onClick={handleSignIn}
                className="w-full bg-black hover:bg-gray-800 text-white font-montserrat font-medium py-3 rounded-lg transition-all duration-300 transform hover:scale-105 shadow-sm"
              >
                Sign In Now
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>

              <Link
                to="/"
                className="block text-sm text-mejiwoo-gray hover:text-black font-montserrat transition-colors duration-200"
              >
                Return to homepage
              </Link>
            </div>

            {/* Footer */}
            <div
              className={`mt-8 pt-6 border-t border-gray-100 transition-all duration-700 delay-600 ${
                isAnimating ? "opacity-100" : "opacity-0"
              }`}
            >
              <p className="text-xs text-mejiwoo-gray font-montserrat">
                Welcome to the FitMatch community
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Additional floating elements */}
        <div
          className={`absolute -z-10 transition-all duration-1000 delay-800 ${
            isAnimating ? "opacity-20" : "opacity-0"
          }`}
        >
          <div className="absolute -top-4 -left-4 w-1.5 h-1.5 bg-black rounded-full animate-ping"></div>
          <div
            className="absolute -bottom-4 -right-4 w-1.5 h-1.5 bg-gray-400 rounded-full animate-ping"
            style={{ animationDelay: "1s" }}
          ></div>
        </div>
      </div>
    </div>
  );
}
