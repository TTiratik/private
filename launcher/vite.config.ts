import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Renderer build. base "./" so Electron can load from file://
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: { outDir: "dist", emptyOutDir: true },
  server: { port: 5173, strictPort: true },
});
