/**
 * The React binding. The only file in the package that imports React, and it
 * imports it as a peer — the runtime itself is framework-neutral.
 */
import { useEffect, useRef } from "react";
import { createTour } from "../engine.js";
import type { Tour, TourController, TourOptions } from "../types.js";

/**
 * A stable controller for `tour`, destroyed on unmount.
 *
 * The tour definition and options are captured on first render — a tour is
 * static data, not reactive state. Remount (`key`) to swap tours.
 */
export function useTour(tour: Tour, options?: TourOptions): TourController {
  const ref = useRef<TourController | null>(null);
  ref.current ??= createTour(tour, options);

  useEffect(() => {
    // Destroy without nulling the ref: under StrictMode's simulated remount
    // the effect re-runs on the same instance, and a destroyed controller can
    // simply be started again.
    return () => ref.current?.destroy();
  }, []);

  return ref.current;
}

/**
 * Start `tour` on mount. Persistence still applies: a completed or dismissed
 * tour stays quiet, so this is safe to leave mounted for every visitor.
 */
export function TourAutoStart({ tour, options }: { tour: Tour; options?: TourOptions }): null {
  const controller = useTour(tour, options);
  useEffect(() => {
    controller.start();
  }, [controller]);
  return null;
}
