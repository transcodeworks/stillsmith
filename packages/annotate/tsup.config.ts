import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { index: "src/index.ts" },
    format: ["esm"],
    dts: true,
    clean: true,
    platform: "browser",
    target: "es2020",
  },
  {
    // The engine prebuilt as a classic script. stillsmith's capture driver injects
    // this with `addScriptTag` rather than shipping a function through
    // `page.evaluate` — which is what lets draw.ts use ordinary module-scope
    // helpers, and kills the `globalThis.__name` esbuild shim show-control's
    // bridge needed.
    entry: { annotate: "src/index.ts" },
    format: ["iife"],
    globalName: "__stillsmithAnnotate",
    outExtension: () => ({ js: ".global.js" }),
    platform: "browser",
    target: "es2020",
    dts: false,
    // Must not wipe the ESM build above.
    clean: false,
  },
]);
