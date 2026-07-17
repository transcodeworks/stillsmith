/**
 * stillsmith, photographed by stillsmith.
 *
 * The docs need a screenshot of the authoring GUI, and the whole argument of this
 * package is that a hand-taken screenshot goes stale. So the GUI gets a scene like
 * anything else — it renders the *real* `App` from stillsmith's source, and because a
 * capture runs on a real stillsmith dev server, the App's `fetch` hits the real
 * `/__stillsmith/api` and its iframe loads a real scene. Nothing here is mocked: if
 * the GUI changes, this screenshot changes with it.
 *
 * It reaches into stillsmith's source by relative path. That's a liberty only
 * available because we're inside stillsmith's own monorepo — the authoring GUI is not
 * a public export, and shouldn't be.
 */
import type { Scene, Shot } from "@stillsmith/capture/react";

import { App } from "../../../../packages/capture/src/author/App";
import { STYLES } from "../../../../packages/capture/src/author/styles";

export default {
  id: "stillsmith-authoring",
  render: () => (
    <>
      {/* main.tsx normally injects these; we mount App directly, so we do it. */}
      <style>{STYLES}</style>
      <App initialScene="workspace" initialShot="Tour" initialPreset="docs" initialAnnotation={3} />
    </>
  ),
} satisfies Scene;

export const Docs: Shot = {
  tags: ["docs"],
  presets: ["docs"],
  // The GUI fetches its state, then loads the scene into an iframe, then waits
  // for that scene to signal ready before drawing annotations. Three round trips.
  delay: 2500,
};
