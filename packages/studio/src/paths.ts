import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Locate studio's own package root.
 *
 * We can't derive it from `import.meta.url` by counting `../` — the bundler is
 * free to hoist this code into a shared chunk at any depth, and it does. So walk
 * up to the nearest `package.json` that actually says it's us.
 */
function findPackageRoot(from: string): string {
  let dir = from;
  for (;;) {
    const manifest = path.join(dir, "package.json");
    if (existsSync(manifest)) {
      try {
        const { name } = JSON.parse(readFileSync(manifest, "utf8")) as { name?: string };
        if (name === "@stillsmith/studio") return dir;
      } catch {
        // Unparseable package.json on the way up — keep walking.
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(`Could not locate the @stillsmith/studio package root from ${from}`);
    }
    dir = parent;
  }
}

/** The prebuilt authoring GUI, served as a static asset by the dev server. */
export const GUI_APP_PATH = path.join(
  findPackageRoot(path.dirname(fileURLToPath(import.meta.url))),
  "dist",
  "gui",
  "app.js",
);
