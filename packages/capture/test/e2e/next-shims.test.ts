import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type Browser, chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { renderShot, withScenePage } from "../../src/core/capture.js";
import { loadConfig } from "../../src/core/config.js";
import { discoverScenes } from "../../src/core/discover.js";
import { buildPlan } from "../../src/core/plan.js";
import { type StillsmithServer, startServer } from "../../src/core/server.js";
import type { ResolvedConfig } from "../../src/types.js";

/**
 * H2 exit test: a Next-shaped fixture with `next` **not installed** whose
 * component imports next/image, next/link, next/font/google, next/navigation
 * renders and captures. Server-only shim error asserted separately.
 *
 * Hero.tsx imports `Karla`, which is not a static export of the font-google
 * shim — it only works through the import rewrite. That must hold in the
 * optimizeDeps scanner too (esbuild, no Vite transform hooks), or the whole
 * dependency scan aborts and pre-bundling is skipped.
 */
const APP = fileURLToPath(new URL("../fixtures/next-shaped", import.meta.url));

let config: ResolvedConfig;
let server: StillsmithServer;
let browser: Browser;
const viteErrors: string[] = [];

beforeAll(async () => {
  // A warm optimizer cache skips the dependency scan entirely; clear it so the
  // scan-survives-Karla regression assertion below actually exercises the scan.
  await fs.rm(path.join(APP, "node_modules", ".vite"), { recursive: true, force: true });

  config = await loadConfig(path.join(APP, "stillsmith.config.tsx"));
  expect(config.host.name).toBe("next");
  expect(config.hostReport.shims).toContain("next/image");
  expect(config.hostReport.shims).toContain("next/link");
  expect(config.hostReport.shims).toContain("next/font/google");
  expect(config.hostReport.shims).toContain("next/navigation");

  config.viteOverrides = {
    customLogger: {
      hasWarned: false,
      info: () => {},
      warn: (msg: string) => console.warn(msg),
      warnOnce: (msg: string) => console.warn(msg),
      error: (msg: string) => {
        viteErrors.push(msg);
        console.error(msg);
      },
      clearScreen: () => {},
      hasErrorLogged: () => false,
    },
  };

  server = await startServer(config, { hmr: false });
  const executablePath = process.env.PW_CHROME;
  browser = await chromium.launch(executablePath ? { executablePath } : {});
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

describe("next shims (next not installed)", () => {
  it("renders image/link/font/navigation and captures", async () => {
    const scenes = await discoverScenes(server.server, config);
    const plan = buildPlan(config, scenes, "test", {});
    expect(plan.length).toBeGreaterThan(0);

    const item = plan[0]!;
    await withScenePage(browser, server.baseUrl, config, item, async (page) => {
      const seen = await page.evaluate(() => ({
        hero: document.querySelector("[data-shot='hero']") !== null,
        img: document.querySelector("img[alt='pixel']") !== null,
        href: document.querySelector("[data-shot='about-link']")?.getAttribute("href"),
        pathname: document.querySelector("[data-shot='pathname']")?.textContent,
        fontClass: document.querySelector("[data-shot='pathname']")?.className,
      }));
      expect(seen.hero).toBe(true);
      expect(seen.img).toBe(true);
      expect(seen.href).toBe("/about");
      expect(seen.pathname).toBe("/");
      // Karla resolves through the import rewrite, not a static shim export.
      expect(seen.fontClass).toBe("stillsmith-font-karla");
    });

    const { image } = await renderShot(browser, server.baseUrl, config, item);
    expect(image.length).toBeGreaterThan(500);
  }, 60_000);

  it("dependency scan survives a non-static font family", async () => {
    // The scan runs in the background; it has settled once scanProcessing (set
    // during optimizer init, cleared when the scan ends) is resolved/undefined.
    type WithOptimizer = { environments?: { client?: { depsOptimizer?: unknown } } };
    const optimizer = (server.server as unknown as WithOptimizer).environments?.client
      ?.depsOptimizer as { scanProcessing?: Promise<void> } | undefined;
    expect(optimizer).toBeDefined();
    await optimizer?.scanProcessing;

    const scanErrors = viteErrors.filter((m) => m.includes("Failed to run dependency scan"));
    expect(scanErrors).toEqual([]);
  }, 60_000);
});
