/**
 * Progress persistence: "don't show again" and resume-where-you-left-off.
 * localStorage by default, injectable for tests and disabled (`storage: null`)
 * for previews — a play-through in the authoring GUI must never mark the
 * consumer's real tour as completed.
 */
import type { StorageLike } from "./types.js";

const PREFIX = "stillsmith-tour:";

export type TourStatus = "active" | "completed" | "dismissed";

export interface TourProgress {
  status: TourStatus;
  step: number;
  /** ISO timestamp of the last write. Informational. */
  at: string;
}

/** The root window's localStorage, or null where it throws (sandboxed iframes,
 * storage-disabled browsers). A tour without persistence still runs. */
export function defaultStorage(win: Window): StorageLike | null {
  try {
    const s = win.localStorage;
    // Some browsers hand back the object and throw on use.
    const probe = `${PREFIX}__probe__`;
    s.setItem(probe, "1");
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export function readProgress(key: string, storage: StorageLike | null): TourProgress | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const p = parsed as Partial<TourProgress>;
    if (p.status !== "active" && p.status !== "completed" && p.status !== "dismissed") return null;
    if (typeof p.step !== "number" || !Number.isFinite(p.step)) return null;
    return { status: p.status, step: p.step, at: typeof p.at === "string" ? p.at : "" };
  } catch {
    // Corrupt JSON or a throwing storage reads as "no progress".
    return null;
  }
}

export function writeProgress(
  key: string,
  progress: Omit<TourProgress, "at">,
  storage: StorageLike | null,
): void {
  if (!storage) return;
  try {
    const value: TourProgress = { ...progress, at: new Date().toISOString() };
    storage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Quota or privacy mode: persistence degrades, the tour keeps running.
  }
}

export function clearProgress(key: string, storage: StorageLike | null): void {
  if (!storage) return;
  try {
    storage.removeItem(PREFIX + key);
  } catch {
    // Same policy as writes.
  }
}
