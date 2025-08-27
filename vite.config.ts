import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

const rootDir = path.resolve(__dirname);

export default defineConfig({
  plugins: [react()],
  root: path.resolve(rootDir, "src/renderer-app"),
  server: { port: 5173 },
  base: "./",
  build: {
    outDir: path.resolve(rootDir, "dist"),
    emptyOutDir: true,
  },
});
