/**
 * Tour fixtures: named handlers that seed the data a tour needs.
 *
 * A tour walks the real app, so a feature with nothing in it has nothing to
 * point at — a fresh account shows an empty shelf, and the step that spotlights
 * a specimen bails. A fixture fills that gap: the tour names one, the app
 * registers what the name means, and the engine seeds before the first step and
 * cleans up when the tour ends.
 *
 * The registry lives on `window`, not in module scope, and that is the whole
 * design. Three copies of this package can be in play at once — the app's own
 * import, the authoring GUI's bundled copy driving an iframe, and the fully
 * inlined `tour.global.js` the MCP preview injects into the page. Module state
 * is private to each; a window property is the one thing they share. Every
 * lookup therefore takes the window it should look in, because the GUI's copy
 * has to read the registry the app populated *inside the frame*.
 */
// biome-ignore-all lint/suspicious/noConfusingVoidType: a fixture's cleanup is optional, and `undefined` in place of `void` rejects the ordinary handler shape `setup: () => { seed() }`, whose inferred return type is `void`.
import type { TourRoot } from "./types.js";

export interface TourFixtureContext {
  /** The frame the tour runs in. Reach app state through this window, not the
   * ambient one — under the authoring GUI they are different windows. */
  root: TourRoot;
  tourId: string;
}

export type TourFixtureCleanup = () => void | Promise<void>;

export interface TourFixture {
  /**
   * Seed the data. May return a cleanup function, which takes precedence over
   * `teardown`.
   *
   * Must be idempotent: a tour the user abandoned mid-way resumes on their next
   * visit and seeds again, over state that may or may not still hold the first
   * seed. Add by id, don't append blindly.
   */
  setup(ctx: TourFixtureContext): void | TourFixtureCleanup | Promise<void | TourFixtureCleanup>;
  /** Used when `setup` did not return a cleanup. */
  teardown?(ctx: TourFixtureContext): void | Promise<void>;
}

export type TourFixtures = Record<string, TourFixture>;

const REGISTRY_KEY = "__stillsmithTourFixtures";

type FixtureWindow = Window & { [REGISTRY_KEY]?: TourFixtures };

/**
 * Register fixture handlers for tours running in `win`.
 *
 * Call it at app startup, before any tour starts — module scope is the safest
 * place, since a tour can start before React has mounted anything.
 */
export function registerTourFixtures(fixtures: TourFixtures, win: Window = window): void {
  const target = win as FixtureWindow;
  target[REGISTRY_KEY] = { ...target[REGISTRY_KEY], ...fixtures };
}

export function getTourFixture(name: string, win: Window): TourFixture | undefined {
  return (win as FixtureWindow)[REGISTRY_KEY]?.[name];
}

/**
 * Resolve `name` in `ctx.root.win`'s registry and run its setup.
 *
 * The seam the engine, the authoring stage, and the injected preview bundle all
 * go through. An unregistered name comes back as a warning rather than a throw:
 * callers decide whether that ends a tour or just annotates a preview.
 */
export async function applyTourFixture(
  name: string,
  ctx: TourFixtureContext,
): Promise<{ teardown: TourFixtureCleanup | null; warning?: string }> {
  const fixture = getTourFixture(name, ctx.root.win);
  if (!fixture) {
    return {
      teardown: null,
      warning: `fixture "${name}" is not registered — call registerTourFixtures({ "${name}": … }) before the tour starts`,
    };
  }
  return { teardown: toCleanup(await fixture.setup(ctx), fixture, ctx) };
}

/** A cleanup returned by `setup` wins; otherwise fall back to `teardown`. */
export function toCleanup(
  result: void | TourFixtureCleanup,
  fixture: TourFixture,
  ctx: TourFixtureContext,
): TourFixtureCleanup | null {
  if (typeof result === "function") return result;
  const { teardown } = fixture;
  return teardown ? () => teardown(ctx) : null;
}
