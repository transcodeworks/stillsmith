import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";

import { findViteConfig } from "../core/aliases.js";
import { detectHost } from "../core/host.js";
import { resolveShims } from "../shims/registry.js";

const SCENE = `import type { Scene, Shot } from "@stillsmith/capture/react";

export default {
  render: () => (
    <div style={{ display: "grid", placeItems: "center", height: "100vh" }}>
      <h1>Hello from stillsmith</h1>
    </div>
  ),
} satisfies Scene;

/** One shot per named export. This one captures at every preset. */
export const Default: Shot = {};

/** Tagged into the \`docs\` target, at a smaller viewport. */
export const Docs: Shot = {
  tags: ["docs"],
  viewport: { width: 900, height: 600 },
};
`;

function configTemplate(opts: { synthesized: boolean; hostName: string; shims: string[] }): string {
  const viteBlock = opts.synthesized
    ? `  // No vite.config — stillsmith synthesizes one from tsconfig paths, PostCSS,
  // and ${opts.hostName === "next" ? "NEXT_PUBLIC_" : "host-prefixed "}env.
  // Force this even when a vite.config exists: vite: false,
`
    : `  // Your app's Vite config — merged, not replaced, so your aliases and plugins
  // apply to scenes too. Auto-detected if you leave this out.
  // vite: "./vite.config.ts",
`;

  const shimNote =
    opts.shims.length > 0
      ? `  // Host "${opts.hostName}" activates shims: ${opts.shims.join(", ")}.
  // Override or disable per-module: shims: { "next/image": false },
`
      : "";

  return `import { defineConfig } from "@stillsmith/capture/react";

// Your app's global stylesheet. stillsmith loads this config in Node with
// stylesheets stubbed out, so a browser-only import like this is safe here — in
// the browser it goes through your app's real CSS pipeline.
// import "@/index.css";

export default defineConfig({
  scenes: ["src/**/*.scene.tsx"],
${viteBlock}${shimNote}
  // Tours against a separately-running app (e.g. next dev):
  // appUrl: "http://localhost:3000",

  presets: {
    docs: { width: 1280, height: 800, dpr: 2, colorScheme: "dark" },
    thumb: { width: 1280, height: 800, dpr: 1, colorScheme: "light" },
  },

  targets: {
    docs: { outDir: "docs/public/images", flat: true, presets: ["docs"], tags: ["docs"] },
    all: { outDir: "screenshots", presets: ["thumb"] },
  },

  // Wraps every scene. Your providers go here — query clients, theme providers,
  // stores. Only ever called in the browser.
  wrapper: ({ children }) => <>{children}</>,

  // stillsmith owns the preset's colour scheme; you decide what it means.
  applyColorScheme: (scheme) =>
    document.documentElement.classList.toggle("dark", scheme === "dark"),
});
`;
}

async function writeIfAbsent(file: string, content: string): Promise<void> {
  if (existsSync(file)) {
    console.log(`  skip   ${path.relative(process.cwd(), file)} (exists)`);
    return;
  }
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content, "utf8");
  console.log(`  create ${path.relative(process.cwd(), file)}`);
}

export async function init(): Promise<void> {
  const cwd = process.cwd();
  const host = detectHost(cwd);
  // Same ladder signal loadConfig uses: no vite.config → synthesize.
  const synthesized = !findViteConfig(cwd);
  const { specifiers: shimModules } = resolveShims(host, { root: cwd, shims: undefined });

  console.log(
    `  host   ${host.name}${synthesized ? " (will synthesize vite config)" : " (will merge vite config)"}${
      shimModules.length ? `\n  shims  ${shimModules.join(", ")}` : ""
    }`,
  );

  await writeIfAbsent(
    path.join(cwd, "stillsmith.config.tsx"),
    configTemplate({ synthesized, hostName: host.name, shims: shimModules }),
  );
  await writeIfAbsent(path.join(cwd, "src", "example.scene.tsx"), SCENE);

  console.log(
    [
      "",
      "Next:",
      "  npx stillsmith install   # one-time: Chromium",
      "  npx stillsmith capture",
      "  npx stillsmith dev       # authoring GUI",
      "",
    ].join("\n"),
  );
}
