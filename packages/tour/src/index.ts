/**
 * @stillsmith/tour — guided onboarding tours, defined as code.
 *
 * Tours are plain objects (`satisfies Tour`) that live in your repo,
 * type-checked and PR-reviewed; stillsmith's editor authors them visually and
 * writes the source back. This package is only the runtime: small,
 * framework-neutral, two dependencies (@floating-ui/dom and the shared
 * @stillsmith/annotate target model).
 */
export { createTour, startTour } from "./engine.js";
export { renderStepPreview, type StepPreview, type StepPreviewOptions } from "./preview.js";
export { createHistoryRouter } from "./router.js";
export type { TourProgress, TourStatus } from "./storage.js";
export type {
  Advance,
  Placement,
  RouterAdapter,
  Step,
  StorageLike,
  Tour,
  TourController,
  TourOptions,
  TourRoot,
} from "./types.js";
