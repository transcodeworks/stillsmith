import path from "node:path";
import { fileURLToPath } from "node:url";
import { type Browser, chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loadConfig } from "../../src/core/config.js";
import { type StillsmithServer, startServer } from "../../src/core/server.js";
import type { ResolvedConfig } from "../../src/types.js";

/**
 * The @stillsmith/tour runtime, in a real browser. The jsdom suite over in
 * packages/tour proves the state machine; everything here is what jsdom
 * can't reach — geometry (the spotlight cutout, flip at the viewport edge),
 * real clicks through the SVG hole, persistence across a genuine reload,
 * and focus.
 *
 * It lives in stillsmith's suite, not tour's, because the Playwright/Vite
 * harness is stillsmith's — the tour package must depend on neither.
 */
const APP = fileURLToPath(new URL("../fixtures/tour-app", import.meta.url));

let config: ResolvedConfig;
let server: StillsmithServer;
let browser: Browser;
let root: string;

beforeAll(async () => {
  config = await loadConfig(path.join(APP, "stillsmith.config.tsx"));
  server = await startServer(config, { hmr: false });
  root = server.baseUrl.replace(/\/__stillsmith\/$/, "");
  const executablePath = process.env.PW_CHROME;
  browser = await chromium.launch(executablePath ? { executablePath } : {});
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

/** Fresh storage per test: tours persist progress, tests must not share it. */
async function newPage() {
  const context = await browser.newContext({ viewport: { width: 900, height: 600 } });
  const page = await context.newPage();
  return { page, context };
}

const tooltip = "[data-stillsmith-tour='tooltip']";
const body = "[data-stillsmith-tour='body']";

describe("tour runtime in a real browser", () => {
  it("walks the whole tour: welcome, anchored step, click-advance, route + async mount", async () => {
    const { page, context } = await newPage();
    await page.goto(`${root}/?tour`, { waitUntil: "load" });

    // Step 1: centered welcome over a full scrim.
    await page.waitForSelector(tooltip, { timeout: 30_000 });
    await expect.poll(() => page.locator(body).textContent()).toBe("A centered welcome step.");

    // Step 2: anchored to the search input, spotlight hole around it.
    await page.locator("[data-stillsmith-tour='next']").click();
    await expect.poll(() => page.locator(body).textContent()).toBe("Search from here.");

    const target = await page.locator("[data-shot='search']").boundingBox();
    const d = await page.locator("[data-stillsmith-tour='overlay'] path").getAttribute("d");
    expect(target).not.toBeNull();
    expect(d).not.toBeNull();
    // The path is `M0,0 H<w> V<h> H0 Z M<hole-x + r>,<hole-y> …` — the hole's
    // y is the second M's second coordinate: target top minus 4px padding.
    const hole = /Z M[\d.-]+,([\d.-]+) /.exec(d ?? "");
    expect(hole).not.toBeNull();
    expect(Number(hole?.[1])).toBeCloseTo((target?.y ?? 0) - 4, 0);

    // The click goes THROUGH the hole: focus the real input by clicking it.
    await page.locator("[data-shot='search']").click();
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.getAttribute("data-shot")))
      .toBe("search");

    // Step 3: pinned to the bottom edge with placement "bottom" — must flip
    // above the target. Advances by clicking the button itself, not Next.
    await page.locator("[data-stillsmith-tour='next']").click();
    await expect.poll(() => page.locator(body).textContent()).toBe("Click save to continue.");
    const save = await page.locator("[data-shot='save']").boundingBox();
    const tip = await page.locator(tooltip).boundingBox();
    expect((tip?.y ?? 0) + (tip?.height ?? 0)).toBeLessThan(save?.y ?? 0);

    await page.locator("[data-shot='save']").click();

    // Step 4: the engine navigates to /settings and outwaits the 600ms mount.
    await expect.poll(() => page.evaluate(() => window.location.pathname)).toBe("/settings");
    await expect
      .poll(() => page.locator(body).textContent(), { timeout: 15_000 })
      .toBe("The theme panel mounts late.");

    // Done: tour chrome comes down, completion is persisted.
    await page.locator("[data-stillsmith-tour='next']").click();
    await expect.poll(() => page.locator(tooltip).count()).toBe(0);
    await expect.poll(() => page.locator("[data-stillsmith-tour='overlay']").count()).toBe(0);
    const stored = await page.evaluate(() =>
      window.localStorage.getItem("stillsmith-tour:fixture-onboarding"),
    );
    expect(JSON.parse(stored ?? "{}")).toMatchObject({ status: "completed" });

    await context.close();
  }, 90_000);

  it("focus lands in the card, Esc dismisses, and a real reload stays quiet", async () => {
    const { page, context } = await newPage();
    await page.goto(`${root}/?tour`, { waitUntil: "load" });
    await page.waitForSelector(tooltip, { timeout: 30_000 });

    // Focus is inside the dialog.
    const focusedInCard = await page.evaluate(() => {
      const active = document.activeElement;
      return Boolean(active?.closest("[data-stillsmith-tour='tooltip']"));
    });
    expect(focusedInCard).toBe(true);

    await page.keyboard.press("Escape");
    await expect.poll(() => page.locator(tooltip).count()).toBe(0);

    // The dismissal survives an actual navigation cycle.
    await page.reload({ waitUntil: "load" });
    await page.waitForTimeout(500);
    expect(await page.locator(tooltip).count()).toBe(0);
    const stored = await page.evaluate(() =>
      window.localStorage.getItem("stillsmith-tour:fixture-onboarding"),
    );
    expect(JSON.parse(stored ?? "{}")).toMatchObject({ status: "dismissed" });

    await context.close();
  }, 60_000);

  it("resumes an interrupted tour at the persisted step after a reload", async () => {
    const { page, context } = await newPage();
    await page.goto(`${root}/?tour`, { waitUntil: "load" });
    await page.waitForSelector(tooltip, { timeout: 30_000 });
    await page.locator("[data-stillsmith-tour='next']").click();
    await expect.poll(() => page.locator(body).textContent()).toBe("Search from here.");

    // Leave mid-tour (no dismissal), come back: step 2 again, not the welcome.
    await page.reload({ waitUntil: "load" });
    await page.waitForSelector(tooltip, { timeout: 30_000 });
    await expect.poll(() => page.locator(body).textContent()).toBe("Search from here.");

    await context.close();
  }, 60_000);

  const specimen = "[data-shot='specimen-obsidian']";

  it("seeds the tour's fixture before the first step and clears it at the end", async () => {
    const { page, context } = await newPage();
    await page.goto(`${root}/?tour=seeded`, { waitUntil: "load" });

    // The app renders no specimens on its own; the first step can only anchor
    // because the fixture put one there.
    await page.waitForSelector(tooltip, { timeout: 30_000 });
    expect(await page.locator(specimen).count()).toBe(1);
    await expect
      .poll(() => page.locator(body).textContent())
      .toBe("This specimen exists only for the tour.");

    await page.locator("[data-stillsmith-tour='next']").click();
    await expect.poll(() => page.locator(body).textContent()).toBe("And now it goes away.");
    await page.locator("[data-stillsmith-tour='next']").click();

    // Completing the tour takes the demo data back out with it.
    await expect.poll(() => page.locator(tooltip).count()).toBe(0);
    await expect.poll(() => page.locator(specimen).count()).toBe(0);
    const stored = await page.evaluate(() =>
      window.localStorage.getItem("stillsmith-tour:fixture-seeded"),
    );
    expect(JSON.parse(stored ?? "{}")).toMatchObject({ status: "completed" });

    await context.close();
  }, 60_000);

  it("clears seeded data when the tour is dismissed", async () => {
    const { page, context } = await newPage();
    await page.goto(`${root}/?tour=seeded`, { waitUntil: "load" });
    await page.waitForSelector(tooltip, { timeout: 30_000 });
    expect(await page.locator(specimen).count()).toBe(1);

    await page.keyboard.press("Escape");
    await expect.poll(() => page.locator(tooltip).count()).toBe(0);
    await expect.poll(() => page.locator(specimen).count()).toBe(0);

    await context.close();
  }, 60_000);

  it("seeds again when a tour resumes after a reload", async () => {
    const { page, context } = await newPage();
    await page.goto(`${root}/?tour=seeded`, { waitUntil: "load" });
    await page.waitForSelector(tooltip, { timeout: 30_000 });

    // A reload wipes the app's in-memory state; resuming has to re-seed, or
    // the step it resumes onto has nothing to anchor to.
    await page.reload({ waitUntil: "load" });
    await page.waitForSelector(tooltip, { timeout: 30_000 });
    await expect.poll(() => page.locator(specimen).count()).toBe(1);
    await expect
      .poll(() => page.locator(body).textContent())
      .toBe("This specimen exists only for the tour.");

    await context.close();
  }, 60_000);
});
