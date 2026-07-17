import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type Browser, chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { type Logger, capture, renderShot, withScenePage } from "../../src/core/capture.js";
import { loadConfig } from "../../src/core/config.js";
import { type DiscoveredScene, discoverScenes } from "../../src/core/discover.js";
import { buildPlan, type PlanItem } from "../../src/core/plan.js";
import { type StillsmithServer, startServer } from "../../src/core/server.js";
import type { ResolvedConfig } from "../../src/types.js";

/**
 * The capture path, end to end, against a real Vite server and a real Chromium.
 *
 * Every bug this suite exists for lived in a seam — Playwright's idea of
 * "visible", Vite's dep-optimizer hashing, a `page.evaluate` awaiting a frame
 * that never comes. None of them are reachable from a unit test; all of them are
 * caught by opening the page and looking.
 *
 * HMR is off here because that is how capture runs: a page that reloads under the
 * shutter is worse than a slow one. It also happens to be the condition several
 * of these bugs need to be visible at all — see react-identity.test.ts, which
 * owns the guard that depends on a cold dependency cache.
 */
const APP = fileURLToPath(new URL("../fixtures/app", import.meta.url));

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
const silent: Logger = { info: () => {}, warn: () => {} };

let config: ResolvedConfig;
let server: StillsmithServer;
let scenes: DiscoveredScene[];
let browser: Browser;

beforeAll(async () => {
  // A warm dep cache means Vite has already pre-bundled everything and never
  // re-optimizes mid-load — which is precisely the failure being tested. Start cold.
  await fs.rm(path.join(APP, "node_modules/.vite"), { recursive: true, force: true });

  config = await loadConfig(path.join(APP, "stillsmith.config.tsx"));
  server = await startServer(config, { hmr: false });
  scenes = await discoverScenes(server.server, config);
  browser = await chromium.launch();
});

afterAll(async () => {
  await browser?.close();
  await server?.close();
});

/** The single plan item for one scene's shot. */
function item(sceneId: string, shotName = "default"): PlanItem {
  const plan = buildPlan(config, scenes, "test", { scenes: [sceneId], shots: [shotName] });
  const only = plan[0];
  if (!only || plan.length !== 1) {
    throw new Error(`expected exactly one shot for ${sceneId}/${shotName}, got ${plan.length}`);
  }
  return only;
}

const render = (sceneId: string, shot?: string) =>
  renderShot(browser, server.baseUrl, config, item(sceneId, shot));

describe("a scene that renders only into a portal", () => {
  it("is recognised as ready, and is genuinely portal-only", async () => {
    const seen = await withScenePage(
      browser,
      server.baseUrl,
      config,
      item("portal-dialog"),
      (page) =>
        page.evaluate(() => ({
          ready: document.documentElement.hasAttribute("data-stillsmith-ready"),
          rootChildren: document.getElementById("root")?.childElementCount ?? -1,
          dialog: document.querySelector("[data-shot='panel']") !== null,
          htmlHeight: document.documentElement.getBoundingClientRect().height,
        })),
    );

    // Getting here at all is the regression: `withScenePage` waits for readiness,
    // and it used to wait out the full timeout and throw on exactly this scene.
    expect(seen.ready).toBe(true);
    expect(seen.dialog).toBe(true);

    // The premises the bug rested on. If either of these stops holding, the scene
    // has drifted into rendering something in normal flow and no longer covers
    // the thing it was written for.
    expect(seen.rootChildren).toBe(0);
    expect(seen.htmlHeight).toBe(0);
  });

  it("captures an image with the dialog in it", async () => {
    const { image: shot, warnings } = await render("portal-dialog");

    // The fixture config sets no format, so this also pins the jpeg default.
    expect(shot.subarray(0, 3)).toEqual(JPEG_MAGIC);
    expect(warnings).toEqual([]);

    // Not blank: the same viewport rendering nothing compresses far smaller than
    // one with a dialog in it. Cheap oracle, no image decoder.
    const { image: blank } = await render("empty");
    expect(shot.byteLength).toBeGreaterThan(blank.byteLength);
  });

  it("captures with annotations, rather than hanging", async () => {
    // The annotation settle awaits two frames inside `page.evaluate`, which has no
    // timeout of its own. Without the backstop this does not fail — it hangs, and
    // the suite dies on its timeout instead.
    const { image: shot, warnings } = await render("portal-dialog", "annotated");

    expect(shot.subarray(0, 3)).toEqual(JPEG_MAGIC);
    expect(warnings).toEqual([]);
  });
});

describe("a scene whose image answers slowly", () => {
  /** What the page can say about its own images, at the moment the shot lands. */
  const imageState = (cfg: ResolvedConfig) =>
    withScenePage(browser, server.baseUrl, cfg, item("slow-image"), (page) =>
      page.evaluate(() =>
        [...document.images].map((img) => ({
          complete: img.complete,
          width: img.naturalWidth,
        })),
      ),
    );

  it("waits for the image to load and decode", async () => {
    const images = await imageState(config);

    expect(images).toHaveLength(1);
    // `complete` alone would go true for a 404 as well, so the width is what
    // says the bytes actually arrived.
    expect(images[0]).toEqual({ complete: true, width: 1 });
  });

  it("does not, with the gate off", async () => {
    // The negative control. Without it this suite cannot tell a working gate
    // from an image that was simply fast enough — which is every image, on
    // localhost, which is why this bug survived until a scene had one.
    const ungated: ResolvedConfig = {
      ...config,
      stabilize: { ...config.stabilize, images: false },
    };

    const images = await imageState(ungated);

    expect(images[0]?.complete).toBe(false);
  });
});

describe("a scene that renders nothing", () => {
  it("still becomes ready", async () => {
    // No content means no reason for the compositor to produce a frame, and
    // readiness must not be waiting on one.
    const { image: shot } = await render("empty");
    expect(shot.subarray(0, 3)).toEqual(JPEG_MAGIC);
  });
});

describe("a scene that throws in the browser", () => {
  it("reports the scene's own error instead of timing out", async () => {
    const failure = await render("browser-throw").catch((err: Error) => err);

    expect(failure).toBeInstanceOf(Error);
    const message = (failure as Error).message;

    // The whole point: the thrown message, not a bare "never became ready".
    expect(message).toContain("scene exploded on import");
    expect(message).toContain("browser-throw");
    expect(message).not.toContain("never rendered");
  });
});

describe("capture", () => {
  it("writes the planned files to disk", async () => {
    const plan = buildPlan(config, scenes, "test", {
      scenes: ["portal-dialog", "hooks"],
      shots: ["default"],
    });
    await Promise.all(plan.map((i) => fs.rm(i.file, { force: true })));

    const result = await capture(config, plan, server.baseUrl, { log: silent });

    expect(result.captured).toBe(plan.length);
    expect(result.warnings).toBe(0);

    for (const i of plan) {
      expect(i.file.endsWith(".jpg")).toBe(true);
      const bytes = await fs.readFile(i.file);
      expect(bytes.subarray(0, 3)).toEqual(JPEG_MAGIC);
    }
  });
});

describe("output formats", () => {
  /** The fixture config with its `test` target switched to another encoding. */
  const withFormat = (format: "png" | "webp", quality?: number): ResolvedConfig => ({
    ...config,
    targets: { test: { outDir: "output", format, quality } },
  });

  const renderAs = (cfg: ResolvedConfig) => {
    const plan = buildPlan(cfg, scenes, "test", { scenes: ["portal-dialog"], shots: ["default"] });
    const only = plan[0];
    if (!only || plan.length !== 1) throw new Error("expected exactly one shot");
    return { item: only, shot: renderShot(browser, server.baseUrl, cfg, only) };
  };

  it("still writes png on request", async () => {
    const { item, shot } = renderAs(withFormat("png"));
    expect(item.file.endsWith(".png")).toBe(true);
    expect((await shot).image.subarray(0, 8)).toEqual(PNG_MAGIC);
  });

  it("post-encodes webp through sharp", async () => {
    const { item, shot } = renderAs(withFormat("webp"));
    expect(item.file.endsWith(".webp")).toBe(true);

    const { image } = await shot;
    expect(image.subarray(0, 4)).toEqual(Buffer.from("RIFF"));
    expect(image.subarray(8, 12)).toEqual(Buffer.from("WEBP"));

    // No quality means lossless — a VP8L stream. A quality opts into lossy
    // VP8. The chunk tag is the discriminator; size isn't (a flat fixture
    // this small can compress better lossless than lossy).
    expect(image.subarray(12, 16)).toEqual(Buffer.from("VP8L"));
    const { image: lossy } = await renderAs(withFormat("webp", 60)).shot;
    expect(lossy.subarray(12, 16)).toEqual(Buffer.from("VP8 "));
  });
});
