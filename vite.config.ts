import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    // Use Vercel functions instead of Express server
    // In development, you can run `npm run dev:vercel` for API testing
    // or use the deployed API endpoints
    fs: {
      allow: ["./client", "./shared"],
      deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "server/**"],
    },
  },
  build: {
    outDir: "dist/spa",
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          
          // UI Library
          'ui-vendor': [
            '@radix-ui/react-tooltip',
            '@radix-ui/react-toast', 
            '@radix-ui/react-separator',
            '@radix-ui/react-label',
            '@radix-ui/react-slot'
          ],
          
          // Utilities
          'utils-vendor': [
            'clsx',
            'tailwind-merge',
            'class-variance-authority'
          ],
          
          // Data & API
          'data-vendor': [
            '@tanstack/react-query',
            '@supabase/supabase-js'
          ],
          
          // Large/Optional dependencies
          'heavy-vendor': [
            'sonner',
            'next-themes'
          ]
        }
      }
    },
    // Increase chunk size warning limit to 800KB
    chunkSizeWarningLimit: 800,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
}));
