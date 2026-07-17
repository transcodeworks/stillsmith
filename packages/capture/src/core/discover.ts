import { glob } from "tinyglobby";
import type { ViteDevServer } from "vite";

import { type ResolvedShot, type SceneModule, readShots, sceneId } from "../scene-utils.js";
import { type ResolvedTour, type TourModule, readTours } from "../tour-utils.js";
import type { ResolvedConfig, Scene } from "../types.js";

export interface DiscoveredScene {
  /** Absolute path — also the key the runtime resolves `?file=` against. */
  file: string;
  id: string;
  scene: Scene;
  shots: ResolvedShot[];
}

export async function findSceneFiles(config: ResolvedConfig): Promise<string[]> {
  const files = await glob(config.scenes, {
    cwd: config.root,
    absolute: true,
    ignore: ["**/node_modules/**", "**/dist/**"],
  });
  return files.sort();
}

/**
 * Import every scene file to read its real exports.
 *
 * We evaluate rather than parse: `ssrLoadModule` runs the file through the
 * consumer's own Vite pipeline (aliases, TS, CSS), so `id`, `presets`, `tags`
 * and shot objects are the actual runtime values — no AST guesswork, and
 * computed values work. `render` is never called, so nothing has to survive in
 * Node beyond module evaluation.
 */
export async function discoverScenes(
  server: ViteDevServer,
  config: ResolvedConfig,
): Promise<DiscoveredScene[]> {
  const files = await findSceneFiles(config);
  const scenes: DiscoveredScene[] = [];

  for (const file of files) {
    let mod: SceneModule;
    try {
      mod = (await server.ssrLoadModule(file)) as SceneModule;
    } catch (err) {
      throw new Error(`Failed to load scene ${file}:\n${err instanceof Error ? err.message : err}`);
    }

    const scene = mod.default;
    if (!scene || typeof scene.render !== "function") {
      throw new Error(`${file}: a scene file must \`export default { id?, render }\``);
    }

    scenes.push({ file, id: sceneId(file, mod), scene, shots: readShots(mod) });
  }

  const seen = new Map<string, string>();
  for (const s of scenes) {
    const prev = seen.get(s.id);
    if (prev) throw new Error(`Duplicate scene id "${s.id}":\n  ${prev}\n  ${s.file}`);
    seen.set(s.id, s.file);
  }

  return scenes;
}

export interface DiscoveredTour extends ResolvedTour {
  /** Absolute path of the `.tour.ts` it lives in. */
  file: string;
}

export async function findTourFiles(config: ResolvedConfig): Promise<string[]> {
  if (!config.tours?.length) return [];
  const files = await glob(config.tours, {
    cwd: config.root,
    absolute: true,
    ignore: ["**/node_modules/**", "**/dist/**"],
  });
  return files.sort();
}

/**
 * Import every tour file to read its real exports — the same evaluate-don't-
 * parse strategy as scenes, and for the same reason: a tour's step bodies can
 * reference the app's route constants or i18n keys, and only the consumer's
 * Vite pipeline resolves those honestly.
 */
export async function discoverTours(
  server: ViteDevServer,
  config: ResolvedConfig,
): Promise<DiscoveredTour[]> {
  const files = await findTourFiles(config);
  const tours: DiscoveredTour[] = [];

  for (const file of files) {
    let mod: TourModule;
    try {
      mod = (await server.ssrLoadModule(file)) as TourModule;
    } catch (err) {
      throw new Error(`Failed to load tour ${file}:\n${err instanceof Error ? err.message : err}`);
    }
    for (const tour of readTours(mod)) tours.push({ ...tour, file });
  }

  const seen = new Map<string, string>();
  for (const t of tours) {
    const prev = seen.get(t.id);
    if (prev) throw new Error(`Duplicate tour id "${t.id}":\n  ${prev}\n  ${t.file}`);
    seen.set(t.id, t.file);
  }

  return tours;
}
