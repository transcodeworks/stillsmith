import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type Browser, chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { withAppPage } from "../../src/core/capture.js";
import { loadConfig } from "../../src/core/config.js";
import type { ResolvedConfig } from "../../src/types.js";

/**
 * H0: `appUrl` opens tours against any running server, independent of stillsmith's Vite.
 */
const APP = fileURLToPath(new URL("../fixtures/tour-app", import.meta.url));

let config: ResolvedConfig;
let browser: Browser;
let external: http.Server;
let appUrl: string;

beforeAll(async () => {
  config = await loadConfig(path.join(APP, "stillsmith.config.tsx"));

  external = http.createServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<!doctype html><html><body><button data-shot="go">Go</button></body></html>`);
  });
  await new Promise<void>((resolve) => {
    external.listen(0, "127.0.0.1", () => resolve());
  });
  const addr = external.address();
  if (!addr || typeof addr === "string") throw new Error("expected TCP address");
  appUrl = `http://127.0.0.1:${addr.port}`;
  config = { ...config, appUrl };

  const executablePath = process.env.PW_CHROME;
  browser = await chromium.launch(executablePath ? { executablePath } : {});
}, 60_000);

afterAll(async () => {
  await browser?.close();
  await new Promise<void>((resolve, reject) => {
    external.close((err) => (err ? reject(err) : resolve()));
  });
});

describe("appUrl", () => {
  it("withAppPage navigates to the external origin", async () => {
    const preset = config.presets.test;
    if (!preset) throw new Error("fixture must define a test preset");

    const text = await withAppPage(
      browser,
      "http://127.0.0.1:9/__stillsmith/", // deliberately wrong — appUrl must win
      config,
      { route: "/", preset },
      async (page) => {
        expect(page.url().startsWith(appUrl)).toBe(true);
        return page.locator("[data-shot='go']").innerText();
      },
    );
    expect(text).toBe("Go");
  }, 30_000);
});
