/**
 * Annotation types. Kept free of DOM and Node imports so they can be shared by
 * the capture driver (Node), the drawing engine (browser), and consumers' scene
 * files (type-only).
 */

/** How to locate the element an annotation points at. Tried in order:
 * selector → text → rect. `nth` disambiguates multiple selector matches. */
export interface Target {
  /** CSS selector, e.g. `[data-shot='save-button']`. */
  selector?: string;
  /** Match the element whose trimmed text content contains this string. */
  text?: string;
  /** 0-based index when `selector` matches several elements. */
  nth?: number;
  /** Raw viewport coordinates (CSS pixels) as a last-resort escape hatch — it
   * will not survive a change of preset. Prefer a `data-shot` attribute. */
  rect?: { x: number; y: number; w: number; h: number };
}

/** A point on a resolved element's box. */
export type Anchor =
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "center"
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

/** Viewport-fraction point (0–1). Adapts across presets — preferred for arrow tails. */
export interface PointFraction {
  vx: number;
  vy: number;
}
/** Absolute viewport point in CSS pixels. */
export interface PointAbsolute {
  x: number;
  y: number;
}
/** A point anchored to another element, with an optional pixel offset. */
export interface PointRelative {
  target: Target;
  anchor?: Anchor;
  dx?: number;
  dy?: number;
}
export type Point = PointFraction | PointAbsolute | PointRelative;

/**
 * Nudge an annotation away from where the layout engine put it.
 *
 * CSS pixels; `dx` positive is right, `dy` positive is down. Every annotation
 * kind accepts one, and it is applied *last* — after placement, and after the
 * keep-it-on-screen clamp — so an explicit offset always lands exactly where you
 * asked, even if that means hanging off the edge. It is a deliberate authoring
 * override, so it wins over the automatic behaviour.
 *
 * What each kind moves:
 *   outline, highlight → the box
 *   callout            → the box (its leader line follows)
 *   label              → the pin
 *   arrow              → the arrowhead end (the tail stays put)
 */
export interface Offset {
  dx?: number;
  dy?: number;
}

interface AnnotationBase {
  /** Named palette colour ("accent" | "danger" | "success" | "warning" | "info")
   * or any raw CSS colour. Defaults to "accent". */
  color?: string;
  /** Fine-positioning nudge. See {@link Offset}. */
  offset?: Offset;
}

interface BoxBase extends AnnotationBase {
  target: Target;
  /** Extra pixels grown around the target rect before drawing. Default 4. */
  padding?: number;
  /** Corner radius in px. Default 8. */
  radius?: number;
}

export interface OutlineAnnotation extends BoxBase {
  kind: "outline";
  /** Border thickness in px. Default 3. */
  width?: number;
  /** Dashed instead of solid. Default false. */
  dashed?: boolean;
}

export interface HighlightAnnotation extends BoxBase {
  kind: "highlight";
  /** Fill opacity over the target, 0–1. Default 0.18. */
  fillOpacity?: number;
  /** Darken everything *outside* the target (spotlight). Default false. */
  dim?: boolean;
  /** Scrim opacity when `dim` is set, 0–1. Default 0.55. */
  dimOpacity?: number;
}

export interface ArrowAnnotation extends AnnotationBase {
  kind: "arrow";
  /** Element the arrowhead points at. */
  to: Target;
  /** Tail of the arrow. Defaults to a point just above the target. */
  from?: Point;
  /** Line thickness in px. Default 3. */
  width?: number;
  /** Arrowhead size in px. Default 14. */
  headSize?: number;
  /** Draw a curved line instead of straight. Default false. */
  curve?: boolean;
  /** Gap in px between the arrowhead and the target edge. Default 6. */
  gap?: number;
}

export interface CalloutAnnotation extends AnnotationBase {
  kind: "callout";
  /** Element the callout describes. */
  target: Target;
  text: string;
  /** Optional badge shown before the text (e.g. a step number). */
  badge?: string | number;
  /** Which side of the target the box sits on. Default "auto". */
  placement?: "top" | "bottom" | "left" | "right" | "auto";
  /** Max text width in px before wrapping. Default 240. */
  maxWidth?: number;
  /** Gap in px between the box and the target. Default 16. */
  gap?: number;
  /** Corner radius in px. Default 8. */
  radius?: number;
}

export interface LabelAnnotation extends AnnotationBase {
  kind: "label";
  /** Element the pin sits on. */
  target: Target;
  /** Text inside the pin (typically a number or letter). */
  badge: string | number;
  /** Which point of the element to place the pin on. Default "top-left". */
  anchor?: Anchor;
}

export type Annotation =
  | OutlineAnnotation
  | HighlightAnnotation
  | ArrowAnnotation
  | CalloutAnnotation
  | LabelAnnotation;

/** The frame to draw into. Omit to use the ambient document/window. The
 * authoring GUI passes an iframe's frame here for live preview. */
export interface DrawRoot {
  doc: Document;
  win: Window;
}

/** A `Target` derived from a clicked element, with a hint at how robust it is. */
export interface TargetSuggestion {
  target: Target;
  /** stable = selector unique + preset-independent; ok = usable but worth a
   * data-shot hook; brittle = absolute rect that won't survive a preset change. */
  quality: "stable" | "ok" | "brittle";
  /** Human-readable caveat, shown in the authoring UI. */
  note?: string;
  /** The element the target actually resolves to. Not serialisable. */
  element?: Element;
}
