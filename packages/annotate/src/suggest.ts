/**
 * Turn an element into the best `Target` for it — preferring selectors that are
 * stable across renders and independent of the preset.
 *
 * Used by the authoring GUI's click-to-target (M3) and by the MCP
 * `inspect_scene` tool (M4), which is how an agent writes a selector that
 * actually resolves instead of guessing at the DOM.
 */
import type { Target, TargetSuggestion } from "./types.js";

/** One thing in the scene an annotation could point at. */
export interface AnnotatableElement {
  /** Ready to paste into an annotation's `target`. */
  target: Target;
  quality: TargetSuggestion["quality"];
  note?: string;
  tag: string;
  role?: string;
  /** Trimmed, truncated text content — how a human would recognise it. */
  text?: string;
  /** Viewport coordinates in CSS pixels. */
  rect: { x: number; y: number; w: number; h: number };
}

/** Elements worth offering as annotation targets, even without a data-shot. */
const INTERESTING = "button, a, input, select, textarea, h1, h2, h3, h4, [role]";

/**
 * Everything in the scene an annotation could sensibly target.
 *
 * This is what the MCP `inspect_scene` tool returns, and it's the one thing an
 * agent genuinely cannot work out for itself: without it, a model writes
 * `target: { selector: ".card-title" }` from imagination and the annotation
 * silently fails to resolve at capture. With it, it picks from selectors that are
 * known to exist and known to be stable.
 *
 * Ordered by how robust the target is, so the best hooks come first.
 */
export function collectAnnotatable(doc: Document = document, limit = 100): AnnotatableElement[] {
  const seen = new Set<Element>();
  const out: AnnotatableElement[] = [];

  // data-shot / data-testid first: they exist precisely to be annotation hooks.
  const candidates = [
    ...doc.querySelectorAll("[data-shot]"),
    ...doc.querySelectorAll("[data-testid]"),
    ...doc.querySelectorAll(INTERESTING),
  ];

  // Two different elements must never be offered the same target.
  // `suggestTarget` climbs to the nearest hooked ancestor, which is right for
  // click-to-pick (you clicked inside the card, you meant the card) but wrong
  // for enumeration: a heading inside `[data-shot='card']` would be listed with
  // the card's selector, and an agent picking that row to annotate the heading
  // would silently annotate the whole card instead.
  const claimed = new Set<string>();

  for (const el of candidates) {
    if (seen.has(el)) continue;
    seen.add(el);

    const r = el.getBoundingClientRect();
    // Invisible or zero-sized elements can't be pointed at.
    if (r.width < 2 || r.height < 2) continue;

    const suggestion = suggestTarget(el, doc);
    const text = (el.textContent ?? "").trim().replace(/\s+/g, " ");

    let { target, quality, note } = suggestion;
    const key = JSON.stringify(target);

    if (claimed.has(key)) {
      // The good selector belongs to an ancestor we've already listed. Offer
      // this element by its own text if we can; otherwise don't list it at all
      // rather than hand back a target that points somewhere else.
      if (!text || text.length > 40) continue;
      target = { text };
      quality = "ok";
      note = "No hook of its own; matched by text. Add a data-shot attribute for a stable target.";
    }
    claimed.add(JSON.stringify(target));

    out.push({
      target,
      quality,
      note,
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute("role") ?? undefined,
      text: text ? text.slice(0, 80) : undefined,
      rect: {
        x: Math.round(r.left),
        y: Math.round(r.top),
        w: Math.round(r.width),
        h: Math.round(r.height),
      },
    });
  }

  const rank = { stable: 0, ok: 1, brittle: 2 } as const;
  out.sort((a, b) => rank[a.quality] - rank[b.quality]);
  return out.slice(0, limit);
}

/**
 * True for elements too coarse to be a useful target: the mount root, the
 * document body/root, or anything filling (nearly) the whole viewport. Guards
 * the ancestor climbs below, so a click never resolves to "the whole app" just
 * because the nearest id-bearing ancestor happens to be `#root`.
 */
function isRootish(el: Element, doc: Document): boolean {
  if (el === doc.body || el === doc.documentElement) return true;
  if (el.id === "root") return true;
  const r = el.getBoundingClientRect();
  const vw = doc.documentElement.clientWidth || 1;
  const vh = doc.documentElement.clientHeight || 1;
  return r.width >= vw * 0.98 && r.height >= vh * 0.98;
}

/**
 * Whether an id is safe to target with `#id`.
 *
 * React's `useId` and react-aria emit non-deterministic ids (`:r0:`, `«r0»`,
 * `react-aria123456-_r_0_`) that change on every render — a `#id` built from one
 * looks stable but won't match at capture time, in a fresh page.
 */
function isStableId(id: string): boolean {
  if (!/^[A-Za-z][\w-]*$/.test(id)) return false; // must be a valid bare selector
  if (/^react-aria/i.test(id)) return false;
  if (/[:»«]|_r_/.test(id)) return false; // React useId variants
  if (/\d{4,}/.test(id)) return false; // long digit runs ⇒ generated
  return true;
}

/** Order: data-shot → stable id → data-testid → short text → absolute rect. */
export function suggestTarget(el: Element, doc: Document = document): TargetSuggestion {
  const count = (sel: string): number => {
    try {
      return doc.querySelectorAll(sel).length;
    } catch {
      return 0;
    }
  };

  // 1. Nearest data-shot ancestor — the intended, preset-independent hook.
  const shotEl = el.closest("[data-shot]");
  if (shotEl && !isRootish(shotEl, doc)) {
    const name = shotEl.getAttribute("data-shot") ?? "";
    const selector = `[data-shot='${name}']`;
    const n = count(selector);
    if (n === 1) return { target: { selector }, quality: "stable", element: shotEl };

    const nth = Math.max(0, Array.from(doc.querySelectorAll(selector)).indexOf(shotEl));
    return {
      target: { selector, nth },
      quality: "ok",
      note: `${n} elements share data-shot="${name}"; pinned to nth=${nth}.`,
      element: shotEl,
    };
  }

  // 2. A stable id on the element or a non-root ancestor.
  const idEl = el.closest("[id]") as HTMLElement | null;
  if (idEl && !isRootish(idEl, doc) && isStableId(idEl.id) && count(`#${idEl.id}`) === 1) {
    return { target: { selector: `#${idEl.id}` }, quality: "stable", element: idEl };
  }

  // 3. A data-testid ancestor.
  const testEl = el.closest("[data-testid]");
  if (testEl && !isRootish(testEl, doc)) {
    const t = testEl.getAttribute("data-testid") ?? "";
    const selector = `[data-testid='${t}']`;
    if (count(selector) === 1) {
      return { target: { selector }, quality: "stable", element: testEl };
    }
  }

  // 4. Short text content — usable, but nudge toward a data-shot hook.
  const txt = (el.textContent ?? "").trim();
  if (txt && txt.length <= 40) {
    return {
      target: { text: txt },
      quality: "ok",
      note: "Matched by text. Add a data-shot attribute for a stable target.",
      element: el,
    };
  }

  // 5. Last resort: an absolute rect, which won't adapt across presets.
  const r = el.getBoundingClientRect();
  const rect = {
    x: Math.round(r.left),
    y: Math.round(r.top),
    w: Math.round(r.width),
    h: Math.round(r.height),
  };
  return {
    target: { rect } satisfies Target,
    quality: "brittle",
    note: "No stable selector found; using an absolute rect. Add a data-shot attribute so it adapts across presets.",
    element: el,
  };
}
