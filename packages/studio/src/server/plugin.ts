import fs from "node:fs/promises";
import type { ResolvedConfig } from "@stillsmith/capture";
import type { ViteDevServer } from "vite";

import { GUI_APP_PATH } from "../paths.js";
import { apiMiddleware } from "./api.js";

/**
 * The authoring GUI's shell. Its script is studio's own prebuilt bundle, served
 * from disk — NOT compiled through the consumer's Vite, which only ever handles
 * their scenes. The GUI loads those scenes in a same-origin iframe, which is what
 * lets it draw live annotation previews straight into the frame's document.
 */
const STUDIO_SHELL = `<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>stillsmith · author</title></head>
  <body>
    <div id="root"></div>
    <script type="module" src="/__stillsmith/author/app.js"></script>
  </body>
</html>
`;

/**
 * Mount the authoring routes onto a running stillsmith dev server.
 *
 * Path spaces are disjoint from capture's own middleware (`/__stillsmith/` exact
 * for the scene runtime): the API owns `/__stillsmith/api/*` and the GUI owns
 * `/__stillsmith/author*`, so ordering between the plugins is not
 * correctness-sensitive.
 */
export function mountStudio(server: ViteDevServer, config: ResolvedConfig): void {
  // The save API first, so /__stillsmith/api/* never falls through.
  server.middlewares.use(apiMiddleware(server, config));

  server.middlewares.use(async (req, res, next) => {
    const pathname = new URL(req.url ?? "/", "http://localhost").pathname;

    // The GUI's prebuilt bundle, straight off disk.
    if (pathname === "/__stillsmith/author/app.js") {
      try {
        const js = await fs.readFile(GUI_APP_PATH, "utf8");
        res.setHeader("Content-Type", "text/javascript");
        res.end(js);
      } catch {
        res.statusCode = 500;
        res.end(
          `// stillsmith-studio: authoring GUI missing at ${GUI_APP_PATH}\n` +
            "// If you're working on stillsmith itself, run `pnpm build`.",
        );
      }
      return;
    }

    if (pathname === "/__stillsmith/author" || pathname === "/__stillsmith/author/") {
      res.setHeader("Content-Type", "text/html");
      res.end(STUDIO_SHELL);
      return;
    }

    return next();
  });
}
