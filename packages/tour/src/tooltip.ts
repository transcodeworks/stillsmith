/**
 * The step card: title, body, progress, Back/Skip/Next. Plain DOM with inline
 * styles — the same idiom as annotate's drawer, and for the same reason: it
 * must render identically inside any app without a stylesheet to collide with.
 *
 * Positioning is Floating UI (`computePosition` + offset/flip/shift/arrow +
 * `autoUpdate`): flipping when the preferred side has no room is the entire
 * hard part of an interactive tooltip, and it is not worth re-inventing.
 * The step's `offset` is applied after all of it, unclamped — an explicit
 * author nudge always wins, same rule as annotations.
 */
import {
  arrow,
  autoUpdate,
  computePosition,
  flip,
  offset as offsetMiddleware,
  shift,
} from "@floating-ui/dom";
import type { Offset } from "@stillsmith/annotate";
import type { Placement, Step, TourRoot } from "./types.js";

/** Between the scrim and annotate's overlay. */
const Z_TOOLTIP = "2147483646";

const ACCENT = "#3b82f6";
const GAP = 12;

export interface TooltipLabels {
  next: string;
  back: string;
  skip: string;
  done: string;
}

export interface TooltipContext {
  index: number;
  total: number;
  labels: TooltipLabels;
  /** The element (or rect) to anchor to; null renders a centered card. */
  anchor: Element | DOMRect | null;
  /** Hide the Next button when the step advances by interaction instead. */
  interactive: boolean;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  /** Fires whenever the anchor element moves (scroll, resize, layout). */
  onReposition?: (rect: DOMRect) => void;
}

export class Tooltip {
  private readonly doc: Document;
  private readonly win: Window;
  private el: HTMLElement | null = null;
  private cleanup: (() => void) | null = null;

  constructor(root: TourRoot) {
    this.doc = root.doc;
    this.win = root.win;
  }

  /** Render the card for `step`. Returns the container, for the focus trap. */
  show(step: Step, ctx: TooltipContext): HTMLElement {
    this.hide();

    const el = this.build(step, ctx);
    this.doc.body.appendChild(el);
    this.el = el;

    if (ctx.anchor === null) {
      Object.assign(el.style, {
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
      } as Partial<CSSStyleDeclaration>);
      return el;
    }

    // Duck-typed rather than instanceof: elements may come from an iframe's
    // realm (the authoring GUI), where `instanceof Element` lies.
    const anchor = ctx.anchor;
    const isElement = "getBoundingClientRect" in anchor;
    const reference = isElement
      ? (anchor as Element)
      : { getBoundingClientRect: () => anchor as DOMRect };

    const arrowEl = this.doc.createElement("div");
    Object.assign(arrowEl.style, {
      position: "absolute",
      width: "10px",
      height: "10px",
      background: "#fff",
      transform: "rotate(45deg)",
    } as Partial<CSSStyleDeclaration>);
    el.appendChild(arrowEl);

    const position = async () => {
      const placement: Placement = step.placement ?? "bottom";
      const {
        x,
        y,
        placement: placed,
        middlewareData,
      } = await computePosition(reference, el, {
        placement,
        strategy: "fixed",
        middleware: [
          offsetMiddleware(GAP),
          flip(),
          shift({ padding: 8 }),
          arrow({ element: arrowEl, padding: 12 }),
        ],
      });

      const nudge: Offset = step.offset ?? {};
      el.style.left = `${x + (nudge.dx ?? 0)}px`;
      el.style.top = `${y + (nudge.dy ?? 0)}px`;

      const a = middlewareData.arrow;
      const side = placed.split("-")[0] as "top" | "bottom" | "left" | "right";
      const across = { top: "bottom", bottom: "top", left: "right", right: "left" }[side];
      Object.assign(arrowEl.style, { left: "", top: "", right: "", bottom: "" });
      if (a?.x != null) arrowEl.style.left = `${a.x}px`;
      if (a?.y != null) arrowEl.style.top = `${a.y}px`;
      arrowEl.style[across as "top"] = "-5px";

      if (ctx.onReposition && isElement) {
        ctx.onReposition((reference as Element).getBoundingClientRect());
      }
    };

    if (isElement) {
      // jsdom has neither ResizeObserver nor real layout; autoUpdate's
      // observers are progressive enhancement, not a requirement. (TS's
      // `Window` type doesn't declare the observer globals, hence the cast.)
      const w = this.win as Window & {
        ResizeObserver?: unknown;
        IntersectionObserver?: unknown;
      };
      const canObserve = typeof w.ResizeObserver === "function";
      this.cleanup = autoUpdate(reference as Element, el, () => void position(), {
        elementResize: canObserve,
        layoutShift: canObserve && typeof w.IntersectionObserver === "function",
      });
    } else {
      void position();
    }

    return el;
  }

  private build(step: Step, ctx: TooltipContext): HTMLElement {
    const el = this.doc.createElement("div");
    el.dataset.stillsmithTour = "tooltip";
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", step.title ?? `Step ${ctx.index + 1} of ${ctx.total}`);
    Object.assign(el.style, {
      position: "fixed",
      zIndex: Z_TOOLTIP,
      pointerEvents: "auto",
      maxWidth: "320px",
      padding: "14px 16px",
      borderRadius: "10px",
      background: "#fff",
      color: "#111827",
      boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
      font: '14px/1.45 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    } as Partial<CSSStyleDeclaration>);

    if (step.title) {
      const title = this.doc.createElement("div");
      title.dataset.stillsmithTour = "title";
      title.textContent = step.title;
      Object.assign(title.style, {
        fontWeight: "600",
        fontSize: "15px",
        marginBottom: "4px",
      } as Partial<CSSStyleDeclaration>);
      el.appendChild(title);
    }

    const body = this.doc.createElement("div");
    body.dataset.stillsmithTour = "body";
    body.textContent = step.body;
    el.appendChild(body);

    const footer = this.doc.createElement("div");
    Object.assign(footer.style, {
      display: "flex",
      alignItems: "center",
      gap: "8px",
      marginTop: "12px",
    } as Partial<CSSStyleDeclaration>);

    const progress = this.doc.createElement("span");
    progress.dataset.stillsmithTour = "progress";
    progress.textContent = `${ctx.index + 1} / ${ctx.total}`;
    Object.assign(progress.style, {
      color: "#6b7280",
      fontSize: "12px",
      marginRight: "auto",
    } as Partial<CSSStyleDeclaration>);
    footer.appendChild(progress);

    const button = (
      label: string,
      kind: "primary" | "ghost",
      name: string,
      onClick: () => void,
    ) => {
      const b = this.doc.createElement("button");
      b.type = "button";
      b.dataset.stillsmithTour = name;
      b.textContent = label;
      Object.assign(
        b.style,
        {
          font: "inherit",
          fontSize: "13px",
          fontWeight: "500",
          padding: "6px 12px",
          borderRadius: "7px",
          cursor: "pointer",
          border: "none",
        } as Partial<CSSStyleDeclaration>,
        kind === "primary"
          ? { background: ACCENT, color: "#fff" }
          : { background: "transparent", color: "#6b7280" },
      );
      b.addEventListener("click", onClick);
      return b;
    };

    const last = ctx.index === ctx.total - 1;
    footer.appendChild(button(ctx.labels.skip, "ghost", "skip", ctx.onSkip));
    if (ctx.index > 0) footer.appendChild(button(ctx.labels.back, "ghost", "back", ctx.onBack));
    if (!ctx.interactive || last) {
      footer.appendChild(
        button(last ? ctx.labels.done : ctx.labels.next, "primary", "next", ctx.onNext),
      );
    }

    el.appendChild(footer);
    return el;
  }

  hide(): void {
    this.cleanup?.();
    this.cleanup = null;
    this.el?.remove();
    this.el = null;
  }

  destroy(): void {
    this.hide();
  }
}
