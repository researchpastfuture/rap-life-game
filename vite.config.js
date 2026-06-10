import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Local-first dev server. No analytics, no remote assets.
export default defineConfig({
  plugins: [react()],
  server: { open: true },
});
