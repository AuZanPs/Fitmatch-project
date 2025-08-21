import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getCurrentSession } from "../lib/supabase";

export default function Index() {
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuthAndRedirect = async () => {
      try {
        const {
          data: { session },
        } = await getCurrentSession();

        if (session?.user) {
          // User is authenticated, redirect to dashboard
          navigate("/dashboard");
        } else {
          // User is not authenticated, redirect to landing page
          navigate("/landing");
        }
      } catch (error) {
        // On error, redirect to landing page
        navigate("/landing");
      }
    };

    checkAuthAndRedirect();
  }, [navigate]);

  // Show loading state while redirecting
  return (
    <div className="min-h-screen bg-gradient-to-br from-mejiwoo-cream to-white flex items-center justify-center px-4">
      <div className="text-center">
        <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-black mx-auto mb-3 sm:mb-4"></div>
        <p className="font-montserrat text-sm sm:text-base text-mejiwoo-gray">
          Loading FitMatch...
        </p>
      </div>
    </div>
  );
}
