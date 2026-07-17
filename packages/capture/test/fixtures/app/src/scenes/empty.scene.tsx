import type { Scene, Shot } from "@stillsmith/capture/react";

/**
 * A scene that renders nothing at all, and must still become ready.
 *
 * Readiness used to be signalled from inside a double `requestAnimationFrame`,
 * and a frame is not something the page owes us — the compositor produces one
 * when it has a reason to. Nothing here is a reason. The runtime's timer backstop
 * is what keeps this from being a 15-second hang.
 */
export default {
  render: () => null,
} satisfies Scene;

export const Default: Shot = {};
