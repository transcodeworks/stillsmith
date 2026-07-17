/**
 * Naming and shape rules for `*.tour.ts` files — the tours counterpart of
 * scene-utils. Deliberately structural: a tour is any named export that is a
 * plain object with a `steps` array, checked by shape rather than by
 * importing @stillsmith/tour, so discovery works before the consumer has even
 * installed the runtime. (`satisfies Tour` is type-only and erases.)
 */
import type { Tour } from "@stillsmith/tour";
import { shotNameFromExport } from "./scene-utils.js";

export interface TourModule {
  [exportName: string]: unknown;
}

export interface ResolvedTour {
  /** The named export it came from — what the codemod edits. */
  exportName: string;
  /** `tour.id`, defaulting to the kebab-cased export name. */
  id: string;
  tour: Tour;
}

/** `Onboarding` → `onboarding`; same kebab rule as shots. */
export const tourIdFromExport = shotNameFromExport;

/**
 * Every named export that looks like a tour, is one. Anything else in the
 * file (helpers, fixtures) is ignored — same contract as scene files.
 */
export function readTours(mod: TourModule): ResolvedTour[] {
  const tours: ResolvedTour[] = [];

  for (const [exportName, value] of Object.entries(mod)) {
    if (exportName === "default") continue;
    if (value === null || typeof value !== "object" || Array.isArray(value)) continue;
    if (!Array.isArray((value as { steps?: unknown }).steps)) continue;

    const tour = value as Tour;
    tours.push({ exportName, id: tour.id ?? tourIdFromExport(exportName), tour });
  }
  return tours;
}
