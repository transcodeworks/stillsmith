import type { Scene, Shot } from "@stillsmith/capture/react";

import { TumblerDialog } from "@/components/TumblerDialog";
import { MALACHITE } from "@/data/rocks";

/**
 * A scene that renders *nothing* into `#root` — and must still be captured.
 *
 * Headless UI puts an open dialog through a portal onto `document.body`, so the
 * root stillsmith mounts into stays empty and the dialog is `position: fixed`.
 * Nothing is left in normal flow, which collapses `<html>` to zero height — and
 * that used to hang capture outright, because Playwright's `waitForSelector`
 * defaults to waiting for *visibility* and measured `<html>`'s empty box while
 * the readiness flag sat on it, set, for the full timeout.
 *
 * Keep this scene portal-only. Put anything behind the dialog and `<html>` gets
 * a height again, and it stops testing the thing it exists to test.
 */
export default {
  render: () => <TumblerDialog rock={MALACHITE} />,
} satisfies Scene;

export const Default: Shot = {};
