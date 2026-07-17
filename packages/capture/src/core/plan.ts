import path from "node:path";

import { fileStem } from "../scene-utils.js";
import type { ImageFormat, Preset, ResolvedConfig, Shot, Target } from "../types.js";
import type { DiscoveredScene } from "./discover.js";

export interface PlanItem {
  sceneId: string;
  sceneFile: string;
  shotName: string;
  shot: Shot;
  presetName: string;
  preset: Preset;
  /** Effective capture size — the shot's override, else the preset's. */
  viewport: { width: number; height: number };
  /** Absolute output path. */
  file: string;
  /** Effective encoding — the target's, else the config's. */
  format: ImageFormat;
  quality?: number;
}

export interface Filters {
  scenes?: string[];
  shots?: string[];
  presets?: string[];
  tags?: string[];
}

const intersects = (a: string[], b: string[]) => a.some((x) => b.includes(x));

export function resolveTarget(config: ResolvedConfig, name: string): Target {
  const target = config.targets[name];
  if (!target) {
    const known = Object.keys(config.targets).join(", ");
    throw new Error(`Unknown target "${name}". Available: ${known}`);
  }
  return target;
}

export function buildPlan(
  config: ResolvedConfig,
  scenes: DiscoveredScene[],
  targetName: string,
  filters: Filters = {},
): PlanItem[] {
  const target = resolveTarget(config, targetName);
  const outDir = path.resolve(config.root, target.outDir);
  const allPresets = Object.keys(config.presets);
  const format = target.format ?? config.format;
  const quality = target.quality ?? config.quality;
  const ext = format === "jpeg" ? "jpg" : format;

  const plan: PlanItem[] = [];

  for (const scene of scenes) {
    if (filters.scenes && !filters.scenes.includes(scene.id)) continue;

    for (const { name: shotName, shot, tags } of scene.shots) {
      if (filters.shots && !filters.shots.includes(shotName)) continue;

      // A target with `tags` only wants shots carrying one of them; a target
      // without `tags` takes everything.
      if (target.tags && !intersects(tags, target.tags)) continue;
      if (filters.tags && !intersects(tags, filters.tags)) continue;

      // Most specific wins: the shot's presets, else the scene's, else all.
      let presetNames = shot.presets ?? scene.scene.presets ?? allPresets;
      if (target.presets) presetNames = presetNames.filter((p) => target.presets?.includes(p));
      if (filters.presets) presetNames = presetNames.filter((p) => filters.presets?.includes(p));

      for (const presetName of presetNames) {
        const preset = config.presets[presetName];
        if (!preset) {
          throw new Error(
            `${scene.file}: shot "${shotName}" references unknown preset "${presetName}"`,
          );
        }

        const stem = fileStem(scene.id, shotName);
        plan.push({
          sceneId: scene.id,
          sceneFile: scene.file,
          shotName,
          shot,
          presetName,
          preset,
          viewport: shot.viewport ?? { width: preset.width, height: preset.height },
          file: target.flat
            ? path.join(outDir, `${stem}.${ext}`)
            : path.join(outDir, presetName, `${stem}.${ext}`),
          format,
          quality,
        });
      }
    }
  }

  // Two plan items resolving to the same file means the later capture silently
  // overwrites the earlier one: the run reports both as captured, only one
  // survives on disk, and the manifest lists the same path twice with
  // contradictory dimensions. Refuse the plan instead. The usual cause is
  // `flat: true` on a target that still captures multiple presets, but any
  // stem clash (scene "a-b" vs scene "a" shot "b") collides the same way.
  const byFile = new Map<string, PlanItem[]>();
  for (const item of plan) {
    const items = byFile.get(item.file) ?? [];
    items.push(item);
    byFile.set(item.file, items);
  }
  const collisions = [...byFile].filter(([, items]) => items.length > 1);
  if (collisions.length > 0) {
    const lines = collisions.map(
      ([file, items]) =>
        `  ${file}\n` +
        items.map((i) => `    [${i.presetName}] ${i.sceneId}/${i.shotName}`).join("\n"),
    );
    const fix = target.flat
      ? `Drop \`flat: true\` from target "${targetName}" to get per-preset subdirectories, or restrict its \`presets\` to a single preset.`
      : `Rename the colliding scenes or shots so their file stems differ.`;
    throw new Error(
      `Target "${targetName}": ${collisions.length} output path collision(s) — ` +
        `these screenshots would overwrite each other:\n${lines.join("\n")}\n${fix}`,
    );
  }

  return plan;
}

/**
 * Shots that no target picks up.
 *
 * A shot can fall through every target — its presets don't intersect the
 * target's, or it lacks the tag the target filters on — and then it simply never
 * gets captured, with nothing on screen to say so. That's a silent no-op on code
 * someone deliberately wrote, so name it. Only meaningful for an unfiltered run:
 * with `--scene`/`--shot`/`--preset`/`--tag`, exclusion is the whole point.
 */
export function findOrphanShots(scenes: DiscoveredScene[], plan: PlanItem[]): string[] {
  const planned = new Set(plan.map((i) => `${i.sceneId}/${i.shotName}`));
  const orphans: string[] = [];

  for (const scene of scenes) {
    for (const { name } of scene.shots) {
      const id = `${scene.id}/${name}`;
      if (!planned.has(id)) orphans.push(id);
    }
  }
  return orphans;
}

export function formatPlan(plan: PlanItem[], cwd = process.cwd()): string {
  if (plan.length === 0) return "Nothing to capture.";

  const lines = [`${plan.length} screenshot(s):`];
  for (const item of plan) {
    const dpr = item.preset.dpr ?? 1;
    const scheme = item.preset.colorScheme ?? "light";
    const override = item.shot.viewport ? " (shot override)" : "";
    lines.push(
      `  [${item.presetName}] ${item.sceneId}/${item.shotName}  ` +
        `${item.viewport.width}×${item.viewport.height}@${dpr}x ${scheme}${override}`,
      `     → ${path.relative(cwd, item.file)}`,
    );
  }
  return lines.join("\n");
}
