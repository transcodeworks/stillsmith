import path from "node:path";
import { fileURLToPath } from "node:url";
import { type Browser, chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { withAppPage } from "../../src/core/capture.js";
import { loadConfig } from "../../src/core/config.js";
import { type StillsmithServer, startServer } from "../../src/core/server.js";
import { applyStepPreview } from "../../src/core/tour-preview.js";
import type { ResolvedConfig } from "../../src/types.js";

/**
 * The MCP `preview_step` mechanism, minus the JSON-RPC transport: open the
 * real app, inject the CONSUMER's @stillsmith/tour bundle, draw one step, shoot.
 * This is also the seam a future CI selector check (M-T4) would drive.
 */
const APP = fileURLToPath(new URL("../fixtures/tour-app", import.meta.url));

let config: ResolvedConfig;
let server: StillsmithServer;
let browser: Browser;

beforeAll(async () => {
  config = await loadConfig(path.join(APP, "stillsmith.config.tsx"));
  server = await startServer(config, { hmr: false });
  const executablePath = process.env.PW_CHROME;
  browser = await chromium.launch(executablePath ? { executablePath } : {});
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

describe("step preview over the running app", () => {
  it("renders a resolved step and returns a PNG", async () => {
    const preset = config.presets.test;
    if (!preset) throw new Error("fixture must define a test preset");

    const { png, warnings } = await withAppPage(
      browser,
      server.baseUrl,
      config,
      { route: "/", preset },
      async (page) => {
        const warnings = await applyStepPreview(
          page,
          config.root,
          { target: { selector: "[data-shot='search']" }, body: "Search from here." },
          { index: 1, total: 4 },
        );
        // The consumer-resolved runtime drew its chrome into the page.
        expect(await page.locator("[data-stillsmith-tour='tooltip']").count()).toBe(1);
        expect(await page.locator("[data-stillsmith-tour='overlay']").count()).toBe(1);
        return { warnings, png: await page.screenshot() };
      },
    );

    expect(warnings).toEqual([]);
    expect(png.length).toBeGreaterThan(1000);
  }, 60_000);

  it("reports an unresolved target instead of failing", async () => {
    const preset = config.presets.test;
    if (!preset) throw new Error("fixture must define a test preset");

    const warnings = await withAppPage(
      browser,
      server.baseUrl,
      config,
      { route: "/", preset },
      (page) =>
        applyStepPreview(
          page,
          config.root,
          { target: { selector: "[data-shot='no-such-thing']" }, body: "?" },
          { index: 0, total: 1 },
        ),
    );

    expect(warnings.length).toBe(1);
    expect(warnings[0]).toContain("no-such-thing");
  }, 60_000);
});
