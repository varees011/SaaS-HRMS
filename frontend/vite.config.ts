import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          data: ["@tanstack/react-query", "@tanstack/react-table", "zustand"],
          forms: ["react-hook-form", "@hookform/resolvers", "zod"],
          ui: [
            "@radix-ui/react-dialog",
            "@radix-ui/react-label",
            "@radix-ui/react-slot",
            "lucide-react"
          ]
        }
      }
    }
  }
});
