import type { Scene, Shot } from "@stillsmith/capture/react";

import { RockInspector } from "@/components/RockInspector";
import { AMETHYST } from "@/data/rocks";

export default {
  render: () => (
    <div style={{ display: "flex", justifyContent: "flex-end", height: "100vh" }}>
      <RockInspector rock={AMETHYST} />
    </div>
  ),
} satisfies Scene;

/** One panel, one preset — the narrow shot the docs embed inline. */
export const Docs: Shot = {
  tags: ["docs"],
  presets: ["docs"],
  viewport: { width: 340, height: 620 },
};

export const Annotated: Shot = {
  tags: ["docs"],
  presets: ["docs"],
  viewport: { width: 640, height: 620 },
  annotations: [
    {
      kind: "callout",
      target: { selector: "[data-shot='polish']" },
      text: "This action is irreversible.",
      color: "warning",
      placement: "left",
      maxWidth: 190,
      offset: { dx: -24, dy: -44 },
    },
  ],
};
