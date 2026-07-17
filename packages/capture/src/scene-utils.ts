/**
 * Naming and shape rules shared by the Node side (discovery) and the browser
 * side (the scene runtime). Deliberately free of both React and Node imports so
 * either environment can import it without dragging in the other's deps.
 */
import type { Scene, Shot } from "./types.js";

export interface SceneModule {
  default: Scene;
  [exportName: string]: unknown;
}

export interface ResolvedShot {
  /** The named export it came from — what the M3 codemod edits. */
  exportName: string;
  /** Filename stem contribution. */
  name: string;
  shot: Shot;
  tags: string[];
}

export function sceneIdFromFile(file: string): string {
  const base = file.split(/[\\/]/).pop() ?? file;
  return base.replace(/\.scene\.[jt]sx?$/, "");
}

export function shotNameFromExport(exportName: string): string {
  return exportName
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1-$2")
    .toLowerCase();
}

export function sceneId(file: string, mod: SceneModule): string {
  return mod.default?.id ?? sceneIdFromFile(file);
}

/**
 * Every named export whose value is a plain object is a shot. Anything else in
 * the file (helpers, fixtures, re-exported components) is ignored, so scene
 * files can hold whatever else they need.
 */
export function readShots(mod: SceneModule): ResolvedShot[] {
  const sceneTags = mod.default?.tags ?? [];
  const shots: ResolvedShot[] = [];

  for (const [exportName, value] of Object.entries(mod)) {
    if (exportName === "default") continue;
    if (value === null || typeof value !== "object" || Array.isArray(value)) continue;

    const shot = value as Shot;
    shots.push({
      exportName,
      name: shot.name ?? shotNameFromExport(exportName),
      shot,
      tags: [...sceneTags, ...(shot.tags ?? [])],
    });
  }
  return shots;
}

/**
 * The filename stem for a shot. A shot named `default` contributes nothing, so
 * the single-shot common case yields `workspace.jpg` rather than
 * `workspace-default.jpg`.
 */
export function fileStem(sceneId: string, shotName: string): string {
  return shotName === "default" ? sceneId : `${sceneId}-${shotName}`;
}
