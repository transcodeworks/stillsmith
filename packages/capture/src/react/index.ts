/**
 * The React binding: `stillsmith/react`.
 *
 * This is what a React project imports. It pins stillsmith's framework-generic core
 * types to `ReactNode` and stamps `framework: "react"` onto the config, which is
 * how the Vite plugin knows which runtime bundle to mount scenes with.
 *
 * It imports React **type-only**, deliberately. The config is bundled and
 * imported in Node (see core/load-module.ts), and pulling in `react-dom/client`
 * here would drag a renderer into that path for no reason. The actual rendering
 * lives in `./runtime.tsx`, which only ever loads in the browser.
 */
import type { ReactNode } from "react";

import type {
  stillsmithConfig as CorestillsmithConfig,
  Scene as CoreScene,
  Setup as CoreSetup,
} from "../types.js";

/** A scene file's default export. */
export type Scene = CoreScene<ReactNode>;
/** The browser-side harness — providers and theming. */
export type Setup = CoreSetup<ReactNode>;
export type stillsmithConfig = CorestillsmithConfig<ReactNode>;

/**
 * Define a stillsmith config for a React app.
 *
 * Prefer this over the framework-neutral `defineConfig` from `stillsmith`: it types
 * `wrapper` against `ReactNode` (so JSX in the config typechecks) and selects the
 * React runtime.
 */
export function defineConfig(config: stillsmithConfig): stillsmithConfig {
  return { ...config, framework: "react" };
}

/**
 * Declare the browser-side harness in its own file.
 *
 * Only needed when it can't live in `stillsmith.config.tsx` — normally you declare
 * `wrapper` / `applyColorScheme` inline there and skip this entirely.
 */
export function defineSetup(setup: Setup): Setup {
  return setup;
}

// Framework-free, but re-exported so a scene file needs one import.
export type {
  Anchor,
  Annotation,
  ArrowAnnotation,
  CalloutAnnotation,
  HighlightAnnotation,
  LabelAnnotation,
  Offset,
  OutlineAnnotation,
  Point,
  Target,
} from "@stillsmith/annotate";
export type { Host, HostName, HostReport, Preset, Shot, Stabilize } from "../types.js";
