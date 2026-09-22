import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Locate the root of the package named `name`, walking up from `from`.
 *
 * A package can't derive its own root from `import.meta.url` by counting `../`
 * — the bundler is free to hoist that code into a shared chunk at any depth,
 * and it does. So walk up to the nearest `package.json` that actually says
 * it's the package we want. Shared with companion packages (@stillsmith/studio)
 * that face the same problem.
 */
export function findPackageRoot(from: string, name: string): string {
  let dir = from;
  for (;;) {
    const manifest = path.join(dir, "package.json");
    if (existsSync(manifest)) {
      try {
        const parsed = JSON.parse(readFileSync(manifest, "utf8")) as { name?: string };
        if (parsed.name === name) return dir;
      } catch {
        // Unparseable package.json on the way up — keep walking.
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(`Could not locate the ${name} package root from ${from}`);
    }
    dir = parent;
  }
}

/** Absolute path to the installed stillsmith package. Vite must allow-list this:
 * under pnpm it's a symlink into the store, far outside the project tree. */
export const PACKAGE_ROOT = findPackageRoot(
  path.dirname(fileURLToPath(import.meta.url)),
  "@stillsmith/capture",
);

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

/**
 * Serve an absolute on-disk path to the browser through Vite's `/@fs/` endpoint.
 *
 * Vite wants `/@fs/` followed by the path with forward slashes and no leading
 * slash: `/@fs/home/u/x.tsx`, `/@fs/D:/work/x.tsx`. A bare `` `/@fs${abs}` ``
 * only works on POSIX, where `abs` happens to start with `/`; on Windows it
 * produced `/@fsD:\work\x.tsx`, which Vite answers with a 500 for the entry
 * module, so no scene page could load. UNC roots (`\\server\share`) are not
 * handled deliberately — Vite's own handling of them is not settled either.
 */
export function fsUrl(abs: string): string {
  return `/@fs/${abs.replace(/\\/g, "/").replace(/^\/+/, "")}`;
}

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
