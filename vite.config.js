// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
  plugins: [
    react(),
    // PWA disabled to avoid stale caches in prod; re-enable when ready
  ],
  base: './',
  server: {
    port: 5173,
    proxy: {
      // Proxy API requests to the backend server
      "/api": {
        target: process.env.VITE_PROXY_TARGET || "http://localhost:3001",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
