/**
 * The consumer's real app, live in an iframe, with one tour step previewed
 * over it.
 *
 * Scenes render one component in isolation; a tour runs through the actual
 * product across routes — so this stage doesn't load the scene runtime, it
 * loads `/`. That works because the stillsmith middleware only claims
 * `/__stillsmith*` paths: everything else falls through to the same merged Vite
 * dev server, which is already serving the consumer's app. Same origin, so
 * click-to-pick and the preview draw straight into the frame's document —
 * the commercial tools need a browser extension for this; we're already in
 * the page.
 *
 * The preview is `renderStepPreview` from @stillsmith/tour (bundled into this
 * GUI): the same spotlight and tooltip that ship, minus lifecycle. Press
 * play and it's not even minus that — the stage runs the real `startTour`
 * inside the frame, with persistence off so a rehearsal never marks the
 * consumer's tour as completed.
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { suggestTarget } from "@stillsmith/annotate";
import type { Offset, Target, TargetSuggestion } from "@stillsmith/annotate";
import {
  applyTourFixture,
  createHistoryRouter,
  renderStepPreview,
  startTour,
  type Step,
  type Tour,
  type TourController,
} from "@stillsmith/tour";
import type { Preset } from "../types.js";

const HOVER_OUTLINE = "2px solid #3b82f6";

export interface AppStageProps {
  /** The route the frame shows. Changing it reloads the frame there. */
  route: string;
  onRouteChange: (route: string) => void;
  preset: Preset;
  /**
   * External app origin from `appUrl`. When set, the iframe loads
   * `${appUrl}${route}` instead of a same-origin path on the stillsmith server.
   */
  appUrl?: string;
  /** The step being edited, previewed live; null previews nothing. */
  step: Step | null;
  stepIndex: number;
  stepCount: number;
  /** The whole tour, for play-through. */
  tour: Tour | null;
  playing: boolean;
  onStopPlay: () => void;
  picking: boolean;
  onPick: (target: Target, suggestion: TargetSuggestion) => void;
  onOffsetChange?: (offset: Offset) => void;
  onWarnings?: (warnings: string[]) => void;
}

export function AppStage({
  route,
  onRouteChange,
  preset,
  appUrl,
  step,
  stepIndex,
  stepCount,
  tour,
  playing,
  onStopPlay,
  picking,
  onPick,
  onOffsetChange,
  onWarnings,
}: AppStageProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [frameNonce, setFrameNonce] = useState(0);
  const [routeDraft, setRouteDraft] = useState(route);

  const stepRef = useRef(step);
  stepRef.current = step;

  const { width, height } = preset;

  // The frame navigates by src; typing a route and hitting go re-anchors it.
  useEffect(() => setRouteDraft(route), [route]);

  /**
   * Seed the tour's fixture into the frame, so steps that point at
   * data-dependent elements have something to point at while you author them.
   *
   * Only while *not* playing: the engine seeds and cleans up its own fixture
   * during a play-through. Setup is contractually idempotent, so the handover
   * either way is safe. A frame reload resets the app anyway; the cleanup here
   * covers switching tours within one frame.
   */
  const fixture = tour?.fixture;
  const tourIdForFixture = tour?.id;
  // biome-ignore lint/correctness/useExhaustiveDependencies: frameNonce re-seeds the reloaded document
  useEffect(() => {
    const frame = frameRef.current;
    const doc = frame?.contentDocument;
    const win = frame?.contentWindow;
    if (!doc || !win || !fixture || playing) return;

    let cancelled = false;
    let cleanup: (() => void | Promise<void>) | null = null;

    void applyTourFixture(fixture, {
      root: { doc, win },
      tourId: tourIdForFixture ?? fixture,
    }).then((result) => {
      if (result.warning) onWarnings?.([result.warning]);
      // Unmounted while seeding: undo it rather than leave demo data behind.
      if (cancelled) void result.teardown?.();
      else cleanup = result.teardown;
    });

    return () => {
      cancelled = true;
      void cleanup?.();
    };
  }, [fixture, tourIdForFixture, playing, frameNonce, onWarnings]);

  /**
   * Live preview of the selected step. There is no `data-stillsmith-ready`
   * here — a real app doesn't announce readiness — so the draw retries
   * briefly instead: an unresolved target right after a route load usually
   * just hasn't mounted yet, and if it truly never appears the warning chip
   * says so rather than a blank stage.
   */
  const stepJson = JSON.stringify(step);
  // biome-ignore lint/correctness/useExhaustiveDependencies: stepJson stands in for step; frameNonce re-runs on frame reload
  useEffect(() => {
    const frame = frameRef.current;
    let doc: Document | null | undefined;
    let win: Window | null | undefined;
    try {
      doc = frame?.contentDocument;
      win = frame?.contentWindow;
    } catch {
      // Some environments throw on cross-origin access.
      onWarnings?.([
        "appUrl is cross-origin — live step preview in the GUI needs same-origin access. Use MCP preview_step, or run the app through stillsmith's merged Vite server.",
      ]);
      return;
    }
    // Browsers more often return null than throw for cross-origin frames.
    if (appUrl && (!doc || !win)) {
      onWarnings?.([
        "appUrl is cross-origin — live step preview in the GUI needs same-origin access. Use MCP preview_step, or run the app through stillsmith's merged Vite server.",
      ]);
      return;
    }
    if (!doc || !win || playing || picking || !step) return;

    let disposed = false;
    let dispose: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const attempt = (retries: number) => {
      if (disposed || !doc.body) return;
      const preview = renderStepPreview(step, {
        root: { doc, win },
        index: stepIndex,
        total: stepCount,
        overlay: tour?.overlay,
        labels: tour?.labels,
      });
      if (preview.warnings.length > 0 && retries > 0) {
        // Target not there yet — tear down and try again shortly.
        preview.dispose();
        timer = setTimeout(() => attempt(retries - 1), 250);
        return;
      }
      dispose = preview.dispose;
      onWarnings?.(preview.warnings);
    };
    attempt(12);

    return () => {
      disposed = true;
      if (timer !== undefined) clearTimeout(timer);
      dispose?.();
    };
  }, [stepJson, stepIndex, stepCount, playing, picking, frameNonce]);

  // Play-through: the real engine, inside the frame, persistence off.
  // biome-ignore lint/correctness/useExhaustiveDependencies: a play run captures the tour it started with
  useEffect(() => {
    const frame = frameRef.current;
    const doc = frame?.contentDocument;
    const win = frame?.contentWindow;
    if (!playing || !tour || !doc || !win) return;

    const controller: TourController = startTour(tour, {
      root: { doc, win },
      storage: null,
      router: createHistoryRouter(win),
      onFinish: onStopPlay,
      onDismiss: onStopPlay,
    });
    return () => controller.destroy();
  }, [playing, onStopPlay]);

  // Element picking: capture-phase, so the app's own handlers never fire.
  // Unlike the scene stage, this frame reloads on every route change, so the
  // binding is keyed on frameNonce too.
  // biome-ignore lint/correctness/useExhaustiveDependencies: frameNonce re-binds to the reloaded document
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
      if (el === hovered || el.closest("[data-stillsmith-tour]")) return;
      clearHover();
      hovered = el;
      el.style.outline = HOVER_OUTLINE;
    };

    const onClick = (e: MouseEvent) => {
      if (!picking) return;
      e.preventDefault();
      e.stopPropagation();
      const el = e.target as Element;
      if (el.closest("[data-stillsmith-tour]")) return;
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
  }, [picking, onPick, frameNonce]);

  // Drag the step card to author its offset — the annotation drag, retargeted
  // at the tooltip. Buttons stay clickable; a grab anywhere else on the card
  // moves it. Handlers live on the document because the preview is torn down
  // and re-rendered on every offset tick.
  // biome-ignore lint/correctness/useExhaustiveDependencies: frameNonce re-binds to the reloaded document
  useEffect(() => {
    const frame = frameRef.current;
    const doc = frame?.contentDocument;
    if (!doc || !onOffsetChange || picking || playing) return;

    let drag: { startX: number; startY: number; dx: number; dy: number } | null = null;

    const onDown = (e: MouseEvent) => {
      const el = e.target as Element;
      if (el.closest("button")) return;
      const card = el.closest?.("[data-stillsmith-tour='tooltip']");
      if (!card) return;
      const offset = stepRef.current?.offset ?? {};
      drag = { startX: e.clientX, startY: e.clientY, dx: offset.dx ?? 0, dy: offset.dy ?? 0 };
      e.preventDefault();
      e.stopPropagation();
      if (doc.body) doc.body.style.cursor = "grabbing";
    };

    const onMove = (e: MouseEvent) => {
      if (!drag) return;
      e.preventDefault();
      onOffsetChange({
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
    window.addEventListener("mouseup", onUp, true);

    return () => {
      doc.removeEventListener("mousedown", onDown, true);
      doc.removeEventListener("mousemove", onMove, true);
      doc.removeEventListener("mouseup", onUp, true);
      window.removeEventListener("mouseup", onUp, true);
      if (doc.body) doc.body.style.cursor = "";
    };
  }, [picking, playing, onOffsetChange, frameNonce]);

  const onFrameLoad = useCallback(() => {
    setFrameNonce((n) => n + 1);
    try {
      const path = frameRef.current?.contentWindow?.location.pathname;
      if (path && path !== route) onRouteChange(path);
    } catch {
      // Cross-origin appUrl: the frame loaded, but we can't read its location.
    }
  }, [route, onRouteChange]);

  // Fit-to-panel scaling, same rules as the scene stage: never reflow the
  // frame, only transform it.
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
  const frameSrc = appUrl
    ? `${appUrl.replace(/\/$/, "")}${route.startsWith("/") ? route : `/${route}`}`
    : route;

  return (
    <div className="stage" ref={wrapRef}>
      <div className="stage-meta route-bar">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onRouteChange(routeDraft || "/");
          }}
        >
          <input
            value={routeDraft}
            onChange={(e) => setRouteDraft(e.target.value)}
            placeholder="/"
            aria-label="Route"
          />
          <button type="submit">go</button>
        </form>
        <span>
          {width}×{height}
          {scale < 1 && ` · ${Math.round(scale * 100)}%`}
          {playing && " · playing"}
          {appUrl && " · external"}
        </span>
      </div>
      <div className="stage-frame" style={{ width: width * scale, height: height * scale }}>
        <iframe
          ref={frameRef}
          title="app"
          src={frameSrc}
          width={width}
          height={height}
          onLoad={onFrameLoad}
          style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}
        />
      </div>
    </div>
  );
}
