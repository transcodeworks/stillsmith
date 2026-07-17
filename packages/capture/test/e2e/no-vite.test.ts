import path from "node:path";
import { fileURLToPath } from "node:url";
import { type Browser, chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { renderShot } from "../../src/core/capture.js";
import { loadConfig } from "../../src/core/config.js";
import { discoverScenes } from "../../src/core/discover.js";
import { buildPlan } from "../../src/core/plan.js";
import { type StillsmithServer, startServer } from "../../src/core/server.js";
import type { ResolvedConfig } from "../../src/types.js";

/**
 * H1 exit test: a fixture with tsconfig paths + PostCSS and **no vite.config,
 * no vite install** captures a shot via synthesized config.
 */
const APP = fileURLToPath(new URL("../fixtures/no-vite", import.meta.url));

let config: ResolvedConfig;
let server: StillsmithServer;
let browser: Browser;

beforeAll(async () => {
  config = await loadConfig(path.join(APP, "stillsmith.config.tsx"));
  expect(config.hostReport.configSource).toBe("synthesized");
  expect(config.hostReport.aliasSource).toBe("tsconfig");
  expect(config.vite).toBe(false);

  server = await startServer(config, { hmr: false });
  const executablePath = process.env.PW_CHROME;
  browser = await chromium.launch(executablePath ? { executablePath } : {});
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

describe("synthesized host (no vite)", () => {
  it("resolves @/ aliases and captures a scene", async () => {
    const scenes = await discoverScenes(server.server, config);
    const plan = buildPlan(config, scenes, "test", {});
    expect(plan.length).toBeGreaterThan(0);

    const item = plan[0]!;
    const { image } = await renderShot(browser, server.baseUrl, config, item);
    expect(image.length).toBeGreaterThan(500);
  }, 60_000);
});
