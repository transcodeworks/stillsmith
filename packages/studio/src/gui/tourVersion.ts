/**
 * Version skew between the previewed tour runtime and the shipped one.
 *
 * The GUI is a prebuilt static asset, so the step preview runs the
 * @stillsmith/tour that was bundled into it — while the consumer's app runs
 * whichever version they installed. Usually the same; when it isn't, the
 * rehearsal on the stage is not the tour their users will see, and tour mode
 * says so rather than quietly lying.
 */

/** Stamped by tsup at build time from studio's own @stillsmith/tour. */
declare const __BUNDLED_TOUR_VERSION__: string;

export const BUNDLED_TOUR_VERSION: string = __BUNDLED_TOUR_VERSION__;

/**
 * The warning to show, or null when there is nothing to say — the versions
 * match, or the project has no @stillsmith/tour for the server to report.
 */
export function tourVersionWarning(installed: string | undefined): string | null {
  if (!installed || installed === BUNDLED_TOUR_VERSION) return null;
  return (
    `This preview runs @stillsmith/tour ${BUNDLED_TOUR_VERSION}, bundled into the studio, ` +
    `but your project installs ${installed}. What you rehearse here may not be what your app ` +
    "renders — align the versions to be sure."
  );
}
