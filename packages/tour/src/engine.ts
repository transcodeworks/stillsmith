/**
 * The tour controller: the state machine that composes waiting, the
 * spotlight, the tooltip, focus, routing, and persistence.
 *
 * Design rules, all inherited from stillsmith:
 *   - Warn, never fail. A missing required target ends the tour with a
 *     console warning and *no* persisted state — so a target that was broken
 *     by yesterday's deploy tries again tomorrow, instead of being remembered
 *     as "dismissed" by a user who never saw it.
 *   - Everything takes an injectable root (document/window) — the authoring
 *     GUI runs the same engine against an iframe, tests against jsdom.
 *   - Async work is generation-guarded: a `next()` during a slow target wait
 *     abandons the stale step instead of racing it.
 *   - A tour's fixture is seeded once before the first step and undone once on
 *     the way out, whichever exit the tour takes.
 */
import {
  getTourFixture,
  toCleanup,
  type TourFixture,
  type TourFixtureCleanup,
  type TourFixtureContext,
} from "./fixtures.js";
import { FocusManager } from "./focus.js";
import { Spotlight } from "./overlay.js";
import { clearProgress, defaultStorage, readProgress, writeProgress } from "./storage.js";
import { Tooltip, type TooltipLabels } from "./tooltip.js";
import type { Tour, TourController, TourOptions, TourRoot } from "./types.js";
import { createHistoryRouter } from "./router.js";
import { waitForTarget } from "./wait.js";

const DEFAULT_WAIT_MS = 8000;

const DEFAULT_LABELS: TooltipLabels = { next: "Next", back: "Back", skip: "Skip", done: "Done" };

/** Two frames: one for style/layout, one for paint — the settle idiom used by
 * the capture pipeline, here so measurements land after scrolling. */
function settleFrames(win: Window): Promise<void> {
  const raf =
    win.requestAnimationFrame?.bind(win) ??
    ((cb: FrameRequestCallback) => win.setTimeout(() => cb(Date.now()), 16));
  return new Promise((resolve) => {
    raf(() => raf(() => resolve()));
    // A hidden page never produces a frame; don't hang the tour on one.
    win.setTimeout(resolve, 250);
  });
}

export function createTour(tour: Tour, options: TourOptions = {}): TourController {
  const root: TourRoot = options.root ?? { doc: document, win: window };
  const router = options.router ?? createHistoryRouter(root.win);
  const storage = options.storage === undefined ? defaultStorage(root.win) : options.storage;
  const storageKey = tour.storageKey ?? tour.id;
  const waitMs = options.waitTimeoutMs ?? DEFAULT_WAIT_MS;
  const labels: TooltipLabels = { ...DEFAULT_LABELS, ...tour.labels };

  let spotlight: Spotlight | null = null;
  let tooltip: Tooltip | null = null;
  let focus: FocusManager | null = null;

  let active = false;
  let index = 0;
  let generation = 0;
  let abort: AbortController | null = null;
  /** Per-step listener teardown (click-advance, route-advance). */
  let stepCleanup: (() => void) | null = null;
  /** Undoes the tour's fixture. Lives for the whole run, not per-step. */
  let fixtureCleanup: TourFixtureCleanup | null = null;

  /** Explicit handlers win over ambient registration. */
  function resolveFixture(name: string): TourFixture | undefined {
    return options.fixtures?.[name] ?? getTourFixture(name, root.win);
  }

  /** Fire-and-forget: `finish` has to persist synchronously, and a fixture that
   * fails to clean up is a warning, not an exception into the caller. */
  function runFixtureCleanup(cleanup: TourFixtureCleanup | null): void {
    if (!cleanup) return;
    void Promise.resolve()
      .then(cleanup)
      .catch((err: unknown) => {
        console.warn(`stillsmith-tour: fixture teardown failed: ${String(err)}`);
      });
  }

  function teardown(): void {
    generation += 1;
    abort?.abort();
    abort = null;
    stepCleanup?.();
    stepCleanup = null;
    focus?.deactivate();
    focus = null;
    tooltip?.destroy();
    tooltip = null;
    spotlight?.destroy();
    spotlight = null;
    // Null before invoking: every terminal path funnels through here, and a
    // second pass (destroy() after stop(), say) must not undo the seed twice.
    const cleanup = fixtureCleanup;
    fixtureCleanup = null;
    runFixtureCleanup(cleanup);
    active = false;
  }

  function finish(reason: "completed" | "dismissed"): void {
    if (!active) return;
    const at = index;
    teardown();
    writeProgress(storageKey, { status: reason, step: at }, storage);
    if (reason === "completed") options.onFinish?.();
    else options.onDismiss?.(at);
  }

  /** End without persisting — for broken targets, not user decisions. */
  function bail(warning: string): void {
    // eslint-style consoles are fine here: this is the runtime's only channel.
    console.warn(`stillsmith-tour: ${warning}`);
    teardown();
  }

  function ensureChrome(): void {
    spotlight ??= new Spotlight(root, tour.overlay);
    tooltip ??= new Tooltip(root);
    focus ??= new FocusManager(root);
  }

  async function showStep(i: number, animate: boolean): Promise<void> {
    const step = tour.steps[i];
    if (!step) return finish("completed");

    generation += 1;
    const gen = generation;
    abort?.abort();
    abort = new AbortController();
    stepCleanup?.();
    stepCleanup = null;

    index = i;
    writeProgress(storageKey, { status: "active", step: i }, storage);

    // Route first: the target can't exist until its page does.
    if (step.route && router.current() !== step.route) {
      router.navigate(step.route);
    }

    // Wait the target out (SPAs mount late), then scroll and settle before
    // measuring — a rect taken mid-scroll positions everything wrong.
    let anchor: Element | DOMRect | null = null;
    if (step.target) {
      const resolved = await waitForTarget(step.target, root.doc, {
        timeoutMs: waitMs,
        signal: abort.signal,
      });
      if (gen !== generation) return;
      if (!resolved) {
        if (step.optional) {
          if (i + 1 < tour.steps.length) return showStep(i + 1, animate);
          return finish("completed");
        }
        return bail(`step ${i + 1} target did not resolve within ${waitMs}ms — ending the tour`);
      }

      if (resolved.element) {
        (resolved.element as HTMLElement).scrollIntoView?.({ block: "nearest" });
        await settleFrames(root.win);
        if (gen !== generation) return;
        anchor = resolved.element;
      } else {
        anchor = resolved.rect;
      }
    }

    ensureChrome();
    const rect =
      anchor === null
        ? null
        : "getBoundingClientRect" in anchor
          ? (anchor as Element).getBoundingClientRect()
          : (anchor as DOMRect);
    spotlight?.moveTo(rect, {
      padding: step.padding ?? 4,
      radius: step.radius ?? 8,
      animate,
    });

    const advance = step.advance ?? { on: "next" as const };
    const el = tooltip?.show(step, {
      index: i,
      total: tour.steps.length,
      labels,
      anchor,
      interactive: advance.on !== "next",
      onNext: () => next(),
      onBack: () => back(),
      onSkip: () => finish("dismissed"),
      // The anchor moved (scroll, resize): keep the hole on it, un-animated.
      onReposition: (r) =>
        spotlight?.moveTo(r, {
          padding: step.padding ?? 4,
          radius: step.radius ?? 8,
          animate: false,
        }),
    });
    if (el) {
      focus?.activate(el, {
        onEsc: () => finish("dismissed"),
        // Arrow keys only where they can't fight a focused input.
        onNext: advance.on === "next" ? () => next() : undefined,
        onBack: i > 0 ? () => back() : undefined,
      });
    }

    if (advance.on === "click") {
      // Listen on the explicitly named target if given; otherwise reuse the
      // step's own already-resolved element.
      let listenOn: Element | null = null;
      if (advance.target) {
        const resolved = await waitForTarget(advance.target, root.doc, {
          timeoutMs: waitMs,
          signal: abort.signal,
        });
        if (gen !== generation) return;
        listenOn = resolved?.element ?? null;
      } else if (anchor && "getBoundingClientRect" in anchor) {
        listenOn = anchor as Element;
      }
      if (listenOn) {
        const onClick = () => next();
        listenOn.addEventListener("click", onClick, { once: true });
        stepCleanup = () => listenOn.removeEventListener("click", onClick);
      } else {
        console.warn(
          `stillsmith-tour: step ${i + 1} advance target did not resolve; falling back to Next`,
        );
      }
    } else if (advance.on === "route") {
      const path = advance.path;
      const unsubscribe = router.onRouteChange((p) => {
        if (p === path) next();
      });
      stepCleanup = unsubscribe;
    }

    options.onStepShow?.(i, step);
  }

  /**
   * Seed the tour's fixture, then show the first step.
   *
   * Setup runs before `showStep` writes any progress, so a tour that bails on a
   * broken fixture leaves storage untouched and tries again on the next visit —
   * the same "warn, never remember a tour the user never saw" rule a missing
   * required target follows.
   */
  async function begin(startAt: number): Promise<void> {
    if (!tour.fixture) {
      void showStep(startAt, false);
      return;
    }

    generation += 1;
    const gen = generation;
    const fixture = resolveFixture(tour.fixture);
    if (!fixture) {
      return bail(
        `fixture "${tour.fixture}" is not registered — ending the tour. Call registerTourFixtures({ "${tour.fixture}": … }) before starting it.`,
      );
    }

    const ctx: TourFixtureContext = { root, tourId: tour.id };
    let cleanup: TourFixtureCleanup | null = null;
    try {
      cleanup = toCleanup(await fixture.setup(ctx), fixture, ctx);
    } catch (err) {
      // A stale generation means someone already ended the tour; bailing again
      // would warn about a tour that is no longer running.
      if (gen === generation) bail(`fixture "${tour.fixture}" setup failed: ${String(err)}`);
      return;
    }

    // Torn down while seeding: the run is over, so undo the seed we just made
    // rather than leaving demo data behind.
    if (!active) {
      runFixtureCleanup(cleanup);
      return;
    }
    fixtureCleanup = cleanup;
    // A superseded generation means a goTo() landed mid-setup and is already
    // driving its own step; keep the fixture, drop the first-step call.
    if (gen !== generation) return;

    // Let the app render what we just seeded, so the first step doesn't flash
    // the empty page under the scrim before its target mounts.
    await settleFrames(root.win);
    if (gen !== generation) return;
    void showStep(startAt, false);
  }

  function next(): void {
    if (!active) return;
    if (index + 1 >= tour.steps.length) {
      finish("completed");
      return;
    }
    void showStep(index + 1, true);
  }

  function back(): void {
    if (!active || index === 0) return;
    void showStep(index - 1, true);
  }

  const controller: TourController = {
    start(at) {
      if (active) return;
      let startAt = at ?? 0;
      if (at === undefined) {
        const progress = readProgress(storageKey, storage);
        if (progress?.status === "completed" || progress?.status === "dismissed") return;
        if (progress?.status === "active") {
          startAt = Math.min(Math.max(progress.step, 0), tour.steps.length - 1);
        }
      } else {
        clearProgress(storageKey, storage);
      }
      active = true;
      void begin(startAt);
    },
    next,
    back,
    goTo(i) {
      if (!active) return;
      if (i < 0 || i >= tour.steps.length) return;
      void showStep(i, true);
    },
    stop(reason = "dismissed") {
      finish(reason);
    },
    destroy() {
      teardown();
    },
    get active() {
      return active;
    },
    get stepIndex() {
      return index;
    },
  };

  return controller;
}

/** `createTour` + `start()` in one call. */
export function startTour(tour: Tour, options?: TourOptions): TourController {
  const controller = createTour(tour, options);
  controller.start();
  return controller;
}
