/**
 * Resolve which Vite copy to run: the consumer's if they have one (their
 * plugins were built against it), else stillsmith's bundled copy.
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** Vite majors we exercise. Below this floor we refuse the consumer's copy. */
const VITE_FLOOR = 5;

const cache = new Map<string, Promise<typeof import("vite")>>();

function satisfiesFloor(version: string): boolean {
  const major = Number.parseInt(version.split(".")[0] ?? "", 10);
  return Number.isFinite(major) && major >= VITE_FLOOR;
}

function isUsableVite(mod: unknown): mod is typeof import("vite") {
  if (!mod || typeof mod !== "object") return false;
  const m = mod as Record<string, unknown>;
  return (
    typeof m.mergeConfig === "function" &&
    typeof m.createServer === "function" &&
    typeof m.loadConfigFromFile === "function" &&
    typeof m.loadEnv === "function"
  );
}

/**
 * `require.resolve("vite")` lands on the CJS build under Vite 5, whose ESM
 * namespace interop often lacks named exports. Prefer the ESM entry when it
 * exists on disk.
 */
function resolveViteEntry(require: NodeRequire): string {
  const pkgJson = require.resolve("vite/package.json");
  const pkgDir = path.dirname(pkgJson);
  const esm = path.join(pkgDir, "dist", "node", "index.js");
  if (existsSync(esm)) return esm;
  return require.resolve("vite");
}

/**
 * The consumer's Vite if they have one, else stillsmith's bundled copy.
 * Cached per config root. A failed consumer import falls through to ours and
 * is not cached as a rejection.
 */
export function loadVite(root: string): Promise<typeof import("vite")> {
  const cached = cache.get(root);
  if (cached) return cached;

  const promise = (async () => {
    try {
      const require = createRequire(path.join(root, "package.json"));
      const { version } = require("vite/package.json") as { version: string };
      if (satisfiesFloor(version)) {
        const resolved = resolveViteEntry(require);
        // Must await inside try: a rejected dynamic import would otherwise
        // escape the catch and get cached as a permanent failure.
        const mod = await import(pathToFileURL(resolved).href);
        const vite = (mod as { default?: unknown }).default ?? mod;
        if (isUsableVite(vite)) return vite;
      }
    } catch {
      // No usable consumer vite — use ours.
    }
    return import("vite");
  })();

  cache.set(root, promise);
  return promise;
}

/** Test helper: drop the per-root cache. */
export function clearViteCache(): void {
  cache.clear();
}
