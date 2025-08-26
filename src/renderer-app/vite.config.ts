import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

const rootDir = path.resolve(__dirname);

export default defineConfig({
  plugins: [react()],
  root: rootDir,
  server: { port: 5173 },
  build: {
    outDir: path.resolve(rootDir, "dist"),
    emptyOutDir: true,
  },
});
