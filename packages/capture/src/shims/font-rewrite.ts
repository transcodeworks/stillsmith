/**
 * Rewrite `import { Inter } from "next/font/google"` into `createGoogleFont`
 * calls so arbitrary Google font families work without a static export list.
 *
 * Shared by the Vite (browser) plugin and the esbuild (Node config-load) plugin
 * so both pipelines honour the same transform — the §6/§7 symmetry.
 */
import fs from "node:fs";
import type { Plugin as EsbuildPlugin } from "esbuild";
import type { Plugin as VitePlugin } from "vite";

export const NEXT_FONT_GOOGLE = "next/font/google";

const IMPORT_RE = /import\s*\{([^}]+)\}\s*from\s*(['"])next\/font\/google\2/g;

/**
 * @param shimHref - import path written into the rewritten source (absolute for
 *   esbuild; `/@fs…` for Vite).
 */
export function rewriteNextFontGoogleImports(code: string, shimHref: string): string | null {
  if (!code.includes(NEXT_FONT_GOOGLE)) return null;

  let matched = false;
  const rewritten = code.replace(IMPORT_RE, (_full, names: string) => {
    matched = true;
    const bindings = names
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean)
      .map((n) => {
        const [imported, local] = n.split(/\s+as\s+/).map((s) => s.trim());
        const name = imported ?? n;
        const idName = local ?? imported ?? n;
        return `const ${idName} = createGoogleFont(${JSON.stringify(name)});`;
      });
    return [`import { createGoogleFont } from ${JSON.stringify(shimHref)};`, ...bindings].join(
      "\n",
    );
  });

  return matched ? rewritten : null;
}

function loaderFor(file: string): "ts" | "tsx" | "js" | "jsx" {
  if (file.endsWith(".tsx")) return "tsx";
  if (file.endsWith(".jsx")) return "jsx";
  if (file.endsWith(".ts") || file.endsWith(".mts") || file.endsWith(".cts")) return "ts";
  return "js";
}

/** Browser pipeline — only attach when `next/font/google` is an active shim. */
export function nextFontGoogleVitePlugin(shimPath: string): VitePlugin {
  const href = `/@fs${shimPath}`;
  return {
    name: "stillsmith:next-font-google",
    enforce: "pre",
    transform(code, id) {
      if (!/\.[cm]?[jt]sx?$/.test(id)) return null;
      return rewriteNextFontGoogleImports(code, href);
    },
  };
}

/** Node config-load pipeline — same rewrite the browser plugin applies. */
export function nextFontGoogleEsbuildPlugin(shimPath: string): EsbuildPlugin {
  return {
    name: "stillsmith:next-font-google",
    setup(b) {
      b.onLoad({ filter: /\.[cm]?[jt]sx?$/ }, (args) => {
        let source: string;
        try {
          source = fs.readFileSync(args.path, "utf8");
        } catch {
          return null;
        }
        const rewritten = rewriteNextFontGoogleImports(source, shimPath);
        if (!rewritten) return null;
        return { contents: rewritten, loader: loaderFor(args.path) };
      });
    },
  };
}
