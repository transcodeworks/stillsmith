import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Locate stillsmith's own package root.
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
        if (name === "@stillsmith/capture") return dir;
      } catch {
        // Unparseable package.json on the way up — keep walking.
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(`Could not locate the stillsmith package root from ${from}`);
    }
    dir = parent;
  }
}

/** Absolute path to the installed stillsmith package. Vite must allow-list this:
 * under pnpm it's a symlink into the store, far outside the project tree. */
export const PACKAGE_ROOT = findPackageRoot(path.dirname(fileURLToPath(import.meta.url)));

/**
 * The renderer that mounts scenes, served to the page through Vite's /@fs.
 *
 * Selected by `framework` — which `stillsmith/react`'s `defineConfig` stamps onto
 * the config — rather than hardcoded. Supporting Vue means shipping
 * `dist/vue/runtime.js` exporting the same `start()`; nothing in capture,
 * annotations, discovery, or the config has to change.
 */
export function runtimePath(framework: string): string {
  return path.join(PACKAGE_ROOT, "dist", framework, "runtime.js");
}

/** The prebuilt authoring GUI, served as a static asset by the dev server. */
export const AUTHOR_APP_PATH = path.join(PACKAGE_ROOT, "dist", "author", "app.js");

export function assertRuntimeBuilt(framework: string): void {
  const runtime = runtimePath(framework);
  if (existsSync(runtime)) return;

  const known = ["react"];
  if (!known.includes(framework)) {
    throw new Error(
      `Unknown framework "${framework}". stillsmith ships renderers for: ${known.join(", ")}.\n` +
        'Import `defineConfig` from "@stillsmith/capture/react" to select one.',
    );
  }
  throw new Error(
    `stillsmith's ${framework} runtime is missing at ${runtime}.\n` +
      "If you're working on stillsmith itself, run `pnpm build` first.",
  );
}
