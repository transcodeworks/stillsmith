import type { Scene, Shot } from "@stillsmith/capture/react";

import { RockShelf } from "@/components/RockShelf";
import { OBSIDIAN, ROCKS } from "@/data/rocks";

export default {
  render: () => (
    <div style={{ background: "var(--bg)", minHeight: "100vh" }}>
      <RockShelf rocks={ROCKS} selectedId={OBSIDIAN.id} />
    </div>
  ),
} satisfies Scene;

export const Default: Shot = {};

/** Cropped panel for the docs, with the selected card called out. */
export const Docs: Shot = {
  tags: ["docs"],
  presets: ["docs"],
  viewport: { width: 900, height: 560 },
  annotations: [
    {
      kind: "highlight",
      target: { selector: "[data-shot='rock-obsidian']" },
      dim: true,
      dimOpacity: 0.5,
      padding: 6,
    },
    {
      kind: "callout",
      target: { selector: "[data-shot='rock-obsidian']" },
      text: "Selected specimen.",
      placement: "right",
      maxWidth: 180,
    },
  ],
};
