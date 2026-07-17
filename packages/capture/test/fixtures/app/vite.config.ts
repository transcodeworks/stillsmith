import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

/** A 1x1 opaque PNG — the smallest thing that can be decoded. */
const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

/** How long `/slow-image.png` sits on its hands before answering. */
export const SLOW_IMAGE_MS = 750;

/**
 * Serve one deliberately slow image.
 *
 * The image gate can only be tested by an image that loses the race, and over
 * localhost nothing loses a race: a file on disk is served long before readiness
 * fires, so the test would pass just as happily with the gate removed. The delay
 * is the test. It is comfortably longer than readiness takes (a React commit and
 * two frames, ~32ms) and than the 250ms paint backstop, so an ungated capture
 * reliably photographs the empty box where the image goes.
 */
function slowImage(): Plugin {
  return {
    name: "fixture-slow-image",
    configureServer(server) {
      server.middlewares.use("/slow-image.png", (_req, res) => {
        setTimeout(() => {
          res.setHeader("Content-Type", "image/png");
          res.end(PIXEL);
        }, SLOW_IMAGE_MS);
      });
    },
  };
}

// Otherwise deliberately plain, and deliberately without an index.html. A
// stillsmith consumer need not have one — and its absence is what leaves Vite's
// dependency scanner with nothing to crawl, which is the condition the
// React-identity test depends on. See `optimizeDeps` in src/core/server.ts.
export default defineConfig({
  plugins: [react(), slowImage()],
});
