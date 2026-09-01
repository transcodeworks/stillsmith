import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "tsup";

/**
 * The @stillsmith/tour version compiled into the GUI bundle. The stage's step
 * preview runs this copy, while the consumer's app runs whatever they
 * installed; the GUI compares the two at runtime (against `tourVersion` from
 * the state API) and warns in tour mode when they disagree.
 */
function bundledTourVersion(): string {
  // `package.json` is not in the package's `exports`: resolve the entry and
  // walk up to the manifest beside its dist.
  const entry = fileURLToPath(import.meta.resolve("@stillsmith/tour"));
  for (let dir = path.dirname(entry); ; dir = path.dirname(dir)) {
    try {
      const manifest = JSON.parse(readFileSync(path.join(dir, "package.json"), "utf8")) as {
        name?: string;
        version?: string;
      };
      if (manifest.name === "@stillsmith/tour" && manifest.version) return manifest.version;
    } catch {
      // No manifest here (or an unreadable one) — keep walking up.
    }
    if (path.dirname(dir) === dir) {
      throw new Error("Could not read the version of the bundled @stillsmith/tour");
    }
  }
}

export default defineConfig([
  {
    // Node side: the Vite plugin entry and the CLI. Dependencies and peers
    // (ts-morph, @stillsmith/capture) stay external as usual; `vite` is
    // external so the plugin types resolve against the consumer's copy at
    // runtime.
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
    // runtime (the stage's step preview IS the runtime) — which is why the
    // bundled tour version is stamped in: the consumer's app may run another.
    entry: { app: "src/gui/main.tsx" },
    outDir: "dist/gui",
    format: ["esm"],
    platform: "browser",
    target: "es2020",
    dts: false,
    clean: false,
    minify: true,
    define: { __BUNDLED_TOUR_VERSION__: JSON.stringify(bundledTourVersion()) },
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
