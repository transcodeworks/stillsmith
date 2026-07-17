import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { clearViteConfigCache } from "../../src/core/aliases.js";
import { loadConfig } from "../../src/core/config.js";
import { clearViteCache } from "../../src/core/engine.js";

afterEach(() => {
  clearViteCache();
  clearViteConfigCache();
});

const CONFIG = `import { defineConfig } from "@stillsmith/capture/react";

export default defineConfig({
  scenes: ["*.scene.tsx"],
  shims: false,
  presets: { test: { width: 100, height: 100 } },
  targets: { test: { outDir: "out" } },
});
`;

const SCENE = `import type { Scene, Shot } from "@stillsmith/capture/react";
export default { render: () => null } satisfies Scene;
export const Default: Shot = {};
`;

describe("shims: false two-phase load", () => {
  it("loads a next-host config with shims:false without applying throwing stubs", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "stillsmith-shims-false-"));
    await fs.writeFile(
      path.join(dir, "package.json"),
      JSON.stringify({
        name: "tmp-shims-false",
        private: true,
        type: "module",
        dependencies: { next: "14.0.0", react: "19.0.0", "react-dom": "19.0.0" },
      }),
      "utf8",
    );
    await fs.writeFile(path.join(dir, "stillsmith.config.tsx"), CONFIG, "utf8");
    await fs.writeFile(path.join(dir, "basic.scene.tsx"), SCENE, "utf8");

    await fs.mkdir(path.join(dir, "node_modules", "@stillsmith"), { recursive: true });
    const captureRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
    await fs.symlink(captureRoot, path.join(dir, "node_modules", "@stillsmith", "capture"));

    const config = await loadConfig(path.join(dir, "stillsmith.config.tsx"));
    expect(config.host.name).toBe("next");
    expect(config.shims).toBe(false);
    expect(config.shimAliases).toEqual([]);
    expect(config.shimModules).toEqual({});
    expect(config.hostReport.shims).toEqual([]);
  });
});
