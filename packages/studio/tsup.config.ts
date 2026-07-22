import { defineConfig } from "tsup";

export default defineConfig([
  {
    // Node side: the Vite plugin entry and the CLI. Dependencies (ts-morph,
    // @stillsmith/capture) stay external as usual; `vite` is external so the
    // plugin types resolve against the consumer's copy at runtime.
    entry: {
      index: "src/index.ts",
      "cli/index": "src/cli/index.ts",
    },
    format: ["esm"],
    dts: true,
    clean: true,
    target: "node20",
    external: ["vite", "react", "react-dom", "playwright"],
  },
  {
    // The authoring GUI, bundled WITH its own React and served as a static asset.
    // React is intentionally not external here: the consumer's Vite compiles
    // their scenes, not our UI, and we don't want studio's React in their
    // module graph. The GUI must carry its own React (and any UI libs that
    // depend on it), its own copy of the annotation engine, and its own tour
    // runtime (the stage's step preview IS the runtime).
    entry: { app: "src/gui/main.tsx" },
    outDir: "dist/gui",
    format: ["esm"],
    platform: "browser",
    target: "es2020",
    dts: false,
    clean: false,
    minify: true,
    noExternal: [
      "react",
      "react-dom",
      "react-resizable-panels",
      "@stillsmith/annotate",
      "@stillsmith/tour",
      "@floating-ui/dom",
    ],
  },
]);
