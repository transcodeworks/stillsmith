import path from "node:path";
import { fileURLToPath } from "node:url";

import { findPackageRoot } from "@stillsmith/capture/node";

/**
 * Absolute path to the installed @stillsmith/studio package. Vite must
 * allow-list this: under pnpm it's a symlink into the store, far outside the
 * project tree.
 *
 * Walked up from `import.meta.url` rather than counted in `../`s — the bundler
 * is free to hoist this code into a shared chunk at any depth, and it does.
 */
export const STUDIO_ROOT = findPackageRoot(
  path.dirname(fileURLToPath(import.meta.url)),
  "@stillsmith/studio",
);

/** The prebuilt authoring GUI, served as a static asset by the dev server. */
export const GUI_APP_PATH = path.join(STUDIO_ROOT, "dist", "gui", "app.js");
