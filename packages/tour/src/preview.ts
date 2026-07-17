/**
 * Static one-step preview: the authoring seam.
 *
 * The GUI's stage and the MCP `preview_step` tool render exactly what ships —
 * the same spotlight, the same tooltip — with the lifecycle stripped out: no
 * waiting, no advance triggers, no focus trap, no persistence. The buttons
 * render (they're part of the picture) but do nothing.
 */
import { resolveTarget } from "@stillsmith/annotate";
import { Spotlight } from "./overlay.js";
import { Tooltip, type TooltipLabels } from "./tooltip.js";
import type { Step, Tour, TourRoot } from "./types.js";

const noop = () => {};

export interface StepPreviewOptions {
  root?: TourRoot;
  /** Rendered position within the tour, for the "2 / 5" chip. */
  index?: number;
  total?: number;
  overlay?: Tour["overlay"];
  labels?: Partial<TooltipLabels>;
}

export interface StepPreview {
  warnings: string[];
  dispose(): void;
}

export function renderStepPreview(step: Step, options: StepPreviewOptions = {}): StepPreview {
  const root: TourRoot = options.root ?? { doc: document, win: window };
  const warnings: string[] = [];

  let anchor: Element | DOMRect | null = null;
  if (step.target) {
    const resolved = resolveTarget(step.target, root.doc);
    if (resolved.warning) warnings.push(resolved.warning);
    anchor = resolved.element ?? resolved.rect;
  }

  const spotlight = new Spotlight(root, options.overlay);
  spotlight.moveTo(
    anchor && "getBoundingClientRect" in anchor
      ? (anchor as Element).getBoundingClientRect()
      : (anchor as DOMRect | null),
    {
      padding: step.padding ?? 4,
      radius: step.radius ?? 8,
      animate: false,
    },
  );

  const tooltip = new Tooltip(root);
  const index = options.index ?? 0;
  tooltip.show(step, {
    index,
    total: options.total ?? index + 1,
    labels: { next: "Next", back: "Back", skip: "Skip", done: "Done", ...options.labels },
    anchor,
    interactive: (step.advance?.on ?? "next") !== "next",
    onNext: noop,
    onBack: noop,
    onSkip: noop,
  });

  return {
    warnings,
    dispose() {
      tooltip.destroy();
      spotlight.destroy();
    },
  };
}
