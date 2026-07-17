import path from "node:path";
import type { InlineConfig, Plugin, ViteDevServer } from "vite";

import { stillsmith } from "../vite/index.js";
import type { ResolvedConfig } from "../types.js";
import { loadConsumerViteConfig } from "./aliases.js";
import { findSceneFiles } from "./discover.js";
import { loadVite } from "./engine.js";
import { PACKAGE_ROOT } from "./paths.js";
import { synthesizeBaseConfig } from "./synthesize.js";
import { NEXT_FONT_GOOGLE, nextFontGoogleVitePlugin } from "../shims/font-rewrite.js";

/** Every target's outDir, absolute. */
function outputDirs(config: ResolvedConfig): string[] {
  return Object.values(config.targets).map((t) => path.resolve(config.root, t.outDir));
}

export interface StillsmithServer {
  server: ViteDevServer;
  /** Where the scene runtime lives, e.g. `http://127.0.0.1:5173/__stillsmith/`. */
  baseUrl: string;
  close(): Promise<void>;
}

/**
 * Start a Vite server that is the consumer's app plus our scene runtime.
 *
 * Ladder (§2): merge a pointed-at / detected vite.config, or synthesize one
 * from tsconfig/postcss/env. `viteOverrides` merges last in every tier.
 */
export interface ServerOptions {
  /** Live-reload. On for `stillsmith dev`; off for capture, which wants a page that
   * cannot navigate out from under the shutter. */
  hmr?: boolean;
}

async function resolveBaseConfig(config: ResolvedConfig): Promise<InlineConfig> {
  if (typeof config.vite === "string") {
    // Shared cache with alias resolution — consumer config executes once.
    return (await loadConsumerViteConfig(config.root, config.vite)) ?? {};
  }

  // Tier 3: synthesize from universal signals. Shim aliases are folded in so
  // both the browser graph and (separately) Node load-module see them.
  return synthesizeBaseConfig(config.root, config.host, config.shimAliases);
}

/** Font rewrite only when that specifier is still active after `shims:` overrides. */
function shimPlugins(config: ResolvedConfig): Plugin[] {
  const google = config.shimModules[NEXT_FONT_GOOGLE];
  return google ? [nextFontGoogleVitePlugin(google)] : [];
}

export async function startServer(
  config: ResolvedConfig,
  { hmr = true }: ServerOptions = {},
): Promise<StillsmithServer> {
  const vite = await loadVite(config.root);
  const base = await resolveBaseConfig(config);

  // If the app's config didn't pin a root, anchor it where its config lives —
  // that's what its relative paths were written against.
  const appRoot = base.root
    ? path.resolve(config.root, base.root)
    : typeof config.vite === "string"
      ? path.dirname(config.vite)
      : config.root;

  // Shim aliases on top for tier 1–2 (tier 3 already included them in base).
  const shimAlias =
    typeof config.vite === "string" && config.shimAliases.length > 0
      ? { resolve: { alias: config.shimAliases } }
      : {};

  const merged = vite.mergeConfig(
    vite.mergeConfig(vite.mergeConfig(base, shimAlias), {
      // We already loaded it by hand; don't let Vite load it a second time.
      configFile: false,
      root: appRoot,
      plugins: [...shimPlugins(config), stillsmith(config)],
      // Scenes import the app's components, which import React from the app's
      // node_modules. One React instance or hooks cross streams.
      resolve: { dedupe: ["react", "react-dom"] },
      /**
       * Both keys below serve one end: keep the page on a single React instance.
       * Two instances means react-dom hands the hook dispatcher to one of them
       * while scene components read it from the other, and the first hook anyone
       * calls — a scene's `useState`, Headless UI's `useContext` — dies with
       * "Invalid hook call". The `dedupe` above is necessary and nowhere near
       * sufficient: it settles which *file* React resolves to, and a React served
       * under two URLs is still two Reacts.
       *
       * The URLs diverge when a dependency is optimized late. Vite pre-bundles
       * what its scanner finds, serves the rest raw, and re-hashes every chunk
       * when it discovers something new mid-load — leaving a page holding
       * `react.js?v=A` from before the re-optimization and
       * `@headlessui_react.js?v=B` from after. `stillsmith dev` papers over this with
       * an HMR reload. Capture runs with HMR off precisely so the page cannot
       * navigate out from under the shutter, so nothing reconciles it and the
       * split React survives all the way to the screenshot.
       *
       * So name everything up front, and let the scanner do its job:
       *
       * `entries` — the scanner crawls from the app's index.html, and stillsmith's
       *   page has none. The scenes ARE the entry. Without this it finds nothing,
       *   and every library a scene imports is a late discovery.
       * `include` — the runtime is served off disk via /@fs, outside the Vite
       *   root, so the scanner never crawls it either. `react-dom/client` is
       *   imported by nothing else in the graph, which makes it a late discovery
       *   however good `entries` is.
       */
      optimizeDeps: {
        exclude: ["stillsmith"],
        include: ["react", "react/jsx-runtime", "react-dom", "react-dom/client"],
        entries: [...(await findSceneFiles(config)), config.setup ?? config.configPath],
      },
      server: {
        host: "127.0.0.1",
        strictPort: false,
        // Capture writes images into the project — often into a target's outDir
        // under the Vite root. Watching those means the act of screenshotting
        // churns the watcher (and, with HMR on, could navigate the page being
        // shot). Nothing in an output directory is ever a source file.
        watch: { ignored: outputDirs(config).map((d) => path.join(d, "**")) },
        hmr,
        fs: {
          // The scene runtime is served straight off disk via /@fs. Under pnpm
          // the package is a symlink into the store, outside any of these roots,
          // so it has to be allow-listed explicitly.
          allow: [config.root, appRoot, PACKAGE_ROOT],
        },
      },
      logLevel: "warn",
    } satisfies InlineConfig),
    (config.viteOverrides ?? {}) as InlineConfig,
  );

  const server = await vite.createServer(merged);
  await server.listen();

  const local = server.resolvedUrls?.local[0];
  if (!local) throw new Error("Vite did not report a local URL");

  return {
    server,
    baseUrl: `${local.replace(/\/$/, "")}/__stillsmith/`,
    close: () => server.close(),
  };
}
