/**
 * Import a TS/TSX module in Node, even when it was written for the browser.
 *
 * This is what lets the config and the setup live in ONE file. The config's data
 * half (presets, targets, globs) is needed in Node before any browser exists;
 * its harness half (a JSX `wrapper`, an `import "@/theme.css"`) is browser-only
 * and is never *called* in Node — but it still has to be *importable* there, or
 * the file can't be loaded at all.
 *
 * Vite's own `loadConfigFromFile` can't do it: it bundles for Node and dies on
 * the first `import "@/theme.css"`. So bundle it ourselves, with two rules:
 *
 *   - stylesheets and assets resolve to an empty stub (nothing in Node needs a
 *     stylesheet, and it's the single most common browser-only import);
 *   - the app's own Vite aliases (`@/…`) resolve exactly as they do in the app,
 *     so a config can import the app's providers and fixtures.
 *
 * Bare packages stay external, so `react` and friends load from the consumer's
 * own node_modules rather than being bundled.
 */
import { existsSync, statSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { type Plugin, build } from "esbuild";

import { nextFontGoogleEsbuildPlugin } from "../shims/font-rewrite.js";

/** Browser-only imports with no meaning in Node. */
const ASSET_RE = /\.(css|scss|sass|less|styl|png|jpe?g|gif|svg|webp|avif|ico|woff2?|ttf|eot)$/;

const stubAssets: Plugin = {
  name: "stillsmith:stub-assets",
  setup(b) {
    // Matched on the import specifier, before any alias resolution, so it
    // catches `./theme.css` and `@/theme.css` alike.
    b.onResolve({ filter: ASSET_RE }, (args) => ({
      path: args.path,
      namespace: "stillsmith-stub",
    }));
    b.onLoad({ filter: /.*/, namespace: "stillsmith-stub" }, () => ({
      contents: "export default {};",
      loader: "js",
    }));
  },
};

export interface AliasEntry {
  find: string | RegExp;
  replacement: string;
}

export interface LoadModuleOptions {
  /**
   * Absolute path of the active `next/font/google` shim. When set, named
   * imports are rewritten the same way as the browser Vite plugin.
   */
  nextFontGoogleShim?: string;
}

/** Resolve the app's Vite aliases the way the app does. */
function aliasPlugin(aliases: AliasEntry[]): Plugin {
  return {
    name: "stillsmith:alias",
    setup(b) {
      for (const { find, replacement } of aliases) {
        const filter =
          typeof find === "string"
            ? new RegExp(`^${find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(/|$)`)
            : find;

        b.onResolve({ filter }, (args) => {
          const resolved =
            typeof find === "string"
              ? path.resolve(replacement, args.path.slice(find.length).replace(/^\//, ""))
              : args.path.replace(find, replacement);
          return { path: resolveFile(resolved) };
        });
      }
    },
  };
}

/** An alias lands on an extensionless path far more often than not. */
const EXTENSIONS = [".tsx", ".ts", ".jsx", ".js", ".mjs", ".json"];

function resolveFile(base: string): string {
  if (existsSync(base) && statSync(base).isFile()) return base;
  for (const ext of EXTENSIONS) {
    if (existsSync(base + ext)) return base + ext;
  }
  for (const ext of EXTENSIONS) {
    const index = path.join(base, `index${ext}`);
    if (existsSync(index)) return index;
  }
  return base;
}

/**
 * Bundle `file` for Node and import it, returning its default export.
 *
 * The bundle is written under the project's `node_modules` rather than a temp
 * dir on purpose: bare imports are left external, so Node resolves them from
 * where the bundle sits. From /tmp, `react` would not resolve.
 */
export async function loadModuleDefault<T>(
  file: string,
  root: string,
  aliases: AliasEntry[] = [],
  options: LoadModuleOptions = {},
): Promise<T> {
  const outDir = path.join(root, "node_modules", ".stillsmith");
  await fs.mkdir(outDir, { recursive: true });

  const outFile = path.join(outDir, `${path.basename(file)}.${process.pid}.mjs`);

  const plugins: Plugin[] = [stubAssets];
  if (options.nextFontGoogleShim) {
    // Before aliases: rewrite named font imports so esbuild never asks the
    // shim module for a missing named export.
    plugins.push(nextFontGoogleEsbuildPlugin(options.nextFontGoogleShim));
  }
  plugins.push(aliasPlugin(aliases));

  try {
    await build({
      entryPoints: [file],
      outfile: outFile,
      bundle: true,
      format: "esm",
      platform: "node",
      target: "node20",
      jsx: "automatic",
      // Bare packages resolve from the consumer's node_modules at run time.
      packages: "external",
      // Assets first: it must win over the alias plugin for `@/theme.css`.
      plugins,
      logLevel: "silent",
    });

    const mod = (await import(pathToFileURL(outFile).href)) as { default?: T };
    if (!mod.default) throw new Error(`${file} has no default export`);
    return mod.default;
  } finally {
    await fs.rm(outFile, { force: true });
  }
}
