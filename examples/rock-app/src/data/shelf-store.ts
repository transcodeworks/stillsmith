/**
 * The shelf's live collection.
 *
 * Pebble has no backend, but the shelf still needs state that something other
 * than React can reach: a tour fixture seeds specimens before the app has
 * mounted anything, so the list cannot live in a `useState` closure. This is
 * the smallest store that satisfies `useSyncExternalStore`.
 */
import { type Rock, ROCKS } from "./rocks";

let rocks: Rock[] = [...ROCKS];
const subscribers = new Set<() => void>();

function emit(): void {
  for (const cb of subscribers) cb();
}

export const shelfStore = {
  get(): Rock[] {
    return rocks;
  },
  subscribe(cb: () => void): () => void {
    subscribers.add(cb);
    return () => subscribers.delete(cb);
  },
  /** Idempotent by id — a resumed tour seeds the same specimens again. */
  add(more: Rock[]): void {
    const known = new Set(rocks.map((r) => r.id));
    const fresh = more.filter((r) => !known.has(r.id));
    if (fresh.length === 0) return;
    rocks = [...rocks, ...fresh];
    emit();
  },
  remove(ids: string[]): void {
    const drop = new Set(ids);
    const next = rocks.filter((r) => !drop.has(r.id));
    if (next.length === rocks.length) return;
    rocks = next;
    emit();
  },
};
