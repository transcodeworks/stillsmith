import type { Tour } from "@stillsmith/tour";
import type { SceneDTO, StateDTO, TourDTO } from "../vite/api.js";
import type { Shot } from "../types.js";

const BASE = "/__stillsmith/api";

async function unwrap(res: Response): Promise<unknown> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((body as { error?: string }).error ?? `${res.status} ${res.statusText}`);
  }
  return body;
}

export async function fetchState(): Promise<StateDTO> {
  return (await unwrap(await fetch(`${BASE}/state`))) as StateDTO;
}

/** The shot fields the GUI owns. Anything else in the literal is left alone. */
export type EditableShot = Pick<
  Shot,
  "annotations" | "viewport" | "tags" | "presets" | "delay" | "fullPage"
>;

/** `props` is the delta — only the fields that changed. Anything omitted is left
 * untouched in the source file. */
export async function saveShot(
  file: string,
  exportName: string,
  props: Partial<EditableShot>,
): Promise<void> {
  await unwrap(
    await fetch(`${BASE}/shot`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file, exportName, props }),
    }),
  );
}

export async function createShot(file: string, exportName: string): Promise<void> {
  await unwrap(
    await fetch(`${BASE}/shot/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file, exportName }),
    }),
  );
}

export async function deleteShot(file: string, exportName: string): Promise<void> {
  await unwrap(
    await fetch(`${BASE}/shot`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file, exportName }),
    }),
  );
}

/** The tour fields the GUI owns. Tour-level metadata (id, storageKey, theme)
 * is code the author writes once; the editor's job is the steps — plus
 * `fixture`, which is here because you cannot target seeded elements in the
 * stage without saying which fixture seeds them. */
export type EditableTour = Pick<Tour, "steps" | "fixture">;

export async function saveTour(
  file: string,
  exportName: string,
  props: Partial<EditableTour>,
): Promise<void> {
  await unwrap(
    await fetch(`${BASE}/tour`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file, exportName, props }),
    }),
  );
}

export async function createTour(file: string, exportName: string): Promise<void> {
  await unwrap(
    await fetch(`${BASE}/tour/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file, exportName }),
    }),
  );
}

export async function deleteTour(file: string, exportName: string): Promise<void> {
  await unwrap(
    await fetch(`${BASE}/tour`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file, exportName }),
    }),
  );
}

export type { SceneDTO, StateDTO, TourDTO };
