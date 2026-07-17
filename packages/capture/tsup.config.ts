import { defineConfig } from "tsup";

const shimEntries = {
  "shims/next/image": "src/shims/next/image.tsx",
  "shims/next/link": "src/shims/next/link.tsx",
  "shims/next/navigation": "src/shims/next/navigation.ts",
  "shims/next/router": "src/shims/next/router.ts",
  "shims/next/font-google": "src/shims/next/font-google.ts",
  "shims/next/font-local": "src/shims/next/font-local.ts",
  "shims/next/head": "src/shims/next/head.tsx",
  "shims/next/dynamic": "src/shims/next/dynamic.tsx",
  "shims/next/script": "src/shims/next/script.tsx",
  "shims/next/server-only": "src/shims/next/server-only.ts",
};

export default defineConfig([
  {
    entry: {
      index: "src/index.ts",
      // The React binding: types + defineConfig. Type-only React import, so it's
      // safe to load in Node when the config imports it.
      "react/index": "src/react/index.ts",
      // The React renderer. Browser-only; the Vite plugin loads it by path.
      // A new framework adds a sibling here and changes nothing else.
      "react/runtime": "src/react/runtime.tsx",
      "vite/index": "src/vite/index.ts",
      "annotate/index": "src/annotate/index.ts",
      "cli/index": "src/cli/index.ts",
    },
    format: ["esm"],
    dts: true,
    clean: true,
    target: "node20",
    // Everything the consumer already has stays external. `react` in particular
    // MUST NOT be bundled — the scene runtime shares the consumer's React instance.
    // `vite` is a dependency now (tier-3 hosts may have none) but still external
    // so loadVite can prefer the consumer's copy at runtime.
    external: ["react", "react-dom", "vite", "playwright"],
  },
  {
    // Meta-framework shims: each is its own entry so aliases can point at a
    // single module. `react` stays external — it resolves to the consumer's
    // React through the page (same dedupe rules as scene code).
    entry: shimEntries,
    format: ["esm"],
    dts: false,
    clean: false,
    target: "es2020",
    platform: "browser",
    external: ["react", "react-dom"],
    esbuildOptions(options) {
      options.jsx = "automatic";
    },
  },
  {
    // The authoring GUI, bundled WITH its own React and served as a static asset.
    // React is intentionally not external here: the consumer's Vite compiles
    // their scenes, not our UI, and we don't want stillsmith's React in their
    // module graph.
    entry: { app: "src/author/main.tsx" },
    outDir: "dist/author",
    format: ["esm"],
    platform: "browser",
    target: "es2020",
    dts: false,
    clean: false,
    minify: true,
    // tsup externalises dependencies and peerDependencies by default, which for
    // a browser bundle served straight off disk means unresolvable bare
    // `import … from "react"`. The GUI must carry its own React (and any UI
    // libs that depend on it), its own copy of the annotation engine, and its
    // own tour runtime (the stage's step preview IS the runtime).
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
