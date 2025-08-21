import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  signInWithGoogle,
  signIn,
  signUp,
  isSupabaseConfigured,
  getCurrentSession,
  onAuthStateChange,
} from "../lib/supabase";
import { toast } from "sonner";
import { Settings } from "lucide-react";

export default function Landing() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const navigate = useNavigate();

  // Check if user is already authenticated
  useEffect(() => {
    let mounted = true;

    if (!isSupabaseConfigured()) {
      setIsCheckingAuth(false);
      return;
    }

    const checkExistingSession = async () => {
      try {
        const {
          data: { session },
        } = await getCurrentSession();

        if (!mounted) return;

        if (session?.user) {
          // Small delay to prevent flashing
          setTimeout(() => {
            if (mounted) {
              navigate("/dashboard");
            }
          }, 100);
        }
      } catch (error) {
        // Silently handle - user will see login form
      } finally {
        if (mounted) {
          setIsCheckingAuth(false);
        }
      }
    };

    checkExistingSession();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === "SIGNED_IN" && session?.user) {
        toast.success("Welcome! Redirecting to dashboard...");
        setTimeout(() => {
          if (mounted) {
            navigate("/dashboard");
          }
        }, 500); // Small delay to show success message
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isSupabaseConfigured()) {
      toast.error(
        "Supabase is not configured. Please add your credentials to continue.",
      );
      return;
    }

    setIsLoading(true);

    try {
      if (isSignUp) {
        const { error } = await signUp(email, password);
        if (error) throw error;
        toast.success("Check your email for the confirmation link!");
      } else {
        const { data, error } = await signIn(email, password);
        if (error) throw error;
        toast.success("Signed in successfully!");
        // Navigation will be handled by the auth state change listener
      }
    } catch (error: any) {
      console.error("Authentication error:", error);
      toast.error(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    // Show work in progress message with more details
    toast.info(
      "Google Sign-In is coming soon! For now, please use email/password authentication above.",
      {
        duration: 4000,
      },
    );
  };

  // If still checking authentication, show a brief loading state
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-mejiwoo-cream to-white flex items-center justify-center px-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-black mx-auto mb-3 sm:mb-4"></div>
          <p className="font-montserrat text-sm sm:text-base text-mejiwoo-gray">
            Loading...
          </p>
        </div>
      </div>
    );
  }

  // If Supabase is not configured, show setup instructions
  if (!isSupabaseConfigured()) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-mejiwoo-cream to-white flex items-center justify-center px-3 sm:px-4">
        <div className="max-w-2xl w-full text-center">
          <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 lg:p-8 mx-2 sm:mx-0">
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-mejiwoo-cream rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
              <Settings className="w-6 h-6 sm:w-8 sm:h-8 text-black" />
            </div>

            <h1 className="font-playfair text-2xl sm:text-3xl font-bold text-black mb-3 sm:mb-4">
              Setup Required
            </h1>

            <p className="font-montserrat text-sm sm:text-base lg:text-lg text-mejiwoo-gray mb-6 sm:mb-8 px-2 sm:px-0">
              To use FitMatch, you need to configure Supabase credentials.
            </p>

            <div className="bg-gray-50 rounded-lg p-4 sm:p-6 text-left mb-6 sm:mb-8">
              <h3 className="font-montserrat font-semibold text-black mb-3 sm:mb-4 text-sm sm:text-base">
                Steps to configure:
              </h3>
              <ol className="font-montserrat text-xs sm:text-sm text-mejiwoo-gray space-y-2 sm:space-y-3">
                <li>
                  1. Create a Supabase project at{" "}
                  <a
                    href="https://supabase.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-black underline break-all"
                  >
                    supabase.com
                  </a>
                </li>
                <li>
                  2. Copy your project URL and anon key from Settings → API
                </li>
                <li>
                  3. Update the environment variables in your{" "}
                  <code className="bg-white px-1.5 py-0.5 rounded text-xs">
                    .env
                  </code>{" "}
                  file:
                </li>
              </ol>

              <div className="bg-black text-white p-3 sm:p-4 rounded mt-3 sm:mt-4 font-mono text-xs sm:text-sm overflow-x-auto">
                <div className="whitespace-nowrap">
                  VITE_SUPABASE_URL=https://your-project.supabase.co
                </div>
                <div className="whitespace-nowrap">
                  VITE_SUPABASE_ANON_KEY=your-anon-key-here
                </div>
              </div>
            </div>

            <p className="font-montserrat text-xs sm:text-sm text-mejiwoo-gray px-2 sm:px-0">
              Once configured, refresh the page to start using FitMatch.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-mejiwoo-cream to-white flex items-center justify-center px-3 sm:px-4 py-6 sm:py-8 lg:py-0">
      <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 lg:gap-12 items-center">
        {/* Left side - App description */}
        <div className="text-center lg:text-left order-2 lg:order-1">
          <h1 className="font-playfair text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-black mb-3 sm:mb-4 lg:mb-6">
            <span className="text-mejiwoo-gray">Fit</span>Match
          </h1>
          <p className="font-montserrat text-sm sm:text-base md:text-lg lg:text-xl text-mejiwoo-gray mb-4 sm:mb-6 lg:mb-8 leading-relaxed px-2 sm:px-0">
            Digitize your wardrobe and discover new outfit combinations. Upload
            photos of your clothes, tag them by style, and browse your options
            to create the perfect look.
          </p>

          <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 lg:p-8 mx-2 sm:mx-0">
            <div className="space-y-3 sm:space-y-4 lg:space-y-6">
              <div className="flex items-start gap-3 sm:gap-4 text-left">
                <span className="w-6 h-6 sm:w-8 sm:h-8 bg-black text-white rounded-full flex items-center justify-center text-xs sm:text-sm font-bold flex-shrink-0 mt-1 sm:mt-0.5 lg:mt-0">
                  1
                </span>
                <div className="min-w-0">
                  <h3 className="font-playfair text-base sm:text-lg lg:text-xl font-bold text-black mb-1">
                    Upload Photos
                  </h3>
                  <p className="font-montserrat text-xs sm:text-sm text-gray-600">
                    Add your clothing items with photos
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 sm:gap-4 text-left">
                <span className="w-6 h-6 sm:w-8 sm:h-8 bg-black text-white rounded-full flex items-center justify-center text-xs sm:text-sm font-bold flex-shrink-0 mt-1 sm:mt-0.5 lg:mt-0">
                  2
                </span>
                <div className="min-w-0">
                  <h3 className="font-playfair text-base sm:text-lg lg:text-xl font-bold text-black mb-1">
                    Tag by Style
                  </h3>
                  <p className="font-montserrat text-xs sm:text-sm text-gray-600">
                    Categorize with style tags
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 sm:gap-4 text-left">
                <span className="w-6 h-6 sm:w-8 sm:h-8 bg-black text-white rounded-full flex items-center justify-center text-xs sm:text-sm font-bold flex-shrink-0 mt-1 sm:mt-0.5 lg:mt-0">
                  3
                </span>
                <div className="min-w-0">
                  <h3 className="font-playfair text-base sm:text-lg lg:text-xl font-bold text-black mb-1">
                    Browse Outfits
                  </h3>
                  <p className="font-montserrat text-xs sm:text-sm text-gray-600">
                    Find perfect combinations
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Authentication form */}
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl p-4 sm:p-6 lg:p-8 order-1 lg:order-2 mx-2 sm:mx-0">
          <h2 className="font-playfair text-xl sm:text-2xl font-bold text-black mb-4 sm:mb-6 text-center">
            {isSignUp ? "Create Account" : "Welcome Back"}
          </h2>

          <form
            onSubmit={handleEmailAuth}
            className="space-y-3 sm:space-y-4 mb-4 sm:mb-6"
          >
            <div>
              <label className="block font-montserrat text-xs sm:text-sm font-medium text-black mb-1 sm:mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 sm:px-4 py-3 sm:py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none text-sm sm:text-base touch-manipulation"
                placeholder="Enter your email"
                required
                autoComplete="email"
                inputMode="email"
              />
            </div>

            <div>
              <label className="block font-montserrat text-xs sm:text-sm font-medium text-black mb-1 sm:mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 sm:px-4 py-3 sm:py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent outline-none text-sm sm:text-base touch-manipulation"
                placeholder="Enter your password"
                required
                autoComplete={isSignUp ? "new-password" : "current-password"}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-black text-white py-3 sm:py-3 rounded-lg font-montserrat font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 text-sm sm:text-base touch-manipulation min-h-[44px]"
            >
              {isLoading ? "Please wait..." : isSignUp ? "Sign Up" : "Sign In"}
            </button>
          </form>

          <div className="relative mb-4 sm:mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-xs sm:text-sm">
              <span className="px-2 bg-white text-mejiwoo-gray">
                Or continue with
              </span>
            </div>
          </div>

          <button
            onClick={handleGoogleAuth}
            className="w-full bg-gray-100 border border-gray-200 text-gray-500 py-3 rounded-lg font-montserrat font-medium cursor-not-allowed flex items-center justify-center gap-2 sm:gap-3 relative text-sm sm:text-base touch-manipulation min-h-[44px]"
            title="Google Sign-In is currently under development"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              className="opacity-50 flex-shrink-0"
            >
              <path
                fill="#4285f4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34a853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#fbbc05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#ea4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span className="truncate">Continue with Google</span>
            <span className="ml-1 sm:ml-2 text-xs bg-yellow-100 text-yellow-700 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full flex-shrink-0">
              Soon
            </span>
          </button>

          <p className="text-center mt-4 sm:mt-6 font-montserrat text-xs sm:text-sm text-mejiwoo-gray px-2">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-black font-medium hover:underline touch-manipulation"
            >
              {isSignUp ? "Sign In" : "Sign Up"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
