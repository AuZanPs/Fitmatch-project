import { defineConfig } from "vite";
import path from "path";
import { copyFileSync, existsSync } from "fs";

// Server build configuration
export default defineConfig({
  plugins: [
    {
      name: 'copy-env',
      writeBundle() {
        // Copy .env file to build output
        const envSource = path.resolve(__dirname, 'server/.env');
        const envDest = path.resolve(__dirname, 'dist/server/.env');
        if (existsSync(envSource)) {
          copyFileSync(envSource, envDest);
          console.log('✓ Copied server/.env to dist/server/.env');
        }
      }
    }
  ],
  build: {
    lib: {
      entry: path.resolve(__dirname, "server/node-build.ts"),
      name: "server",
      fileName: "production",
      formats: ["es"],
    },
    outDir: "dist/server",
    target: "node22",
    ssr: true,
    rollupOptions: {
      external: [
        // Node.js built-ins
        "fs",
        "path",
        "url",
        "http",
        "https",
        "os",
        "crypto",
        "stream",
        "util",
        "events",
        "buffer",
        "querystring",
        "child_process",
        // External dependencies that should not be bundled
        "express",
        "cors",
      ],
      output: {
        format: "es",
        entryFileNames: "[name].mjs",
      },
    },
    minify: false,
    sourcemap: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
  define: {
    "process.env.NODE_ENV": '"production"',
  },
});
