import type { Annotation } from "@stillsmith/annotate";

/**
 * Whatever the renderer treats as a node — `ReactNode` under React, `VNode`
 * under Vue, and so on.
 *
 * The core is generic over it and imports no framework. That matters for more
 * than tidiness: if this file said `import type { ReactNode } from "react"`, the
 * published `.d.ts` would too, and a Vue project — which has no `@types/react`
 * installed — could not even typecheck against stillsmith.
 *
 * Framework entries (`stillsmith/react`) pin it and re-export the concrete types.
 */
export type RenderNode = unknown;

/** A browser configuration to capture in: size, pixel density, colour scheme. */
export interface Preset {
  width: number;
  height: number;
  /** Device pixel ratio. 2 for retina-quality output. Default 1. */
  dpr?: number;
  colorScheme?: "light" | "dark";
}

/** One screenshot of a scene. Declared as a named export of a `*.scene.tsx`. */
export interface Shot {
  /** Overrides the filename stem. Defaults to the kebab-cased export name. */
  name?: string;
  /** Restrict this shot to these presets. Falls back to the scene's, then all. */
  presets?: string[];
  /** Selects the shot into targets that filter by tag. Merged with the scene's. */
  tags?: string[];
  /** Override the preset's dimensions. DPR and colour scheme still come from the preset. */
  viewport?: { width: number; height: number };
  /** Extra settle time after the scene reports ready, in ms. An escape hatch —
   * prefer `stabilize` in the config, which is deterministic. */
  delay?: number;
  /** Capture the full scroll height instead of the viewport. */
  fullPage?: boolean;
  /** Outlines, highlights, arrows, callouts and pins drawn over the scene just
   * before the shutter. Targets resolve by selector/text, so one annotation
   * adapts across presets. An unresolved target warns; it never fails the run. */
  annotations?: Annotation[];
}

/** The default export of a `*.scene.tsx`. */
export interface Scene<TNode = RenderNode> {
  /** Defaults to the filename minus `.scene.tsx`. */
  id?: string;
  render: () => TNode;
  /** Default presets for every shot in this file. */
  presets?: string[];
  /** Tags inherited by every shot in this file. */
  tags?: string[];
  /** Providers for this scene only, applied inside the global setup wrapper. */
  wrapper?: (props: { children: TNode }) => TNode;
}

/**
 * Output encodings.
 *
 * `png` and `jpeg` come straight from the browser. `webp` is a post-encode —
 * it needs `sharp` installed, which is an optional peer dependency: only
 * projects that ask for webp pay for the native module.
 */
export type ImageFormat = "jpeg" | "png" | "webp";

/** An output profile: where images go, at which presets, for which shots. */
export interface Target {
  outDir: string;
  /** Write `<stem>.<ext>` directly under outDir instead of `<preset>/<stem>.<ext>`. */
  flat?: boolean;
  /** Restrict to these presets. Default: every preset a shot asks for. */
  presets?: string[];
  /** Only include shots carrying at least one of these tags. Default: all shots. */
  tags?: string[];
  /** Output encoding for this target. Overrides the config-level `format`. */
  format?: ImageFormat;
  /** Overrides the config-level `quality` for this target. */
  quality?: number;
}

/** Deterministic-rendering knobs applied before every capture. */
export interface Stabilize {
  /** Await `document.fonts.ready`. Default true — font loading shifts layout. */
  fonts?: boolean;
  /**
   * Await every `<img>` loading and decoding. Default true — a scene shot
   * mid-load photographs whatever sits behind the image, which is usually a
   * plausible-looking placeholder rather than an obvious hole.
   */
  images?: boolean;
  /** `disable` zeroes CSS transitions/animations. Default "disable". */
  animations?: "disable" | "allow";
  /** Global settle time in ms, added to every shot. Default 0. */
  delay?: number;
}

/**
 * The browser-side harness: what wraps every scene, and what a colour scheme
 * means in this app.
 *
 * These can be declared inline in `stillsmith.config.tsx` (stillsmith bundles the
 * config for Node with stylesheets stubbed and your aliases resolved, and only
 * ever *calls* them in the browser), or kept in a separate file pointed at by
 * `setup`.
 */
export interface Setup<TNode = RenderNode> {
  /** Wraps every scene. Providers, seeded caches, global CSS side-effects. */
  wrapper?: (props: { children: TNode }) => TNode;
  /**
   * stillsmith owns the preset's `colorScheme` and tells you about it; the app
   * decides what that means — a `.dark` class, a `data-theme` attribute, a store
   * write. Called before the scene renders.
   */
  applyColorScheme?: (scheme: "light" | "dark") => void;
}

export interface stillsmithConfig<TNode = RenderNode> extends Setup<TNode> {
  /**
   * Which renderer mounts scenes. Stamped automatically by the framework entry's
   * `defineConfig` — import it from `stillsmith/react` and this is "react". It
   * selects the runtime bundle, so a new framework is an additive change: a new
   * entry, no edits to the core.
   */
  framework?: string;
  /** Globs for scene files, relative to the config file. */
  scenes: string[];
  /**
   * Globs for `*.tour.ts` files, relative to the config file. Opt-in: tours
   * are @stillsmith/tour's runtime artifact; stillsmith only *authors* them (the
   * editor's tour mode, the codemod, the MCP tools).
   */
  tours?: string[];
  /**
   * A separate module whose default export is `defineSetup({...})`.
   *
   * Only needed if the harness can't live in the config — e.g. it imports
   * something that genuinely cannot be loaded in Node. Otherwise declare
   * `wrapper` / `applyColorScheme` inline and skip this.
   */
  setup?: string;
  /**
   * The app's Vite config, merged into stillsmith's. Auto-detected if omitted.
   * `false` skips detection and synthesizes a config from tsconfig/postcss/env.
   */
  vite?: string | false;
  /** Merged over the app's Vite config. Escape hatch for plugins that can't
   * run in a headless browser build. */
  viteOverrides?: Record<string, unknown>;
  /**
   * A running dev server to open app pages (tours) against, e.g.
   * `"http://localhost:3000"`. When set, tour preview/authoring use it
   * directly — no build integration at all. Scene capture still uses
   * stillsmith's server.
   */
  appUrl?: string;
  /**
   * Meta-framework module shims. Auto-selected by host detection.
   * `false` disables all; a map overrides or disables per-specifier.
   */
  shims?: false | Record<string, string | false>;
  presets: Record<string, Preset>;
  targets: Record<string, Target>;
  stabilize?: Stabilize;
  /** Output encoding for every target that doesn't set its own. Default "jpeg". */
  format?: ImageFormat;
  /**
   * Encoding quality, 1–100. Applies to jpeg (default 90) and webp; ignored
   * for png, which is always lossless. WebP *without* a quality is encoded
   * lossless — set one to opt into lossy webp.
   */
  quality?: number;
}

/** Detected meta-framework / build context. Orthogonal to `framework`. */
export type HostName = "next" | "vite" | "cra" | "generic";

export interface Host {
  name: HostName;
  /** Public env prefix for define synthesis (e.g. `NEXT_PUBLIC_`). */
  envPrefix?: string;
  /** Shim sets to activate (e.g. `["next"]`). */
  shimSets: string[];
}

/** How scenes are compiled — printed every run so synthesis is never silent. */
export interface HostReport {
  host: Host;
  /** Where the Vite base config came from. */
  configSource: "vite" | "synthesized";
  /** Where Node/browser aliases came from (before shims). */
  aliasSource: "vite" | "tsconfig" | "none";
  /** Shim module specifiers that are active. */
  shims: string[];
}

/** A config with defaults filled in and paths resolved to absolute. */
export interface ResolvedConfig extends stillsmithConfig {
  /** Directory of the config file. All relative paths resolve against it. */
  root: string;
  configPath: string;
  setup?: string;
  vite?: string | false;
  framework: string;
  stabilize: Required<Stabilize>;
  format: ImageFormat;
  host: Host;
  hostReport: HostReport;
  /** Absolute shim alias entries applied in both Node and browser pipelines. */
  shimAliases: Array<{ find: string | RegExp; replacement: string }>;
  /** Active specifier → absolute shim module path (after `shims:` overrides). */
  shimModules: Record<string, string>;
}
