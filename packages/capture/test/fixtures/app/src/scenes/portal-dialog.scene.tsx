import { Dialog, DialogPanel, DialogTitle } from "@headlessui/react";
import type { Scene, Shot } from "@stillsmith/capture/react";

/**
 * Renders nothing into `#root`.
 *
 * Headless UI portals an open dialog onto `document.body` and positions it
 * `fixed`, so nothing is left in normal flow and `<html>` collapses to zero
 * height. Playwright's `waitForSelector` defaults to waiting for *visibility*,
 * which measures that empty box — so capture used to sit out its whole timeout
 * on a readiness flag that was set the entire time.
 *
 * Keep this portal-only. Render anything alongside the dialog and `<html>` has a
 * height again, and the test stops testing.
 */
export default {
  render: () => (
    <Dialog open onClose={() => {}}>
      <DialogPanel
        data-shot="panel"
        style={{
          position: "fixed",
          inset: "50% auto auto 50%",
          transform: "translate(-50%, -50%)",
          padding: 16,
          border: "2px solid #4f46e5",
          background: "#eef2ff",
          color: "#14171c",
          font: "14px/1.4 monospace",
        }}
      >
        <DialogTitle style={{ margin: 0 }}>Portal only</DialogTitle>
      </DialogPanel>
    </Dialog>
  ),
} satisfies Scene;

export const Default: Shot = {};

/**
 * The same portal-only scene, annotated.
 *
 * Annotations settle by awaiting two animation frames inside `page.evaluate`,
 * which has no timeout of its own — so on a page that never produces a frame
 * this shot hangs capture forever rather than failing it.
 */
export const Annotated: Shot = {
  annotations: [{ kind: "outline", target: { selector: "[data-shot='panel']" }, padding: 4 }],
};
