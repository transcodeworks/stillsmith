import { createRequire } from "node:module";
import fs from "node:fs/promises";
import type { Page } from "playwright";

import type { Annotation } from "@stillsmith/annotate";

/** How long to wait for the compositing frames below before giving up on them. */
const PAINT_BACKSTOP_MS = 250;

/** Read once per process; it's the same bytes for every shot. */
let bundle: string | null = null;
async function loadBundle(): Promise<string> {
  if (bundle !== null) return bundle;
  try {
    // The IIFE ships with @stillsmith/annotate; resolve it like any dependency
    // rather than hardcoding a path into someone else's dist layout.
    const require = createRequire(import.meta.url);
    bundle = await fs.readFile(require.resolve("@stillsmith/annotate/global.js"), "utf8");
  } catch {
    throw new Error(
      "stillsmith could not load @stillsmith/annotate's browser bundle (annotate.global.js).\n" +
        "If you're working on stillsmith itself, run `pnpm build` first.",
    );
  }
  return bundle;
}

declare global {
  interface Window {
    __stillsmithAnnotate?: {
      drawAnnotations: (annotations: Annotation[]) => string[];
    };
  }
}

/**
 * Draw `annotations` over the page, just before the screenshot.
 *
 * Returns warnings for targets that didn't resolve. A stale selector degrades to
 * a missing annotation plus a warning — it never fails the capture.
 *
 * The engine goes in as a prebuilt classic script. show-control's version passed
 * the drawing function to `page.evaluate`, which serialises only the function
 * body: every helper had to be nested inside it, and esbuild's `keepNames` wrap
 * meant the page also needed a fake `globalThis.__name` before it would run.
 * Injecting a real bundle removes both problems.
 */
export async function applyAnnotations(page: Page, annotations: Annotation[]): Promise<string[]> {
  if (annotations.length === 0) return [];

  // Fonts change text metrics, and every annotation is positioned by measuring
  // the DOM — measure before they land and the boxes sit in the wrong place.
  await page.evaluate(() => document.fonts?.ready).catch(() => {});

  await page.addScriptTag({ content: await loadBundle() });

  const warnings = await page.evaluate((anns: Annotation[]) => {
    const api = window.__stillsmithAnnotate;
    if (!api) throw new Error("stillsmith: annotation bundle did not initialise");
    return api.drawAnnotations(anns);
  }, annotations);

  // The overlay is appended synchronously, but the browser has not necessarily
  // laid it out and painted it by the time `drawAnnotations` returns — and the
  // screenshot fires on the very next line. Give it two frames to composite:
  // one for style/layout, one for the paint. Without this the shutter can catch
  // a partially-composited overlay, which shows up as an intermittent pixel diff
  // on annotated shots only.
  //
  // The timer is not decoration. A page that produces no frame never runs a rAF
  // callback, and `page.evaluate` has no timeout of its own — so waiting on the
  // frames alone hangs capture outright, with no error, forever.
  await page.evaluate(
    (backstopMs) =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        setTimeout(resolve, backstopMs);
      }),
    PAINT_BACKSTOP_MS,
  );

  return warnings;
}
