/**
 * Annotation drawing: a DOM overlay laid over the scene just before capture.
 *
 * Two callers, one engine:
 *   - the capture driver, which injects this bundle with `addScriptTag` and
 *     calls `drawAnnotations` in the page;
 *   - the authoring GUI (M3), which calls it directly against an iframe's frame
 *     for live preview, via the `root` parameter.
 *
 * Unlike the original in show-control, this file does NOT have to be a single
 * self-contained function. That constraint existed only because the drawer was
 * shipped through `page.evaluate`, which serialises the function body and drops
 * everything in module scope — forcing every helper to be nested inside, and
 * requiring a `globalThis.__name` shim to survive esbuild's `keepNames`. We ship
 * a prebuilt IIFE instead, so helpers live at module scope like normal code.
 */
import { resolveTarget } from "./resolve.js";
import type {
  Anchor,
  Annotation,
  CalloutAnnotation,
  DrawRoot,
  HighlightAnnotation,
  Offset,
  OutlineAnnotation,
  LabelAnnotation,
  Point,
  Target,
} from "./types.js";

const SVGNS = "http://www.w3.org/2000/svg";
const OVERLAY_ID = "__stillsmith_overlay__";

const DEFAULT_COLOR = "#3b82f6";

const PALETTE: Record<string, string> = {
  accent: DEFAULT_COLOR,
  danger: "#ef4444",
  success: "#22c55e",
  warning: "#f59e0b",
  info: "#06b6d4",
};

/** z-order within the overlay: scrim < fills < lines < outlines < boxes/pins. */
const Z = { fill: "1", line: "2", outline: "3", box: "4" } as const;

/** A palette name, or any raw CSS colour passed straight through. */
const resolveColor = (c?: string): string => (c ? (PALETTE[c] ?? c) : DEFAULT_COLOR);

interface XY {
  x: number;
  y: number;
}

const dx = (o?: Offset) => o?.dx ?? 0;
const dy = (o?: Offset) => o?.dy ?? 0;

const centerOf = (r: DOMRect): XY => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });

function anchorPoint(r: DOMRect, anchor: Anchor): XY {
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  switch (anchor) {
    case "top":
      return { x: cx, y: r.top };
    case "bottom":
      return { x: cx, y: r.bottom };
    case "left":
      return { x: r.left, y: cy };
    case "right":
      return { x: r.right, y: cy };
    case "top-left":
      return { x: r.left, y: r.top };
    case "top-right":
      return { x: r.right, y: r.top };
    case "bottom-left":
      return { x: r.left, y: r.bottom };
    case "bottom-right":
      return { x: r.right, y: r.bottom };
    default:
      return { x: cx, y: cy };
  }
}

/** Point on rect `r`'s boundary in the direction of `toward` (grown by `gap`). */
function edgePoint(r: DOMRect, toward: XY, gap: number): XY {
  const c = centerOf(r);
  const halfW = r.width / 2 + gap;
  const halfH = r.height / 2 + gap;
  const vx = toward.x - c.x;
  const vy = toward.y - c.y;
  if (vx === 0 && vy === 0) return { x: c.x, y: c.y - halfH };
  const scale = 1 / Math.max(Math.abs(vx) / halfW, Math.abs(vy) / halfH);
  return { x: c.x + vx * scale, y: c.y + vy * scale };
}

/** One drawing pass. Holds the frame, the overlay, and the shared SVG layer. */
class Drawer {
  readonly warnings: string[] = [];
  private readonly doc: Document;
  private readonly win: Window;
  private readonly overlay: HTMLElement;
  private svg: SVGSVGElement | null = null;
  private defs: SVGDefsElement | null = null;
  private readonly markers = new Set<string>();

  constructor(root?: DrawRoot) {
    this.doc = root?.doc ?? document;
    this.win = root?.win ?? window;

    this.doc.getElementById(OVERLAY_ID)?.remove();
    const overlay = this.doc.createElement("div");
    overlay.id = OVERLAY_ID;
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      pointerEvents: "none",
      zIndex: "2147483647",
      font: '13px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    } as Partial<CSSStyleDeclaration>);
    this.doc.body.appendChild(overlay);
    this.overlay = overlay;
  }

  private getSvg(): SVGSVGElement {
    if (this.svg) return this.svg;
    const svg = this.doc.createElementNS(SVGNS, "svg");
    svg.setAttribute("width", String(this.win.innerWidth));
    svg.setAttribute("height", String(this.win.innerHeight));
    Object.assign(svg.style, {
      position: "absolute",
      left: "0",
      top: "0",
      overflow: "visible",
      zIndex: Z.line,
    } as Partial<CSSStyleDeclaration>);
    this.defs = this.doc.createElementNS(SVGNS, "defs");
    svg.appendChild(this.defs);
    this.overlay.appendChild(svg);
    this.svg = svg;
    return svg;
  }

  private markerId(color: string, size: number): string {
    const id = `ps-ah-${color.replace(/[^a-z0-9]/gi, "")}-${size}`;
    if (!this.markers.has(id)) {
      this.getSvg();
      const marker = this.doc.createElementNS(SVGNS, "marker");
      marker.setAttribute("id", id);
      marker.setAttribute("markerUnits", "userSpaceOnUse");
      marker.setAttribute("markerWidth", String(size));
      marker.setAttribute("markerHeight", String(size));
      marker.setAttribute("refX", String(size));
      marker.setAttribute("refY", String(size / 2));
      marker.setAttribute("orient", "auto");
      const tip = this.doc.createElementNS(SVGNS, "path");
      tip.setAttribute("d", `M0,0 L${size},${size / 2} L0,${size} Z`);
      tip.setAttribute("fill", color);
      marker.appendChild(tip);
      this.defs?.appendChild(marker);
      this.markers.add(id);
    }
    return id;
  }

  resolveRect(target: Target): DOMRect | null {
    const resolved = resolveTarget(target, this.doc);
    if (resolved.warning) this.warnings.push(resolved.warning);
    return resolved.rect;
  }

  resolvePoint(p: Point): XY | null {
    if ("vx" in p) return { x: p.vx * this.win.innerWidth, y: p.vy * this.win.innerHeight };
    if ("x" in p) return { x: p.x, y: p.y };
    const r = this.resolveRect(p.target);
    if (!r) return null;
    const a = anchorPoint(r, p.anchor ?? "center");
    return { x: a.x + (p.dx ?? 0), y: a.y + (p.dy ?? 0) };
  }

  drawLine(
    from: XY,
    to: XY,
    color: string,
    width: number,
    curve: boolean,
    head?: number,
  ): SVGPathElement {
    const path = this.doc.createElementNS(SVGNS, "path");
    if (curve) {
      const mx = (from.x + to.x) / 2;
      const my = (from.y + to.y) / 2;
      const vx = to.x - from.x;
      const vy = to.y - from.y;
      const len = Math.hypot(vx, vy) || 1;
      // Bow the curve perpendicular to the line by ~18% of its length.
      const off = len * 0.18;
      const cx = mx + (-vy / len) * off;
      const cy = my + (vx / len) * off;
      path.setAttribute("d", `M${from.x},${from.y} Q${cx},${cy} ${to.x},${to.y}`);
    } else {
      path.setAttribute("d", `M${from.x},${from.y} L${to.x},${to.y}`);
    }
    path.setAttribute("stroke", color);
    path.setAttribute("stroke-width", String(width));
    path.setAttribute("stroke-linecap", "round");
    path.setAttribute("fill", "none");
    if (head) path.setAttribute("marker-end", `url(#${this.markerId(color, head)})`);
    this.getSvg().appendChild(path);
    return path;
  }

  drawBox(ann: OutlineAnnotation | HighlightAnnotation, rect: DOMRect, index: number): void {
    const pad = ann.padding ?? 4;
    const radius = ann.radius ?? 8;
    const color = resolveColor(ann.color);

    const box = this.doc.createElement("div");
    Object.assign(box.style, {
      position: "absolute",
      left: `${rect.left - pad + dx(ann.offset)}px`,
      top: `${rect.top - pad + dy(ann.offset)}px`,
      width: `${rect.width + pad * 2}px`,
      height: `${rect.height + pad * 2}px`,
      borderRadius: `${radius}px`,
      boxSizing: "border-box",
    } as Partial<CSSStyleDeclaration>);

    if (ann.kind === "outline") {
      const w = ann.width ?? 3;
      box.style.zIndex = Z.outline;
      box.style.border = `${w}px ${ann.dashed ? "dashed" : "solid"} ${color}`;
      box.style.boxShadow = `0 0 0 1px rgba(0,0,0,0.25), 0 0 12px ${color}66`;
    } else {
      box.style.zIndex = Z.fill;
      box.style.background = color;
      box.style.opacity = String(ann.fillOpacity ?? 0.18);
      box.style.border = `2px solid ${color}`;
      if (ann.dim) {
        // A huge box-shadow spread darkens everything outside the box, in one
        // element — no four-rect scrim to keep in sync.
        box.style.boxShadow = `0 0 0 9999px rgba(0,0,0,${ann.dimOpacity ?? 0.55})`;
        box.style.opacity = "1";
        box.style.background = "transparent";
      }
    }
    box.dataset.stillsmithAnn = String(index);
    this.overlay.appendChild(box);
  }

  drawCallout(ann: CalloutAnnotation, rect: DOMRect, index: number): void {
    const color = resolveColor(ann.color);
    const gap = ann.gap ?? 16;

    const box = this.doc.createElement("div");
    box.style.zIndex = Z.box;
    Object.assign(box.style, {
      position: "absolute",
      display: "flex",
      gap: "8px",
      alignItems: "center",
      maxWidth: `${ann.maxWidth ?? 240}px`,
      padding: "8px 12px",
      borderRadius: `${ann.radius ?? 8}px`,
      background: color,
      color: "#fff",
      fontWeight: "500",
      lineHeight: "1.3",
      boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
      // Off-screen until measured, so it can be centred against the target.
      left: "-9999px",
      top: "-9999px",
    } as Partial<CSSStyleDeclaration>);

    if (ann.badge != null) box.appendChild(this.makeBadge(String(ann.badge)));
    const label = this.doc.createElement("span");
    label.textContent = ann.text;
    box.appendChild(label);
    box.dataset.stillsmithAnn = String(index);
    this.overlay.appendChild(box);

    const b = box.getBoundingClientRect();

    let placement = ann.placement ?? "auto";
    if (placement === "auto") {
      const above = rect.top;
      const below = this.win.innerHeight - rect.bottom;
      placement = above >= b.height + gap || above >= below ? "top" : "bottom";
    }

    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let left: number;
    let top: number;
    if (placement === "top") {
      left = cx - b.width / 2;
      top = rect.top - gap - b.height;
    } else if (placement === "bottom") {
      left = cx - b.width / 2;
      top = rect.bottom + gap;
    } else if (placement === "left") {
      left = rect.left - gap - b.width;
      top = cy - b.height / 2;
    } else {
      left = rect.right + gap;
      top = cy - b.height / 2;
    }

    // Keep the box inside the viewport…
    left = Math.max(8, Math.min(left, this.win.innerWidth - b.width - 8));
    top = Math.max(8, Math.min(top, this.win.innerHeight - b.height - 8));
    // …then apply the author's offset, which deliberately overrides the clamp.
    left += dx(ann.offset);
    top += dy(ann.offset);

    box.style.left = `${left}px`;
    box.style.top = `${top}px`;

    // Leader line from the box edge to the target edge — follows the offset,
    // so a nudged callout still points at the thing it describes.
    const boxRect = new DOMRect(left, top, b.width, b.height);
    const targetEdge = edgePoint(rect, centerOf(boxRect), 2);
    const boxEdge = edgePoint(boxRect, centerOf(rect), 0);
    this.drawLine(boxEdge, targetEdge, color, 2, false);
  }

  private makeBadge(text: string): HTMLElement {
    const badge = this.doc.createElement("div");
    badge.textContent = text;
    Object.assign(badge.style, {
      flex: "0 0 auto",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: "20px",
      height: "20px",
      borderRadius: "999px",
      background: "rgba(255,255,255,0.25)",
      color: "#fff",
      fontWeight: "700",
      fontSize: "12px",
      lineHeight: "1",
    } as Partial<CSSStyleDeclaration>);
    return badge;
  }

  drawLabel(ann: LabelAnnotation, rect: DOMRect, index: number): void {
    const color = resolveColor(ann.color);
    const at = anchorPoint(rect, ann.anchor ?? "top-left");
    const size = 24;
    const px = at.x + dx(ann.offset);
    const py = at.y + dy(ann.offset);

    const pin = this.doc.createElement("div");
    pin.textContent = String(ann.badge);
    pin.dataset.stillsmithAnn = String(index);
    pin.style.zIndex = Z.box;
    Object.assign(pin.style, {
      position: "absolute",
      left: `${px - size / 2}px`,
      top: `${py - size / 2}px`,
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: "999px",
      background: color,
      color: "#fff",
      fontWeight: "700",
      fontSize: "13px",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: "0 2px 8px rgba(0,0,0,0.4), 0 0 0 2px rgba(255,255,255,0.9)",
    } as Partial<CSSStyleDeclaration>);
    this.overlay.appendChild(pin);
  }
}

/**
 * Draw `annotations` as an overlay in `root` (or the ambient frame).
 *
 * Returns human-readable warnings for targets that didn't resolve. It never
 * throws and never skips the screenshot: a stale selector should degrade to a
 * missing callout and a warning, not a failed build. A pipeline that hard-fails
 * on a moved selector is one people turn off.
 */
export function drawAnnotations(annotations: Annotation[], root?: DrawRoot): string[] {
  const d = new Drawer(root);

  for (const [i, ann] of annotations.entries()) {
    switch (ann.kind) {
      case "arrow": {
        const toRect = d.resolveRect(ann.to);
        if (!toRect) continue;
        const from = ann.from
          ? d.resolvePoint(ann.from)
          : { x: toRect.left + toRect.width / 2, y: toRect.top - 64 };
        if (!from) continue;
        // The offset moves the head; the tail stays where it was aimed from.
        const tip = edgePoint(toRect, from, ann.gap ?? 6);
        const to = { x: tip.x + dx(ann.offset), y: tip.y + dy(ann.offset) };
        const line = d.drawLine(
          from,
          to,
          resolveColor(ann.color),
          ann.width ?? 3,
          ann.curve ?? false,
          ann.headSize ?? 14,
        );
        line.dataset.stillsmithAnn = String(i);
        continue;
      }
      case "callout": {
        const rect = d.resolveRect(ann.target);
        if (rect) d.drawCallout(ann, rect, i);
        continue;
      }
      case "label": {
        const rect = d.resolveRect(ann.target);
        if (rect) d.drawLabel(ann, rect, i);
        continue;
      }
      default: {
        const rect = d.resolveRect(ann.target);
        if (rect) d.drawBox(ann, rect, i);
      }
    }
  }

  return d.warnings;
}
