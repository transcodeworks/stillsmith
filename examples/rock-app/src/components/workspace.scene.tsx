import type { Scene, Shot } from "@stillsmith/capture/react";

import { Workspace } from "@/components/Workspace";
import { AMETHYST, ROCKS } from "@/data/rocks";

export default {
  render: () => <Workspace rocks={ROCKS} selected={AMETHYST} />,
} satisfies Scene;

/** The plain hero shot. */
export const Default: Shot = {};

/** The annotated tour used on the docs home page. */
export const Tour: Shot = {
  tags: ["docs"],
  presets: ["docs"],
  annotations: [
    {
      kind: "label",
      target: { selector: "[data-shot='search']" },
      badge: 1,
      anchor: "top-left",
      // Nudged inward: the toolbar sits flush against the top edge, so a pin
      // centred on its corner would be half off-canvas.
      offset: { dx: 4, dy: 12 },
    },
    {
      kind: "outline",
      target: { selector: "[data-shot='search']" },
      padding: 4,
    },
    {
      kind: "label",
      target: { selector: "[data-shot='shelf']" },
      badge: 2,
      anchor: "top-left",
      offset: { dx: 34, dy: 26 },
      color: "success",
    },
    {
      kind: "callout",
      target: { selector: "[data-shot='inspector']" },
      text: "The inspector edits the selected specimen.",
      badge: 3,
      placement: "left",
      maxWidth: 220,
      offset: { dy: -120 },
    },
  ],
};
