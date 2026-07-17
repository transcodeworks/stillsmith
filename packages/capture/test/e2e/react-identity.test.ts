import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type Browser, chromium } from "playwright";
import { afterAll, beforeAll, expect, it } from "vitest";

import { loadConfig } from "../../src/core/config.js";
import { type StillsmithServer, startServer } from "../../src/core/server.js";
import type { ResolvedConfig } from "../../src/types.js";

/**
 * The page must load exactly one React.
 *
 * This lives in its own file, with its own server, for a reason that cost an
 * afternoon to learn: the bug only ever shows on the FIRST page load after a cold
 * start. Vite discovers a late dependency, re-optimizes, re-hashes every chunk —
 * and then caches the result for the rest of the server's life, so every
 * subsequent page is consistent and every subsequent test passes. Folded into the
 * shared-server suite, this guard would quietly depend on being the first test to
 * run, and would evaporate the day someone reordered them.
 *
 * So: cold cache, fresh server, and the very first thing loaded is the scene that
 * pulls in a late-discovered dependency (Headless UI).
 *
 * `fileParallelism` is off in vitest.config.ts so this file's server and cache
 * wipe cannot race the other e2e file's.
 */
const APP = fileURLToPath(new URL("../fixtures/app", import.meta.url));

let config: ResolvedConfig;
let server: StillsmithServer;
let browser: Browser;

beforeAll(async () => {
  await fs.rm(path.join(APP, "node_modules/.vite"), { recursive: true, force: true });
  config = await loadConfig(path.join(APP, "stillsmith.config.tsx"));
  // HMR off, exactly as capture runs it. With HMR on, Vite's reload-on-reoptimize
  // repairs the split React and there is nothing left to catch.
  server = await startServer(config, { hmr: false });
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

const sceneUrl = (scene: string) =>
  `${server.baseUrl}?file=${encodeURIComponent(
    path.join(APP, "src/scenes", `${scene}.scene.tsx`),
  )}&theme=light`;

it("renders a late-discovered library that calls hooks, on the first page load", async () => {
  const page = await browser.newPage();

  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  // Headless UI is the late discovery: nothing the dep scanner can reach imports
  // it except this scene, and it calls hooks the moment it renders. Split the
  // React instance and `useContext` throws "Invalid hook call" before a single
  // node reaches the DOM — so an empty error list and a rendered panel are the
  // assertion, and they are the symptom the consumer actually hit.
  await page.goto(sceneUrl("portal-dialog"), { waitUntil: "load" });
  await page.waitForSelector("html[data-stillsmith-ready]", { state: "attached", timeout: 15_000 });

  expect(errors).toEqual([]);
  expect(await page.locator("[data-shot='panel']").count()).toBe(1);

  await page.close();
});

it("renders a scene component that calls hooks", async () => {
  const page = await browser.newPage();

  await page.goto(sceneUrl("hooks"), { waitUntil: "load" });
  await page.waitForSelector("html[data-stillsmith-ready]", { state: "attached", timeout: 15_000 });

  // Reaching the effect's value proves a single React instance, a real commit,
  // and flushed effects — not merely that the module evaluated.
  expect(await page.textContent("[data-shot='status']")).toBe("effect ran");

  await page.close();
});
