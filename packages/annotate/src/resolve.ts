/**
 * Target resolution: turn a `Target` into the element (and rect) it points at.
 *
 * Extracted from the Drawer so it has two callers with different needs:
 *   - the drawer, which only wants the rect (and collects the warning);
 *   - the tour runtime, which needs the *element* — to scroll it into view,
 *     listen for a click-to-advance, and re-measure it as the page moves.
 *
 * Resolution order is selector → text → rect, unchanged from the original.
 */
import type { Target } from "./types.js";

export interface ResolvedTarget {
  /** The matched element, or null for rect-only targets (and misses). */
  element: Element | null;
  /** The target's viewport rect, or null if nothing resolved. */
  rect: DOMRect | null;
  /** Human-readable reason when nothing resolved. */
  warning?: string;
}

/** Resolve `target` against `doc` (or the ambient document). Never throws. */
export function resolveTarget(target: Target, doc: Document = document): ResolvedTarget {
  if (target.rect) {
    const { x, y, w, h } = target.rect;
    return { element: null, rect: new DOMRect(x, y, w, h) };
  }

  if (target.selector) {
    const nodes = doc.querySelectorAll(target.selector);
    const el = nodes[target.nth ?? 0] as HTMLElement | undefined;
    if (el) return { element: el, rect: el.getBoundingClientRect() };
    const nth = target.nth != null ? ` [nth=${target.nth}]` : "";
    return {
      element: null,
      rect: null,
      warning: `selector "${target.selector}"${nth} matched ${nodes.length} element(s)`,
    };
  }

  if (target.text) {
    const el = findByText(target.text.trim(), doc);
    if (el) return { element: el, rect: el.getBoundingClientRect() };
    return { element: null, rect: null, warning: `text "${target.text.trim()}" not found` };
  }

  return { element: null, rect: null, warning: "target has no selector, text, or rect" };
}

/** Convenience for callers that only care about geometry. */
export function resolveTargetRect(target: Target, doc: Document = document): DOMRect | null {
  return resolveTarget(target, doc).rect;
}

/**
 * Most specific match wins: an element whose *entire* trimmed text is the
 * needle beats one that merely contains it, and among equals the smallest box
 * wins — so `text: "GO"` finds the button, not a status line mentioning "GO".
 */
function findByText(needle: string, doc: Document): HTMLElement | null {
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_ELEMENT);
  let node = walker.nextNode() as HTMLElement | null;
  let exact: HTMLElement | null = null;
  let exactArea = Number.POSITIVE_INFINITY;
  let partial: HTMLElement | null = null;
  let partialArea = Number.POSITIVE_INFINITY;

  while (node) {
    const txt = (node.textContent ?? "").trim();
    if (txt.includes(needle)) {
      const r = node.getBoundingClientRect();
      const area = r.width * r.height;
      if (txt === needle) {
        if (area < exactArea) {
          exact = node;
          exactArea = area;
        }
      } else if (area < partialArea) {
        partial = node;
        partialArea = area;
      }
    }
    node = walker.nextNode() as HTMLElement | null;
  }
  return exact ?? partial;
}
