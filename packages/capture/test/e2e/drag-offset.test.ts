import path from "node:path";
import { fileURLToPath } from "node:url";
import { type Browser, chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { loadConfig } from "../../src/core/config.js";
import { type StillsmithServer, startServer } from "../../src/core/server.js";
import type { ResolvedConfig } from "../../src/types.js";

/**
 * Dragging an annotation on the authoring stage to author its `offset`.
 *
 * This is the whole promise of the drag: what you nudge in the browser is a
 * plain `offset: { dx, dy }` on the annotation, the same value a hand-typed
 * shot would carry. Only a real browser can prove it — the drag rides on the
 * iframe's own coordinate space (the parent's `scale()` transform is undone by
 * the browser as it maps the cursor into the frame), the overlay is rebuilt on
 * every tick, and both are seams a unit test can't reach.
 */
const APP = fileURLToPath(new URL("../fixtures/app", import.meta.url));

let config: ResolvedConfig;
let server: StillsmithServer;
let browser: Browser;

beforeAll(async () => {
  config = await loadConfig(path.join(APP, "stillsmith.config.tsx"));
  server = await startServer(config, { hmr: false });
  // PW_CHROME lets a sandbox with a mismatched Playwright browser point at an
  // installed Chromium; CI uses Playwright's own, exactly like the sibling suites.
  const executablePath = process.env.PW_CHROME;
  browser = await chromium.launch(executablePath ? { executablePath } : {});
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

describe("dragging an annotation writes its offset", () => {
  it("nudges an outline box and, once switched, an arrow head", async () => {
    const root = server.baseUrl.replace(/\/__stillsmith\/$/, "");
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

    // The overlay is torn down and rebuilt on every redraw (and StrictMode
    // double-invokes the effect), so a lone boundingBox() can land on an
    // in-between frame. Poll until the element reports a real box.
    const stableBox = async (loc: ReturnType<typeof page.locator>) => {
      for (let i = 0; i < 30; i++) {
        const b = await loc.boundingBox();
        if (b && b.width > 0 && b.height > 0) return b;
        await page.waitForTimeout(100);
      }
      throw new Error("element never reported a stable box");
    };

    await page.goto(`${root}/__stillsmith/author`, { waitUntil: "load" });

    // Pick the portal-dialog scene from the header.
    await page.waitForSelector("header select", { timeout: 30_000 });
    await page.locator("header select").first().selectOption("portal-dialog");

    // Wait for the scene itself to mount before switching shots. On a cold Vite
    // start the frame can take seconds to become ready; drawing before then is a
    // no-op, and only a subsequent annotation change re-triggers it. Landing on
    // a ready frame first makes the draw after the shot switch deterministic.
    const frame = page.frameLocator("iframe[title='scene']");
    await frame.locator("[data-shot='panel']").waitFor({ state: "attached", timeout: 60_000 });

    // Select the annotated shot from the shot rail (an outline box).
    await page.locator(".shot-list .list li", { hasText: "Annotated" }).click();
    const box = frame.locator("[data-stillsmith-ann='0']");
    const before = await stableBox(box);

    // Select the annotation so the offset fields are present to read. (A drag
    // also selects it, but reading before the first successful drag needs the
    // panel up front.) Click the kind label, well clear of the row's × button.
    await page.locator(".annotations .list li .k").first().click();
    const dxField = page.locator(".fields fieldset:has(legend:text-is('offset')) input").first();
    const dyField = page.locator(".fields fieldset:has(legend:text-is('offset')) input").nth(1);
    const readNum = async (loc: ReturnType<typeof page.locator>) => {
      const v = await loc.inputValue();
      return v === "" ? null : Number(v);
    };

    // Repeat the grab-and-move gesture until it registers. A miss (a mousedown
    // that lands on the overlay mid-rebuild) changes nothing, so retrying is
    // safe; the first hit satisfies the predicate and ends the loop before a
    // second would compound the offset.
    const dragUntil = async (
      grab: () => Promise<{ x: number; y: number }>,
      deltaX: number,
      deltaY: number,
      satisfied: () => Promise<boolean>,
    ) => {
      for (let attempt = 0; attempt < 12; attempt++) {
        if (await satisfied()) return;
        const g = await grab();
        await page.mouse.move(g.x, g.y);
        await page.mouse.down();
        await page.mouse.move(g.x + deltaX, g.y + deltaY, { steps: 8 });
        await page.mouse.up();
        await page.waitForTimeout(150);
      }
      if (!(await satisfied())) throw new Error("drag never registered");
    };

    // Drag the box by a known delta. The viewport fits at scale 1, so the pixel
    // delta maps ~1:1 into the offset.
    const boxCentre = async () => {
      const b = await stableBox(box);
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    };
    await dragUntil(boxCentre, 60, 40, async () => {
      const dx = await readNum(dxField);
      return dx != null && dx > 45 && dx < 75;
    });

    expect(Number(await dxField.inputValue())).toBeGreaterThan(45);
    expect(Number(await dxField.inputValue())).toBeLessThan(75);
    expect(Number(await dyField.inputValue())).toBeGreaterThan(28);
    expect(Number(await dyField.inputValue())).toBeLessThan(52);

    // The drawn box actually moved on screen by roughly the same delta.
    const after = await stableBox(box);
    expect(after.x - before.x).toBeGreaterThan(45);
    expect(after.y - before.y).toBeGreaterThan(28);

    // The request called out arrows by name: switch the kind (the target becomes
    // the arrow's `to`), which draws an SVG path tagged the same way. Clear the
    // offset first so the default geometry is a vertical line above the panel.
    await page.locator(".fields select").first().selectOption("arrow");
    await dxField.fill("");
    await dyField.fill("");
    await frame
      .locator("path[data-stillsmith-ann='0']")
      .waitFor({ state: "attached", timeout: 30_000 });

    // The default tail sits 64px above the panel's top-centre; grab the segment
    // just above the panel and drag it up and to the left.
    const onArrow = async () => {
      const pb = await stableBox(frame.locator("[data-shot='panel']"));
      return { x: pb.x + pb.width / 2, y: pb.y - 30 };
    };
    await dragUntil(onArrow, -25, -15, async () => {
      const dx = await readNum(dxField);
      const dy = await readNum(dyField);
      return dx != null && dy != null && dx < -15 && dy < -8;
    });

    expect(Number(await dxField.inputValue())).toBeLessThan(-15);
    expect(Number(await dyField.inputValue())).toBeLessThan(-8);

    await page.close();
  }, 90_000);
});
