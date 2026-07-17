/**
 * Shim registry: meta-framework module stand-ins applied as aliases in both
 * the browser (Vite resolve.alias) and Node (load-module) pipelines.
 */
import path from "node:path";

import type { Host, ResolvedConfig } from "../types.js";
import { PACKAGE_ROOT } from "../core/paths.js";
import type { AliasEntry } from "../core/load-module.js";

export interface ShimSet {
  name: string;
  /** specifier → absolute path into stillsmith's dist/shims/<set>/ */
  modules(): Record<string, string>;
}

function shimFile(...parts: string[]): string {
  return path.join(PACKAGE_ROOT, "dist", "shims", ...parts);
}

const nextShims: ShimSet = {
  name: "next",
  modules: () => ({
    "next/image": shimFile("next", "image.js"),
    "next/link": shimFile("next", "link.js"),
    "next/navigation": shimFile("next", "navigation.js"),
    "next/router": shimFile("next", "router.js"),
    "next/font/google": shimFile("next", "font-google.js"),
    "next/font/local": shimFile("next", "font-local.js"),
    "next/head": shimFile("next", "head.js"),
    "next/dynamic": shimFile("next", "dynamic.js"),
    "next/script": shimFile("next", "script.js"),
    "next/headers": shimFile("next", "server-only.js"),
    "next/cache": shimFile("next", "server-only.js"),
    "server-only": shimFile("next", "server-only.js"),
  }),
};

const SETS: ShimSet[] = [nextShims];

export function shimSetByName(name: string): ShimSet | undefined {
  return SETS.find((s) => s.name === name);
}

/** Exact-specifier alias so `next/image` does not also match `next/image/foo`. */
function exactAlias(specifier: string, replacement: string): AliasEntry {
  const escaped = specifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return { find: new RegExp(`^${escaped}$`), replacement };
}

export interface ResolvedShims {
  aliases: AliasEntry[];
  specifiers: string[];
  /** Active specifier → absolute module path (after overrides). */
  modules: Record<string, string>;
}

/**
 * Resolve active shim aliases for a host + config overrides.
 *
 * Overrides: `false` disables all; a map replaces or disables per-specifier
 * (relative paths resolve against the config root).
 */
export function resolveShims(
  host: Host,
  config: Pick<ResolvedConfig, "root" | "shims">,
): ResolvedShims {
  if (config.shims === false) return { aliases: [], specifiers: [], modules: {} };

  const modules: Record<string, string> = {};
  for (const setName of host.shimSets) {
    const set = shimSetByName(setName);
    if (!set) continue;
    Object.assign(modules, set.modules());
  }

  if (config.shims) {
    for (const [specifier, value] of Object.entries(config.shims)) {
      if (value === false) {
        delete modules[specifier];
      } else {
        modules[specifier] = path.resolve(config.root, value);
      }
    }
  }

  const specifiers = Object.keys(modules).sort();
  const aliases = specifiers.map((specifier) => exactAlias(specifier, modules[specifier]!));
  return { aliases, specifiers, modules };
}
