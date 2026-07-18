import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type Browser, chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loadConfig } from "../../src/core/config.js";
import { type StillsmithServer, startServer } from "../../src/core/server.js";
import type { ResolvedConfig } from "../../src/types.js";

/**
 * The authoring GUI's tour mode, end to end: switch modes, pick a target by
 * clicking the real app, edit a step, Save — then read the `.tour.ts` off
 * disk and check the codemod round-trip. This is the tours counterpart of
 * drag-offset.test.ts, and the proof of the §7 design call: the stage
 * iframes the consumer's own app (the middleware only claims /__stillsmith*),
 * so click-to-pick needs no extension and no scene.
 */
const APP = fileURLToPath(new URL("../fixtures/tour-app", import.meta.url));
const TOUR_FILE = path.join(APP, "src/tours/onboarding.tour.ts");

let config: ResolvedConfig;
let server: StillsmithServer;
let browser: Browser;
let originalSource: string;

beforeAll(async () => {
  originalSource = await readFile(TOUR_FILE, "utf8");
  config = await loadConfig(path.join(APP, "stillsmith.config.tsx"));
  server = await startServer(config, { hmr: false });
  const executablePath = process.env.PW_CHROME;
  browser = await chromium.launch(executablePath ? { executablePath } : {});
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
  // The Save button wrote into the fixture; put the original bytes back.
  await writeFile(TOUR_FILE, originalSource);
});

describe("authoring a tour against the running app", () => {
  it("mode-switches, click-picks a target, edits, saves, and the file round-trips", async () => {
    const root = server.baseUrl.replace(/\/__stillsmith\/$/, "");
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

    await page.goto(`${root}/__stillsmith/author`, { waitUntil: "load" });

    // The toggle only renders once state (with tours) has loaded.
    await page.getByRole("tab", { name: "tours" }).click({ timeout: 30_000 });

    // The tour and its steps are listed; the app frame shows the real page.
    await page.locator(".shot-list .list li", { hasText: "Search from here." }).click();
    const frame = page.frameLocator("iframe[title='app']");
    await frame.locator("[data-shot='search']").waitFor({ state: "attached", timeout: 60_000 });

    // The fields panel reflects the selected step.
    const targetField = page.locator(".fields fieldset:has(legend:has-text('target')) input");
    await expect.poll(() => targetField.first().inputValue()).toBe("[data-shot='search']");

    // The live preview draws the real tooltip into the app frame.
    await frame
      .locator("[data-stillsmith-tour='tooltip']")
      .waitFor({ state: "attached", timeout: 30_000 });

    // Click-to-pick: choose the Settings button in the app. It has no
    // data-shot hook, so the suggestion falls back to its text.
    await page
      .locator(".fields fieldset:has(legend:has-text('target')) button.pick")
      .first()
      .click();
    await frame.locator("text=Settings").click();
    await expect.poll(() => targetField.nth(1).inputValue()).toBe("Settings");

    // Edit the title, save, and confirm the server accepted it.
    const titleField = page.locator(".fields .row:has(span:text-is('title')) input");
    await titleField.fill("Find anything");
    await page.locator("button.save").click();
    await expect
      .poll(() => page.locator("button.save").textContent(), { timeout: 15_000 })
      .toBe("Saved");

    // The codemod wrote real TypeScript: the edited step landed, the
    // untouched header comment survived, the sibling steps are intact.
    const source = await readFile(TOUR_FILE, "utf8");
    expect(source).toContain('title: "Find anything"');
    expect(source).toContain('text: "Settings"');
    expect(source).toContain("satisfies Tour");
    expect(source).toContain("Each step pins one behaviour");
    expect(source).toContain("A centered welcome step.");
    expect(source).toContain("Click save to continue.");

    await page.close();
  }, 120_000);

  it("writes and removes a tour's fixture through the codemod", async () => {
    const api = `${server.baseUrl}api`;
    const state = (await (await fetch(`${api}/state`)).json()) as {
      tours: { file: string; exportName: string; id: string }[];
    };
    const tour = state.tours.find((t) => t.exportName === "Onboarding");
    if (!tour) throw new Error("fixture must expose the Onboarding tour");

    const put = (props: Record<string, unknown>) =>
      fetch(`${api}/tour`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: tour.file, exportName: tour.exportName, props }),
      });

    // Counted, not matched: the Seeded export in this same file declares a
    // fixture of its own, and only Onboarding's may come and go here.
    const fixtureCount = async () =>
      (await readFile(TOUR_FILE, "utf8")).match(/fixture:/g)?.length ?? 0;
    const before = await fixtureCount();

    expect((await put({ fixture: "demo" })).ok).toBe(true);
    expect(await fixtureCount()).toBe(before + 1);
    expect(await readFile(TOUR_FILE, "utf8")).toContain('fixture: "demo"');

    // `null` is how the editor says "remove this prop" — JSON has no undefined,
    // so a cleared field would otherwise never reach the codemod at all.
    expect((await put({ fixture: null })).ok).toBe(true);
    const source = await readFile(TOUR_FILE, "utf8");
    expect(await fixtureCount()).toBe(before);
    expect(source).not.toContain('fixture: "demo"');
    expect(source).toContain("satisfies Tour");
    expect(source).toContain("A centered welcome step.");
  }, 60_000);
});
