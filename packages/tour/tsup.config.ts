import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: {
      index: "src/index.ts",
      "react/index": "src/react/index.tsx",
    },
    format: ["esm"],
    dts: true,
    clean: true,
    platform: "browser",
    target: "es2020",
    // Both dependencies stay external: the consumer installs them (they're in
    // `dependencies`), and sharing @stillsmith/annotate as a real package makes
    // `Target` NOMINALLY identical between stillsmith-authored files and this
    // runtime — not merely structurally so.
    external: ["react", "@floating-ui/dom", "@stillsmith/annotate"],
  },
  {
    // The runtime prebuilt as a classic script, everything included — what
    // stillsmith's MCP `preview_step` injects with `addScriptTag`, the same
    // mechanism as the annotate bundle.
    entry: { tour: "src/global.ts" },
    format: ["iife"],
    globalName: "__stillsmithTour",
    outExtension: () => ({ js: ".global.js" }),
    platform: "browser",
    target: "es2020",
    dts: false,
    noExternal: [/.*/],
    // Must not wipe the ESM build above.
    clean: false,
  },
]);
