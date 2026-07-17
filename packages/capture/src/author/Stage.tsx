/**
 * The scene, live in an iframe, with the annotations drawn on top of it.
 *
 * This is the whole point of the authoring tool: the preview is not a mock of
 * the capture, it is the *same engine* — `drawAnnotations` runs against the
 * iframe's own document via its `root` parameter, exactly as it will run against
 * the page at capture time. What you nudge here is what comes out of the shot.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { drawAnnotations, suggestTarget } from "@stillsmith/annotate";
import type { Annotation, Offset, Target, TargetSuggestion } from "@stillsmith/annotate";
import type { Preset } from "../types.js";

const HOVER_OUTLINE = "2px solid #3b82f6";

export interface StageProps {
  sceneFile: string;
  preset: Preset;
  /** Overrides the preset's size, mirroring the shot's own `viewport`. */
  viewport?: { width: number; height: number };
  annotations: Annotation[];
  /** When set, clicking an element reports a Target instead of hitting the app. */
  picking: boolean;
  onPick: (target: Target, suggestion: TargetSuggestion) => void;
  /** Drag an annotation on the stage to set its `offset`. Omit to disable dragging. */
  onOffsetChange?: (index: number, offset: Offset) => void;
}

export function Stage({
  sceneFile,
  preset,
  viewport,
  annotations,
  picking,
  onPick,
  onOffsetChange,
}: StageProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Latest annotations, read by the drag handlers without re-binding them.
  const annotationsRef = useRef(annotations);
  annotationsRef.current = annotations;

  // Monotonic draw generation. `redraw` awaits the frame's readiness before it
  // paints, so two calls can be in flight at once — and on a cold frame the
  // slower, older one can land last and clobber the newer overlay (e.g. an
  // empty first draw overwriting the annotations that replaced it). Each redraw
  // claims a generation and bails the moment a newer one has started.
  const drawGen = useRef(0);

  // Bumped on every iframe load so effects re-bind to the fresh contentDocument.
  const [frameNonce, setFrameNonce] = useState(0);

  const scheme = preset.colorScheme ?? "light";
  const width = viewport?.width ?? preset.width;
  const height = viewport?.height ?? preset.height;

  // The scene runtime, addressed by file — the same URL capture navigates to.
  const src = `/__stillsmith/?file=${encodeURIComponent(sceneFile)}&theme=${scheme}`;

  /**
   * Draw once the scene has actually rendered.
   *
   * The iframe's `load` event fires when the document is parsed — long before
   * React has mounted the scene, since the runtime imports the scene module
   * asynchronously. Drawing then resolves every selector against an empty body
   * and silently produces nothing. The scene runtime sets `data-stillsmith-ready`
   * when it has committed and painted, which is exactly what the capture driver
   * waits for; wait for the same signal here so the preview and the capture agree.
   */
  const redraw = useCallback(async () => {
    const gen = ++drawGen.current;
    const frame = frameRef.current;
    const doc = frame?.contentDocument;
    const win = frame?.contentWindow;
    if (!doc || !win) return;

    const deadline = Date.now() + 5000;
    while (!doc.documentElement?.hasAttribute("data-stillsmith-ready")) {
      if (Date.now() > deadline || drawGen.current !== gen) return;
      await new Promise((r) => setTimeout(r, 30));
    }
    // The frame may have navigated away, or a newer redraw superseded us, while
    // we waited — either way this draw is stale and must not touch the overlay.
    if (!doc.body || frameRef.current?.contentDocument !== doc) return;
    if (drawGen.current !== gen) return;

    drawAnnotations(annotations, { doc, win });

    // Make the drawn annotations grabbable. The overlay itself is
    // pointer-events:none so the scene shows through; opting each annotation
    // back in — but only when we're not picking a target — lets a drag land on
    // the annotation instead of the element beneath it.
    if (onOffsetChange && !picking) {
      for (const el of doc.querySelectorAll<HTMLElement>("[data-stillsmith-ann]")) {
        el.style.pointerEvents = "auto";
        el.style.cursor = "grab";
      }
    }
  }, [annotations, onOffsetChange, picking]);

  // Redraw on any change to the annotations, and again once the frame reloads.
  // `width`/`height` matter too: the overlay is positioned by measuring the DOM,
  // so a viewport change moves every annotation.
  // biome-ignore lint/correctness/useExhaustiveDependencies: size changes must retrigger the draw
  useEffect(() => {
    void redraw();
  }, [redraw, width, height]);

  // Element picking: intercept in the capture phase so the app's own handlers
  // never see the click — otherwise picking a button would press it.
  useEffect(() => {
    const frame = frameRef.current;
    const doc = frame?.contentDocument;
    if (!doc) return;

    let hovered: HTMLElement | null = null;
    const clearHover = () => {
      if (hovered) hovered.style.outline = "";
      hovered = null;
    };

    const onMove = (e: Event) => {
      if (!picking) return;
      const el = e.target as HTMLElement;
      if (el === hovered) return;
      clearHover();
      hovered = el;
      el.style.outline = HOVER_OUTLINE;
    };

    const onClick = (e: MouseEvent) => {
      if (!picking) return;
      e.preventDefault();
      e.stopPropagation();
      const el = e.target as Element;
      const suggestion = suggestTarget(el, doc);
      clearHover();
      onPick(suggestion.target, suggestion);
    };

    doc.addEventListener("mouseover", onMove, true);
    doc.addEventListener("click", onClick, true);
    doc.body.style.cursor = picking ? "crosshair" : "";

    return () => {
      doc.removeEventListener("mouseover", onMove, true);
      doc.removeEventListener("click", onClick, true);
      clearHover();
      if (doc.body) doc.body.style.cursor = "";
    };
  }, [picking, onPick]);

  // Dragging an annotation to author its `offset`. Mouse coordinates inside the
  // iframe are already in the scene's own CSS pixels — the parent's `scale()`
  // transform is undone by the browser when it maps the cursor into the frame —
  // so a raw clientX/clientY delta is exactly the pixel nudge `offset` wants, no
  // scale arithmetic required.
  //
  // The handlers live on the frame's document, not on the annotation elements:
  // every offset tick rebuilds the overlay from scratch (drawAnnotations removes
  // and recreates it), so a listener bound to a drawn element would die mid-drag.
  // The document survives, and the live drag state is held in a local, not the
  // DOM. `frameNonce` re-runs this when the frame reloads onto a new document.
  // biome-ignore lint/correctness/useExhaustiveDependencies: frameNonce re-binds to the reloaded document
  useEffect(() => {
    const frame = frameRef.current;
    const doc = frame?.contentDocument;
    if (!doc || !onOffsetChange || picking) return;

    let drag: { index: number; startX: number; startY: number; dx: number; dy: number } | null =
      null;

    const onDown = (e: MouseEvent) => {
      const hit = (e.target as Element)?.closest?.("[data-stillsmith-ann]");
      if (!hit) return;
      const index = Number(hit.getAttribute("data-stillsmith-ann"));
      if (!Number.isInteger(index)) return;
      const offset = annotationsRef.current[index]?.offset ?? {};
      drag = {
        index,
        startX: e.clientX,
        startY: e.clientY,
        dx: offset.dx ?? 0,
        dy: offset.dy ?? 0,
      };
      // Don't let the drag reach the app (an annotation over a button, say).
      e.preventDefault();
      e.stopPropagation();
      if (doc.body) doc.body.style.cursor = "grabbing";
    };

    const onMove = (e: MouseEvent) => {
      if (!drag) return;
      e.preventDefault();
      onOffsetChange(drag.index, {
        dx: Math.round(drag.dx + (e.clientX - drag.startX)),
        dy: Math.round(drag.dy + (e.clientY - drag.startY)),
      });
    };

    const onUp = () => {
      if (!drag) return;
      drag = null;
      if (doc.body) doc.body.style.cursor = "";
    };

    doc.addEventListener("mousedown", onDown, true);
    doc.addEventListener("mousemove", onMove, true);
    doc.addEventListener("mouseup", onUp, true);
    // A mouseup that lands outside the frame still ends the drag.
    window.addEventListener("mouseup", onUp, true);

    return () => {
      doc.removeEventListener("mousedown", onDown, true);
      doc.removeEventListener("mousemove", onMove, true);
      doc.removeEventListener("mouseup", onUp, true);
      window.removeEventListener("mouseup", onUp, true);
      if (doc.body) doc.body.style.cursor = "";
    };
  }, [picking, onOffsetChange, frameNonce]);

  /**
   * Scale the frame down to fit. The iframe is always sized at the preset's true
   * CSS pixels and then transformed, so the scene lays out exactly as it will at
   * capture — shrinking the iframe itself would reflow it and preview a layout
   * that never ships.
   *
   * Measured in an effect, not during render: on the first render the ref isn't
   * attached yet, so reading clientWidth there yields a meaningless number and
   * the frame renders at ~1%.
   */
  const [available, setAvailable] = useState(0);
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setAvailable(entry.contentRect.width);
    });
    observer.observe(wrap);
    return () => observer.disconnect();
  }, []);

  const scale = available > 0 ? Math.min(1, available / width) : 1;

  return (
    <div className="stage" ref={wrapRef}>
      <div className="stage-meta">
        {width}×{height} · {scheme}
        {scale < 1 && ` · ${Math.round(scale * 100)}%`}
      </div>
      <div className="stage-frame" style={{ width: width * scale, height: height * scale }}>
        <iframe
          ref={frameRef}
          title="scene"
          src={src}
          width={width}
          height={height}
          onLoad={() => {
            setFrameNonce((n) => n + 1);
            void redraw();
          }}
          style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}
        />
      </div>
    </div>
  );
}
