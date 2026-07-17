/**
 * The spotlight: dim the whole page except the target.
 *
 * One full-viewport SVG path with `fill-rule="evenodd"` — the outer subpath is
 * the viewport, the inner one a rounded rect around the target, and evenodd
 * leaves the intersection unfilled. SVG hit-testing honours the fill rule, so
 * with `pointer-events: fill` the scrim eats clicks while the hole passes them
 * through to the real control underneath — which is what makes
 * `advance: { on: "click" }` work without any hit-testing of our own.
 * (This is Driver.js's technique; it is the reference implementation here.)
 *
 * The cutout animates between steps with a short rAF tween: CSS transitions
 * on a path's `d` are unreliable across browsers, a hand-rolled lerp isn't.
 */
import type { Tour, TourRoot } from "./types.js";

const SVGNS = "http://www.w3.org/2000/svg";

/** One below annotate's overlay, so a capture of a running tour still wins. */
const Z_OVERLAY = "2147483645";

const ANIMATION_MS = 250;

export interface CutoutRect {
  x: number;
  y: number;
  w: number;
  h: number;
  radius: number;
}

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export class Spotlight {
  private readonly doc: Document;
  private readonly win: Window;
  private readonly container: HTMLElement;
  private readonly path: SVGPathElement;
  private current: CutoutRect | null = null;
  private raf = 0;
  private scrimClick?: () => void;

  constructor(root: TourRoot, overlay: Tour["overlay"]) {
    this.doc = root.doc;
    this.win = root.win;

    const container = this.doc.createElement("div");
    container.dataset.stillsmithTour = "overlay";
    Object.assign(container.style, {
      position: "fixed",
      inset: "0",
      pointerEvents: "none",
      zIndex: Z_OVERLAY,
    } as Partial<CSSStyleDeclaration>);

    const svg = this.doc.createElementNS(SVGNS, "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.style.display = "block";

    const path = this.doc.createElementNS(SVGNS, "path");
    path.setAttribute("fill-rule", "evenodd");
    path.setAttribute("fill", overlay?.color ?? "#000");
    path.setAttribute("fill-opacity", String(overlay?.opacity ?? 0.55));
    if (overlay?.dim === false) path.setAttribute("fill-opacity", "0");
    // The path (minus the hole) is the click surface, not the container.
    path.style.pointerEvents = "fill";
    path.addEventListener("click", () => this.scrimClick?.());

    svg.appendChild(path);
    container.appendChild(svg);
    this.doc.body.appendChild(container);
    this.container = container;
    this.path = path;

    this.win.addEventListener("resize", this.onResize);
  }

  private onResize = () => {
    if (this.current) this.path.setAttribute("d", this.pathFor(this.current));
  };

  onScrimClick(cb: () => void): void {
    this.scrimClick = cb;
  }

  private pathFor(cut: CutoutRect | null): string {
    const vw = this.win.innerWidth;
    const vh = this.win.innerHeight;
    const outer = `M0,0 H${vw} V${vh} H0 Z`;
    if (!cut) return outer;
    const r = Math.min(cut.radius, cut.w / 2, cut.h / 2);
    const { x, y, w, h } = cut;
    const hole =
      `M${x + r},${y} H${x + w - r} A${r},${r} 0 0 1 ${x + w},${y + r}` +
      ` V${y + h - r} A${r},${r} 0 0 1 ${x + w - r},${y + h}` +
      ` H${x + r} A${r},${r} 0 0 1 ${x},${y + h - r}` +
      ` V${y + r} A${r},${r} 0 0 1 ${x + r},${y} Z`;
    return `${outer} ${hole}`;
  }

  /**
   * Move the cutout to `rect` (grown by `padding`), animating from wherever it
   * is now. `null` closes the hole — a full scrim for centered steps.
   */
  moveTo(rect: DOMRect | null, opts: { padding: number; radius: number; animate: boolean }): void {
    const next: CutoutRect | null = rect
      ? {
          x: rect.left - opts.padding,
          y: rect.top - opts.padding,
          w: rect.width + opts.padding * 2,
          h: rect.height + opts.padding * 2,
          radius: opts.radius,
        }
      : null;

    this.win.cancelAnimationFrame?.(this.raf);

    const from = this.current;
    this.current = next;

    if (!opts.animate || !from || !next) {
      this.path.setAttribute("d", this.pathFor(next));
      return;
    }

    const raf =
      this.win.requestAnimationFrame?.bind(this.win) ??
      ((cb: FrameRequestCallback) => this.win.setTimeout(() => cb(Date.now()), 16));
    const started = Date.now();
    const tick = () => {
      const t = Math.min(1, (Date.now() - started) / ANIMATION_MS);
      const e = easeOutCubic(t);
      this.path.setAttribute(
        "d",
        this.pathFor({
          x: lerp(from.x, next.x, e),
          y: lerp(from.y, next.y, e),
          w: lerp(from.w, next.w, e),
          h: lerp(from.h, next.h, e),
          radius: lerp(from.radius, next.radius, e),
        }),
      );
      if (t < 1) this.raf = raf(tick) as number;
    };
    tick();
  }

  destroy(): void {
    this.win.cancelAnimationFrame?.(this.raf);
    this.win.removeEventListener("resize", this.onResize);
    this.container.remove();
  }
}
