/**
 * Turn an element into the best `Target` for it — preferring selectors that are
 * stable across renders and independent of the preset.
 *
 * The consumer is @stillsmith/studio's click-to-target: you click an element in
 * the live app and the GUI writes the resulting selector into the shot or tour
 * step, graded `stable` / `ok` / `brittle` so the author can see when a target
 * won't survive a re-render.
 */
import type { Target, TargetSuggestion } from "./types.js";

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
