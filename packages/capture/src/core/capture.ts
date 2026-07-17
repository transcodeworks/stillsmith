import fs from "node:fs/promises";
import path from "node:path";
import { type Browser, chromium, type Page } from "playwright";

import type { ResolvedConfig } from "../types.js";
import { applyAnnotations } from "./annotate.js";
import { writeManifest } from "./manifest.js";
import type { PlanItem } from "./plan.js";

/** The runtime sets this once React has committed the scene. */
const READY_ATTR = "data-stillsmith-ready";

/** …and this instead, with the message, if the scene never got that far. */
const ERROR_ATTR = "data-stillsmith-error";

/** Either outcome ends the wait. Which one it was decides what we do next. */
const SETTLED_SELECTOR = `html[${READY_ATTR}], html[${ERROR_ATTR}]`;

const READY_TIMEOUT_MS = 15_000;

/**
 * Kills the sources of frame-to-frame nondeterminism that Playwright's own
 * `animations: "disabled"` doesn't cover: in-flight CSS transitions, a blinking
 * text caret, and smooth-scroll easing.
 */
const STABILIZE_CSS = `
  *, *::before, *::after {
    transition-duration: 0s !important;
    transition-delay: 0s !important;
  }
  * { caret-color: transparent !important; }
  html { scroll-behavior: auto !important; }
`;

function sceneUrl(baseUrl: string, item: PlanItem): string {
  const params = new URLSearchParams({
    // Discovery already resolved the exact module, so address it by file and
    // leave the runtime nothing to guess at.
    file: item.sceneFile,
    shot: item.shotName,
    theme: item.preset.colorScheme ?? "light",
  });
  return `${baseUrl}?${params}`;
}

const bullets = (lines: string[]) =>
  lines.map((l) => `\n    ${l.replace(/\n/g, "\n    ")}`).join("");

/**
 * Did anything of the scene reach the document?
 *
 * `#root` alone is not the question. A scene can render entirely into a portal —
 * an open Headless UI dialog goes straight onto `document.body` — and be
 * perfectly rendered with an empty root. So look for any element the page didn't
 * ship with.
 */
async function sceneRendered(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const root = document.getElementById("root");
    if ((root?.childElementCount ?? 0) > 0) return true;

    return [...document.body.children].some(
      (el) => el !== root && !["SCRIPT", "STYLE", "LINK"].includes(el.tagName),
    );
  });
}

/**
 * Block until the runtime says the scene is up — and if it never does, say
 * something true about why.
 *
 * The three outcomes are worth keeping apart. The runtime caught the failure and
 * left the message on the document: report that, it's the whole answer. It
 * signalled nothing and the document is empty: the scene module never imported
 * or never committed, and the errors we collected are the best lead. It
 * signalled nothing but the scene is plainly *there*: the scene is fine and the
 * readiness signal is broken — which is stillsmith's fault, and saying "the scene
 * threw" would send you hunting through code that works.
 */
async function waitForScene(page: Page, item: PlanItem, errors: string[]): Promise<void> {
  const seen = () => (errors.length ? `\n  page errors:${bullets(errors)}` : "");

  try {
    /**
     * `state: "attached"` is the entire point, not a default worth taking.
     *
     * Playwright's default is `"visible"`, and it decides that by measuring the
     * bounding box — of `<html>`, here, which is not a thing anyone means to
     * measure. A scene whose whole render is a portal leaves `#root` empty and
     * the dialog `position: fixed`, so nothing is in normal flow, `<html>`
     * collapses to zero height, and Playwright calls it invisible. It then waits
     * out the full timeout on an attribute that has been sitting in the DOM the
     * whole time. We are testing for the presence of a flag; presence is all we
     * should ask about.
     */
    await page.waitForSelector(SETTLED_SELECTOR, {
      state: "attached",
      timeout: READY_TIMEOUT_MS,
    });
  } catch {
    const rendered = await sceneRendered(page).catch(() => false);
    const secs = READY_TIMEOUT_MS / 1000;

    throw new Error(
      rendered
        ? `Scene "${item.sceneId}" rendered but never signalled ready (${secs}s). ` +
            `The scene is fine — stillsmith's readiness signal is not. Please report this.${seen()}`
        : `Scene "${item.sceneId}" never rendered (${secs}s). ` +
            `Its module failed to import, or its render never committed.${seen()}`,
    );
  }

  const failure = await page.getAttribute("html", ERROR_ATTR);
  if (failure) {
    throw new Error(`Scene "${item.sceneId}" failed to load.${bullets([failure])}`);
  }
}

/**
 * Wait for every `<img>` on the page to finish loading and decoding.
 *
 * Readiness cannot cover this. It fires once React commits and the paint
 * settles, and at that moment an `<img>` is an element with a `src` nobody has
 * fetched yet — so a scene with images is ready long before it is finished. The
 * failure that follows is quiet: the shot photographs whatever sits behind the
 * image, and a placeholder gradient or a background colour reads as a perfectly
 * good screenshot. Nothing looks broken; the pixels are just wrong, sometimes.
 *
 * `complete` goes true for a 404 as readily as for a hit, which is deliberate
 * here: we wait for images to *settle*, not to *succeed*. A broken `src` is the
 * scene's bug to show, not ours to hang on, and a shot of a broken image is a
 * true photograph of a broken scene.
 *
 * `decode()` closes the gap `complete` leaves: bytes in hand is not pixels on
 * screen, and a large JPEG can still be decoding when the screenshot lands. It
 * rejects for the images that never loaded, which by the same reasoning is not
 * ours to raise.
 */
async function waitForImages(page: import("playwright").Page): Promise<void> {
  await page
    .waitForFunction(() => [...document.images].every((img) => img.complete), null, {
      timeout: READY_TIMEOUT_MS,
    })
    .catch(() => {});

  await page
    .evaluate(() => Promise.all([...document.images].map((img) => img.decode().catch(() => {}))))
    .catch(() => {});
}

/**
 * Open a scene, settle it, and hand the live page to `use`.
 *
 * Every consumer goes through here — capture, the MCP `preview` tool, the MCP
 * `inspect_scene` tool — so an agent's preview is rendered by exactly the same
 * code path as the image that ships, down to the stabilisation.
 */
export async function withScenePage<T>(
  browser: Browser,
  baseUrl: string,
  config: ResolvedConfig,
  item: PlanItem,
  use: (page: import("playwright").Page) => Promise<T>,
): Promise<T> {
  const context = await browser.newContext({
    viewport: item.viewport,
    deviceScaleFactor: item.preset.dpr ?? 1,
    colorScheme: item.preset.colorScheme ?? "light",
  });

  try {
    const page = await context.newPage();

    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));
    // An unhandled rejection is not a `pageerror` — Chromium only logs it. That
    // is the shape a failed dynamic import takes, so without this the most
    // common way for a scene to die leaves no trace.
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto(sceneUrl(baseUrl, item), { waitUntil: "load" });
    await waitForScene(page, item, errors);

    if (config.stabilize.animations === "disable") {
      await page.addStyleTag({ content: STABILIZE_CSS });
    }
    if (config.stabilize.fonts) {
      // Fonts change metrics; measuring or shooting before they land produces
      // a screenshot of the fallback face.
      await page.evaluate(() => document.fonts?.ready).catch(() => {});
    }
    if (config.stabilize.images) {
      await waitForImages(page);
    }

    const delay = config.stabilize.delay + (item.shot.delay ?? 0);
    if (delay > 0) await page.waitForTimeout(delay);

    return await use(page);
  } finally {
    await context.close();
  }
}

/**
 * Open the consumer's real app at `route` and hand the live page to `use` —
 * the tours counterpart of `withScenePage`. There is no readiness attribute
 * to wait for (a real app doesn't announce itself), so this settles on
 * `networkidle` plus fonts, and callers whose targets mount late lean on the
 * tour engine's own waiting.
 */
export async function withAppPage<T>(
  browser: Browser,
  baseUrl: string,
  config: ResolvedConfig,
  opts: { route: string; preset: import("../types.js").Preset },
  use: (page: Page) => Promise<T>,
): Promise<T> {
  // Prefer an explicit appUrl (tours against any running server) over the
  // origin derived from stillsmith's own Vite server.
  const origin = (config.appUrl ?? baseUrl.replace(/\/__stillsmith\/$/, "")).replace(/\/$/, "");
  const route = opts.route.startsWith("/") ? opts.route : `/${opts.route}`;
  const context = await browser.newContext({
    viewport: { width: opts.preset.width, height: opts.preset.height },
    deviceScaleFactor: opts.preset.dpr ?? 1,
    colorScheme: opts.preset.colorScheme ?? "light",
  });

  try {
    const page = await context.newPage();
    await page.goto(origin + route, { waitUntil: "networkidle" });

    if (config.stabilize.animations === "disable") {
      await page.addStyleTag({ content: STABILIZE_CSS });
    }
    if (config.stabilize.fonts) {
      await page.evaluate(() => document.fonts?.ready).catch(() => {});
    }

    return await use(page);
  } finally {
    await context.close();
  }
}

export interface ShotRender {
  image: Buffer;
  /** Annotation targets that didn't resolve. The image was still produced. */
  warnings: string[];
}

/**
 * The browser's screenshotter speaks png and jpeg only, so webp is a
 * post-encode: shoot lossless png, hand it to sharp. sharp stays an optional
 * peer dependency — only projects that ask for webp need the native module.
 *
 * No quality means lossless webp: pixel-identical to the png, just smaller.
 * A quality opts into lossy.
 */
async function toWebp(png: Buffer, quality: number | undefined): Promise<Buffer> {
  let sharp: typeof import("sharp")["default"];
  try {
    ({ default: sharp } = await import("sharp"));
  } catch {
    throw new Error(
      'format "webp" needs sharp, an optional peer dependency.\nInstall it: pnpm add -D sharp',
    );
  }
  return sharp(png)
    .webp(quality === undefined ? { lossless: true } : { quality })
    .toBuffer();
}

/** Render one shot to an encoded image buffer, annotations and all. */
export async function renderShot(
  browser: Browser,
  baseUrl: string,
  config: ResolvedConfig,
  item: PlanItem,
): Promise<ShotRender> {
  return withScenePage(browser, baseUrl, config, item, async (page) => {
    // Drawn last, over a settled page: annotations are positioned by measuring
    // the real DOM, so anything that still moves would misplace them.
    const warnings = await applyAnnotations(page, item.shot.annotations ?? []);

    const shot = await page.screenshot({
      fullPage: item.shot.fullPage ?? false,
      animations: config.stabilize.animations === "disable" ? "disabled" : "allow",
      // webp shoots png and re-encodes; Playwright rejects `quality` on png.
      type: item.format === "jpeg" ? "jpeg" : "png",
      ...(item.format === "jpeg" ? { quality: item.quality ?? 90 } : {}),
    });

    const image = item.format === "webp" ? await toWebp(shot, item.quality) : shot;
    return { image, warnings };
  });
}

async function captureOne(
  browser: Browser,
  baseUrl: string,
  config: ResolvedConfig,
  item: PlanItem,
): Promise<string[]> {
  const { image, warnings } = await renderShot(browser, baseUrl, config, item);
  await fs.mkdir(path.dirname(item.file), { recursive: true });
  await fs.writeFile(item.file, image);
  return warnings;
}

export interface CaptureResult {
  captured: number;
  outDirs: string[];
  /** Unresolved annotation targets. The images were still written. */
  warnings: number;
}

/**
 * Where progress goes.
 *
 * Injectable because the MCP server speaks JSON-RPC over **stdout** — anything
 * capture prints there corrupts the protocol. The CLI passes a stdout logger;
 * the MCP server passes one that writes to stderr.
 */
export interface Logger {
  info(line: string): void;
  warn(line: string): void;
}

export const consoleLogger: Logger = {
  info: (line) => console.log(line),
  warn: (line) => console.warn(line),
};

export async function capture(
  config: ResolvedConfig,
  plan: PlanItem[],
  baseUrl: string,
  { clean = false, log = consoleLogger }: { clean?: boolean; log?: Logger } = {},
): Promise<CaptureResult> {
  if (clean) {
    await Promise.all(plan.map((item) => fs.rm(item.file, { force: true })));
  }

  const browser = await chromium.launch();
  let captured = 0;
  let warnings = 0;

  try {
    for (const item of plan) {
      const shotWarnings = await captureOne(browser, baseUrl, config, item);
      log.info(
        `  [${item.presetName}] ${item.sceneId}/${item.shotName} … ` +
          path.relative(process.cwd(), item.file),
      );
      for (const w of shotWarnings) {
        log.warn(`      ⚠ annotation: ${w}`);
        warnings++;
      }
      captured++;
    }
  } finally {
    await browser.close();
  }

  const outDirs = await writeManifest(plan);
  return { captured, outDirs, warnings };
}
