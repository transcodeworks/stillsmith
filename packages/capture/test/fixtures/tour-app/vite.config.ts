import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Unlike the sibling `app` fixture (which deliberately has no index.html),
// this one is a real, routable app: the tour runtime runs *inside* the page,
// so there has to be a page.
export default defineConfig({
  plugins: [react()],
});
