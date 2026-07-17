/**
 * Render one tour step over the consumer's live app page — the MCP
 * `preview_step` tool's engine, and later the mechanism a CI selector check
 * would reuse.
 *
 * The injected bundle is resolved from the CONSUMER's install, not ours:
 * previews must run the @stillsmith/tour version the consumer actually ships,
 * and a project that hasn't installed it should hear that in plain words
 * rather than get a preview of a runtime it doesn't have.
 */
import fs from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import type { Page } from "playwright";

import type { Step, Tour } from "@stillsmith/tour";

const PAINT_BACKSTOP_MS = 250;

/** Cached per config root; the bytes don't change mid-session. */
const bundles = new Map<string, string>();

async function loadTourBundle(configRoot: string): Promise<string> {
  const cached = bundles.get(configRoot);
  if (cached !== undefined) return cached;

  let file: string;
  try {
    const require = createRequire(path.join(configRoot, "package.json"));
    file = require.resolve("@stillsmith/tour/global.js");
  } catch {
    throw new Error(
      "@stillsmith/tour is not installed in this project, so there is no tour runtime to preview.\n" +
        "Install it (`pnpm add @stillsmith/tour`) — it is the production package that runs tours.",
    );
  }
  const bundle = await fs.readFile(file, "utf8");
  bundles.set(configRoot, bundle);
  return bundle;
}

declare global {
  interface Window {
    __stillsmithTour?: {
      renderStepPreview: (
        step: Step,
        options?: { index?: number; total?: number; overlay?: Tour["overlay"] },
      ) => { warnings: string[]; dispose(): void };
    };
  }
}

/** Draw `step` statically on `page` (the same preview the GUI shows). */
export async function applyStepPreview(
  page: Page,
  configRoot: string,
  step: Step,
  options: { index: number; total: number; overlay?: Tour["overlay"] },
): Promise<string[]> {
  await page.addScriptTag({ content: await loadTourBundle(configRoot) });

  const warnings = await page.evaluate(
    ({ step, options }) => {
      const api = window.__stillsmithTour;
      if (!api) throw new Error("stillsmith: tour bundle did not initialise");
      return api.renderStepPreview(step, options).warnings;
    },
    { step, options },
  );

  // Same two-frames-plus-backstop settle as the annotation bridge: the
  // overlay is in the DOM, but the screenshot fires on the next line and
  // must not catch a half-composited frame.
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
