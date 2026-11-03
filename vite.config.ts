import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// base "./" lets the build run from any GitHub Pages sub-path.
export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  build: { chunkSizeWarningLimit: 1500 },
});
