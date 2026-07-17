import path from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// A perfectly ordinary app config. stillsmith merges *this* — the `@` alias and the
// React plugin below are what make the scene file compile, and stillsmith never
// redeclares either.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
});
