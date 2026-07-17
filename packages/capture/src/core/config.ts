import { existsSync } from "node:fs";
import path from "node:path";

import type { HostReport, ImageFormat, stillsmithConfig, ResolvedConfig } from "../types.js";
import { NEXT_FONT_GOOGLE } from "../shims/font-rewrite.js";
import { resolveShims } from "../shims/registry.js";
import { aliasesFromTsconfig, findUp, findViteConfig, resolveAliases } from "./aliases.js";
import { detectHost } from "./host.js";
import { type AliasEntry, loadModuleDefault } from "./load-module.js";

// `.tsx` first: the config is the natural home for the JSX `wrapper`, so most
// projects will want it.
const CONFIG_NAMES = [
  "stillsmith.config.tsx",
  "stillsmith.config.ts",
  "stillsmith.config.mts",
  "stillsmith.config.js",
];

const FORMATS: ImageFormat[] = ["jpeg", "png", "webp"];

/** `format`/`quality` appear at the config level and per target; same rules both places. */
function checkImageOptions(
  configPath: string,
  where: string,
  opts: { format?: string; quality?: number },
): void {
  if (opts.format !== undefined && !FORMATS.includes(opts.format as ImageFormat)) {
    throw new Error(
      `${configPath}: ${where} has unknown format "${opts.format}". Available: ${FORMATS.join(", ")}`,
    );
  }
  if (opts.quality !== undefined && !(opts.quality >= 1 && opts.quality <= 100)) {
    throw new Error(`${configPath}: ${where} quality must be between 1 and 100`);
  }
}

/**
 * Load the stillsmith config in Node.
 *
 * Two-phase so `shims:` overrides apply to the same registry the browser uses:
 *   1. Try with app aliases only — `shims: false` must not trip the throwing
 *      server-only stub during the load that discovers it.
 *   2. On failure, retry with the host's default shims (+ font rewrite), which
 *      is what a Next-shaped config that imports `next/image` needs.
 */
async function loadstillsmithConfigModule(
  configPath: string,
  root: string,
  host: import("../types.js").Host,
  appAliases: AliasEntry[],
): Promise<stillsmithConfig> {
  try {
    return await loadModuleDefault<stillsmithConfig>(configPath, root, appAliases);
  } catch (first) {
    const defaults = resolveShims(host, { root, shims: undefined });
    if (defaults.aliases.length === 0) throw first;

    // Retry with host shims + the same font rewrite the browser applies. Prefer
    // this attempt's error: it's the one that includes shim resolution context.
    return await loadModuleDefault<stillsmithConfig>(
      configPath,
      root,
      [...defaults.aliases, ...appAliases],
      { nextFontGoogleShim: defaults.modules[NEXT_FONT_GOOGLE] },
    );
  }
}

export async function loadConfig(explicitPath?: string): Promise<ResolvedConfig> {
  const configPath = explicitPath
    ? path.resolve(process.cwd(), explicitPath)
    : findUp(CONFIG_NAMES, process.cwd());

  if (!configPath || !existsSync(configPath)) {
    throw new Error(
      "No stillsmith.config.tsx found (searched up from the working directory).\nRun `stillsmith init` to create one.",
    );
  }

  const root = path.dirname(configPath);
  const host = detectHost(root);

  // Aliases before loading the config: a chicken-and-egg we sidestep by reading
  // the nearest Vite config (or tsconfig paths) without yet knowing `vite: false`.
  // If the config later sets `vite: false`, synthesis still applies at server start;
  // the Node load just needed *some* aliases to resolve `@/` in the config file.
  const foundVite = findViteConfig(root);
  const { aliases: appAliases } = await resolveAliases(root, Boolean(foundVite), foundVite);

  let raw: stillsmithConfig;
  try {
    raw = await loadstillsmithConfigModule(configPath, root, host, appAliases);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Could not load ${path.relative(process.cwd(), configPath)}:\n${detail}\n\n` +
        "stillsmith loads the config in Node, with stylesheets stubbed and your aliases resolved.\n" +
        "If something in it genuinely cannot run in Node, move the browser-only harness into its own\n" +
        'file and point at it with `setup: "./stillsmith.setup.tsx"`.',
    );
  }

  if (!raw?.scenes?.length)
    throw new Error(`${configPath}: \`scenes\` must list at least one glob`);
  if (!raw.presets || Object.keys(raw.presets).length === 0) {
    throw new Error(`${configPath}: \`presets\` must define at least one preset`);
  }
  if (!raw.targets || Object.keys(raw.targets).length === 0) {
    throw new Error(`${configPath}: \`targets\` must define at least one target`);
  }

  const resolveMaybe = (p: string | undefined) => (p ? path.resolve(root, p) : undefined);

  // Ladder: explicit path → detected vite.config → synthesize (`false` or missing).
  let vite: string | false | undefined;
  if (raw.vite === false) {
    vite = false;
  } else if (typeof raw.vite === "string") {
    vite = resolveMaybe(raw.vite);
  } else {
    vite = foundVite ?? false;
  }

  const setup = resolveMaybe(raw.setup);
  if (setup && !existsSync(setup)) throw new Error(`${configPath}: setup file not found: ${setup}`);

  checkImageOptions(configPath, "config", raw);
  for (const [name, target] of Object.entries(raw.targets)) {
    for (const preset of target.presets ?? []) {
      if (!raw.presets[preset]) {
        throw new Error(`${configPath}: target "${name}" references unknown preset "${preset}"`);
      }
    }
    checkImageOptions(configPath, `target "${name}"`, target);
  }

  // Report alias source from the ladder tier — no second vite.config execution.
  const aliasSource: HostReport["aliasSource"] =
    typeof vite === "string" ? "vite" : aliasesFromTsconfig(root).length > 0 ? "tsconfig" : "none";

  // Final shim set — same registry output the browser pipeline consumes.
  const {
    aliases: shimAliases,
    specifiers: shimNames,
    modules: shimModules,
  } = resolveShims(host, { root, shims: raw.shims });

  const hostReport: HostReport = {
    host,
    configSource: typeof vite === "string" ? "vite" : "synthesized",
    aliasSource,
    shims: shimNames,
  };

  return {
    ...raw,
    root,
    configPath,
    setup,
    vite,
    appUrl: raw.appUrl,
    shims: raw.shims,
    host,
    hostReport,
    shimAliases,
    shimModules,
    // `stillsmith/react`'s defineConfig stamps this. A config that used the
    // framework-neutral `defineConfig` from `stillsmith` doesn't, so default it —
    // React is the only renderer that ships today.
    framework: raw.framework ?? "react",
    format: raw.format ?? "jpeg",
    stabilize: {
      fonts: raw.stabilize?.fonts ?? true,
      images: raw.stabilize?.images ?? true,
      animations: raw.stabilize?.animations ?? "disable",
      delay: raw.stabilize?.delay ?? 0,
    },
  };
}
