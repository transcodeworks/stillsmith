/**
 * Resolve path aliases for the Node config loader and (in tier 3) for the
 * synthesized Vite config.
 *
 * Tier 1–2: from the loaded Vite config.
 * Tier 3: from tsconfig `paths` (+ `baseUrl`), via TypeScript's own parser so
 * `extends` chains resolve correctly.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import type { InlineConfig } from "vite";
import { ts } from "ts-morph";

import type { AliasEntry } from "./load-module.js";
import { loadVite } from "./engine.js";

const VITE_CONFIG_NAMES = [
  "vite.config.ts",
  "vite.config.mts",
  "vite.config.js",
  "vite.config.mjs",
];
const TSCONFIG_NAMES = ["tsconfig.json", "tsconfig.app.json", "jsconfig.json"];

/** Cache so loadConfig + startServer don't re-execute the consumer's config. */
const viteConfigCache = new Map<string, Promise<InlineConfig | null>>();

export function findUp(names: string[], from: string): string | null {
  let dir = from;
  for (;;) {
    for (const name of names) {
      const candidate = path.join(dir, name);
      if (existsSync(candidate)) return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function findViteConfig(from: string): string | null {
  return findUp(VITE_CONFIG_NAMES, from);
}

/** Load (and cache) the consumer's Vite config. Shared by alias resolution and startServer. */
export function loadConsumerViteConfig(
  root: string,
  viteConfigPath: string,
): Promise<InlineConfig | null> {
  const cached = viteConfigCache.get(viteConfigPath);
  if (cached) return cached;

  const promise = (async () => {
    try {
      const vite = await loadVite(root);
      const loaded = await vite.loadConfigFromFile(
        { command: "serve", mode: "development" },
        viteConfigPath,
        root,
        "silent",
      );
      return loaded?.config ?? null;
    } catch {
      return null;
    }
  })();

  viteConfigCache.set(viteConfigPath, promise);
  return promise;
}

/** Test helper. */
export function clearViteConfigCache(): void {
  viteConfigCache.clear();
}

/** Map one tsconfig paths entry to an AliasEntry. */
function pathPatternToAlias(
  pattern: string,
  mappings: string[],
  baseUrl: string,
): AliasEntry | null {
  const target = mappings[0];
  if (!target) return null;

  if (pattern.endsWith("/*") && target.endsWith("/*")) {
    return {
      find: pattern.slice(0, -2),
      replacement: path.resolve(baseUrl, target.slice(0, -2)),
    };
  }
  return {
    find: pattern,
    replacement: path.resolve(baseUrl, target),
  };
}

/** Parse tsconfig/jsconfig paths into AliasEntry[], honouring extends + baseUrl. */
export function aliasesFromTsconfig(root: string): AliasEntry[] {
  const configFile = findUp(TSCONFIG_NAMES, root);
  if (!configFile) return [];

  const host: ts.ParseConfigFileHost = {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic(diagnostic) {
      throw new Error(ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"));
    },
  };

  let parsed: ts.ParsedCommandLine | undefined;
  try {
    parsed = ts.getParsedCommandLineOfConfigFile(configFile, {}, host);
  } catch {
    return [];
  }
  if (!parsed) return [];

  const options = parsed.options;
  const baseUrl = options.baseUrl
    ? path.resolve(path.dirname(configFile), options.baseUrl)
    : path.dirname(configFile);
  const paths = options.paths;
  if (!paths) return [];

  const aliases: AliasEntry[] = [];
  for (const [pattern, mappings] of Object.entries(paths)) {
    const entry = pathPatternToAlias(pattern, mappings, baseUrl);
    if (entry) aliases.push(entry);
  }
  return aliases;
}

async function aliasesFromViteConfig(root: string, viteConfig: string): Promise<AliasEntry[]> {
  const config = await loadConsumerViteConfig(root, viteConfig);
  const alias = config?.resolve?.alias;
  if (!alias) return [];

  return Array.isArray(alias)
    ? alias.map((a) => ({ find: a.find, replacement: a.replacement }))
    : Object.entries(alias).map(([find, replacement]) => ({
        find,
        replacement: String(replacement),
      }));
}

export type AliasSource = "vite" | "tsconfig" | "none";

/**
 * Resolve app aliases for the given ladder tier.
 *
 * @param preferVite - when false (tier 3 / `vite: false`), skip vite config and
 *   use tsconfig paths only.
 */
export async function resolveAliases(
  root: string,
  preferVite: boolean,
  viteConfigPath?: string | null,
): Promise<{ aliases: AliasEntry[]; source: AliasSource; viteConfig: string | null }> {
  const viteConfig = viteConfigPath === undefined ? findViteConfig(root) : (viteConfigPath ?? null);

  if (preferVite && viteConfig) {
    const aliases = await aliasesFromViteConfig(root, viteConfig);
    return { aliases, source: "vite", viteConfig };
  }

  const aliases = aliasesFromTsconfig(root);
  return {
    aliases,
    source: aliases.length > 0 ? "tsconfig" : "none",
    viteConfig,
  };
}
