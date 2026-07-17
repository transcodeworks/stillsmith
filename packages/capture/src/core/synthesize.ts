/**
 * Synthesize an inline Vite config from universal project signals when there
 * is no consumer vite.config to merge (tier 3).
 *
 * Ingredients: tsconfig-path aliases, host-prefixed env defines. CSS is free
 * (Vite auto-detects postcss.config). JSX is free (esbuild automatic runtime).
 */
import type { InlineConfig } from "vite";

import type { Host } from "../types.js";
import { aliasesFromTsconfig } from "./aliases.js";
import type { AliasEntry } from "./load-module.js";
import { loadVite } from "./engine.js";

/** Build `define` entries so `process.env.NEXT_PUBLIC_*` (etc.) resolve in the browser. */
export async function synthesizeEnvDefines(
  root: string,
  host: Host,
  mode = "development",
): Promise<Record<string, string>> {
  const vite = await loadVite(root);
  const prefix = host.envPrefix ?? "";
  // Empty prefix would match every env var; only load when the host names one.
  const env = prefix ? vite.loadEnv(mode, root, prefix) : {};

  const define: Record<string, string> = {
    "process.env.NODE_ENV": JSON.stringify(mode === "production" ? "production" : "development"),
    // Catch-all: bare `process.env.FOO` becomes undefined instead of crashing.
    // esbuild picks the longest match, so per-key entries win.
    "process.env": "{}",
  };

  for (const [key, value] of Object.entries(env)) {
    define[`process.env.${key}`] = JSON.stringify(value);
  }

  return define;
}

export async function synthesizeBaseConfig(
  root: string,
  host: Host,
  extraAliases: AliasEntry[] = [],
): Promise<InlineConfig> {
  const tsAliases = aliasesFromTsconfig(root);
  const alias = [...extraAliases, ...tsAliases];
  const define = await synthesizeEnvDefines(root, host);

  return {
    root,
    resolve: alias.length > 0 ? { alias } : undefined,
    define,
  };
}
