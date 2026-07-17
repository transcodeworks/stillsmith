/**
 * Tour types. A `Step` is a sibling of stillsmith's `Annotation`, not a sixth
 * kind of it: annotations are static draw specs a screenshot bakes in; steps
 * have lifecycle — they wait for their target, advance on events, and span
 * routes. What the two share is the targeting model (`Target`, `Offset`),
 * which is the whole point of the shared base.
 *
 * A `Step` is deliberately pure data: string body, no function hooks. That is
 * what lets the authoring GUI round-trip every field through stillsmith's
 * codemod, the same reasoning that keeps shots codemod-editable.
 */
import type { Offset, Target } from "@stillsmith/annotate";

/** Where the tooltip sits relative to the target. Floating UI semantics: the
 * side, optionally pinned to the start/end of that side. The engine flips and
 * shifts automatically when the preferred side has no room. */
export type Placement =
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "top-start"
  | "top-end"
  | "bottom-start"
  | "bottom-end"
  | "left-start"
  | "left-end"
  | "right-start"
  | "right-end";

/** What moves the tour past this step. Default: the Next button. */
export type Advance =
  /** The user clicks Next in the tooltip. */
  | { on: "next" }
  /** The user clicks `target` (defaults to the step's own target) — the
   * spotlight hole passes clicks through, so the real control still works. */
  | { on: "click"; target?: Target }
  /** The app navigates to `path` (however that happens). */
  | { on: "route"; path: string };

export interface Step {
  /** What the step points at. Omit for a centered, un-anchored step (a
   * welcome/finish card). Prefer `data-shot` selectors — same rule as
   * annotations, same suggestion engine in the editor. */
  target?: Target;
  title?: string;
  /** Plain text. Deliberately not rich content: a string round-trips through
   * the authoring codemod; a render function doesn't. */
  body: string;
  /** Default "bottom" (or centered when there is no target). */
  placement?: Placement;
  /** Fine-positioning nudge, applied after flip/shift — an explicit offset
   * always wins, same as annotations. */
  offset?: Offset;
  /** Default `{ on: "next" }`. */
  advance?: Advance;
  /** The route this step lives on. If the page isn't there, the engine
   * navigates (via the router adapter) and then waits for the target. */
  route?: string;
  /** Skip silently if the target never resolves within the wait budget.
   * Without this, a missing target ends the tour with a console warning. */
  optional?: boolean;
  /** Spotlight padding around the target, px. Default 4. */
  padding?: number;
  /** Spotlight corner radius, px. Default 8. */
  radius?: number;
}

export interface Tour {
  id: string;
  steps: Step[];
  /** Progress persistence key. Defaults to `id`. */
  storageKey?: string;
  overlay?: {
    /** Dim everything outside the target. Default true. */
    dim?: boolean;
    /** Scrim colour. Default black. */
    color?: string;
    /** Scrim opacity, 0–1. Default 0.55. */
    opacity?: number;
  };
  /** Button labels, for copy tweaks and i18n. */
  labels?: { next?: string; back?: string; skip?: string; done?: string };
}

/**
 * How the engine navigates and observes navigation. The default adapter
 * drives `history.pushState` and listens for URL changes — enough for most
 * SPAs — but a router with its own state store may not observe a bare
 * pushState, in which case pass an adapter wired to it.
 */
export interface RouterAdapter {
  navigate(path: string): void;
  /** Subscribe to route changes; returns an unsubscribe. */
  onRouteChange(cb: (path: string) => void): () => void;
  current(): string;
}

/** The frame to run in. Omit to use the ambient document/window. The
 * authoring GUI passes an iframe's frame here — same shape as annotate's
 * `DrawRoot`, on purpose. */
export interface TourRoot {
  doc: Document;
  win: Window;
}

/** The subset of `Storage` the engine uses. Pass `null` to disable
 * persistence entirely (previews, play-through). */
export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export interface TourOptions {
  router?: RouterAdapter;
  root?: TourRoot;
  /** Defaults to the root window's localStorage; `null` disables persistence. */
  storage?: StorageLike | null;
  /** How long a step waits for its target before giving up, ms. Default 8000. */
  waitTimeoutMs?: number;
  onStepShow?(index: number, step: Step): void;
  onFinish?(): void;
  onDismiss?(index: number): void;
}

export interface TourController {
  /** Begin (or resume) the tour. Resumes persisted progress unless `at` is
   * given; no-ops if the tour was already completed or dismissed. */
  start(at?: number): void;
  next(): void;
  back(): void;
  goTo(index: number): void;
  /** End the tour and persist why. Default reason: "dismissed". */
  stop(reason?: "completed" | "dismissed"): void;
  /** Tear everything down without recording progress. */
  destroy(): void;
  readonly active: boolean;
  readonly stepIndex: number;
}
