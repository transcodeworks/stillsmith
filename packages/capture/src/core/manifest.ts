import fs from "node:fs/promises";
import path from "node:path";

import type { PlanItem } from "./plan.js";

/**
 * A machine-readable index of what was written, dropped next to the images.
 *
 * Consumers (a docs site, a marketing page) can enumerate screenshots instead of
 * hardcoding filenames, and CI can assert that an expected image exists rather
 * than shipping a broken <img>.
 */
export interface ManifestImage {
  scene: string;
  shot: string;
  preset: string;
  /** Relative to the manifest. */
  path: string;
  /** Real pixel dimensions — viewport × dpr. */
  width: number;
  height: number;
  tags: string[];
}

export interface Manifest {
  images: ManifestImage[];
}

/** One manifest per output directory. Returns the directories written. */
export async function writeManifest(plan: PlanItem[]): Promise<string[]> {
  const byDir = new Map<string, ManifestImage[]>();

  for (const item of plan) {
    // The manifest sits at the root of the target's outDir, above any per-preset
    // subdirectory, so `path` may include that subdirectory.
    const dir = manifestDir(item);
    const dpr = item.preset.dpr ?? 1;

    const images = byDir.get(dir) ?? [];
    images.push({
      scene: item.sceneId,
      shot: item.shotName,
      preset: item.presetName,
      path: path.relative(dir, item.file),
      width: item.viewport.width * dpr,
      height: item.viewport.height * dpr,
      tags: item.shot.tags ?? [],
    });
    byDir.set(dir, images);
  }

  await Promise.all(
    [...byDir].map(async ([dir, images]) => {
      // Deliberately no timestamp: targets like `docs` write into a committed
      // directory, and a generatedAt would dirty the git diff on every capture
      // even when no pixel changed. Git already knows when the file changed.
      const manifest: Manifest = { images };
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(
        path.join(dir, "manifest.json"),
        `${JSON.stringify(manifest, null, 2)}\n`,
        "utf8",
      );
    }),
  );

  return [...byDir.keys()];
}

/**
 * A flat target writes `<outDir>/<stem>.<ext>`; a nested one writes
 * `<outDir>/<preset>/<stem>.<ext>`. Either way the manifest belongs in outDir.
 */
function manifestDir(item: PlanItem): string {
  const dir = path.dirname(item.file);
  return path.basename(dir) === item.presetName ? path.dirname(dir) : dir;
}
