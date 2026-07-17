import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

import { clearViteConfigCache } from "../../src/core/aliases.js";
import { clearViteCache, loadVite } from "../../src/core/engine.js";
import { loadModuleDefault } from "../../src/core/load-module.js";
import { detectHost } from "../../src/core/host.js";
import { NEXT_FONT_GOOGLE, rewriteNextFontGoogleImports } from "../../src/shims/font-rewrite.js";
import { resolveShims } from "../../src/shims/registry.js";

const NEXT_SHAPED = fileURLToPath(new URL("../fixtures/next-shaped", import.meta.url));

afterEach(() => {
  clearViteCache();
  clearViteConfigCache();
});

describe("shim symmetry", () => {
  it("rewrite turns arbitrary named font imports into createGoogleFont calls", () => {
    const src = `import { Geist, JetBrains_Mono as Mono } from "next/font/google";\nexport const a = Geist();\nexport const b = Mono();\n`;
    const out = rewriteNextFontGoogleImports(src, "/abs/font-google.js");
    expect(out).toContain('createGoogleFont("Geist")');
    expect(out).toContain('createGoogleFont("JetBrains_Mono")');
    expect(out).toContain("const Mono =");
    expect(out).not.toContain('from "next/font/google"');
  });

  it("Node load-module rewrites non-top-15 Google font named imports", async () => {
    const host = detectHost(NEXT_SHAPED);
    const { aliases, modules } = resolveShims(host, { root: NEXT_SHAPED, shims: undefined });
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "stillsmith-font-"));
    const file = path.join(dir, "mod.tsx");
    await fs.writeFile(
      file,
      `import { Geist } from "next/font/google";\nexport default { font: Geist({ subsets: ["latin"] }) };\n`,
      "utf8",
    );

    // Would fail without the esbuild font rewrite (Geist is not a static export).
    const mod = await loadModuleDefault<{ font: { className: string } }>(
      file,
      NEXT_SHAPED,
      aliases,
      { nextFontGoogleShim: modules[NEXT_FONT_GOOGLE] },
    );
    expect(mod.font.className).toContain("geist");
  });

  it("shims: false drops next/font/google from the active module map", () => {
    const host = detectHost(NEXT_SHAPED);
    const off = resolveShims(host, { root: NEXT_SHAPED, shims: false });
    expect(off.modules[NEXT_FONT_GOOGLE]).toBeUndefined();
    expect(off.aliases).toEqual([]);

    const partial = resolveShims(host, {
      root: NEXT_SHAPED,
      shims: { [NEXT_FONT_GOOGLE]: false },
    });
    expect(partial.modules[NEXT_FONT_GOOGLE]).toBeUndefined();
    expect(partial.specifiers).toContain("next/image");
  });
});

describe("loadVite", () => {
  it("returns a usable API surface (mergeConfig / createServer / loadEnv)", async () => {
    const vite = await loadVite(NEXT_SHAPED);
    expect(typeof vite.mergeConfig).toBe("function");
    expect(typeof vite.createServer).toBe("function");
    expect(typeof vite.loadConfigFromFile).toBe("function");
    expect(typeof vite.loadEnv).toBe("function");
  });
});
