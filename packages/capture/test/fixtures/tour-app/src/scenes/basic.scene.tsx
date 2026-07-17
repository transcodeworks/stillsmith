import type { Scene, Shot } from "@stillsmith/capture/react";

/** A minimal scene: the stillsmith config requires one, and the author-mode e2e
 * needs both modes present in one project. */
export default {
  id: "basic",
  render: () => (
    <button type="button" data-shot="basic-button">
      A button
    </button>
  ),
} satisfies Scene;

export const Default: Shot = {};
