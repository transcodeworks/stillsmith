import type { Scene, Shot } from "@stillsmith/capture/react";

/**
 * An image that answers long after the scene is ready.
 *
 * Readiness fires once React commits and the paint settles; at that moment an
 * `<img>` is an element with a `src` nobody has fetched yet. So a scene with
 * images is ready well before it is finished, and without the image gate in
 * `withScenePage` the shutter falls on the placeholder underneath.
 *
 * That is what the placeholder is for. A missing image renders as nothing at
 * all, which is conspicuous; a *plausible* stand-in is the actual failure mode
 * worth pinning — the ungated screenshot looks fine and is silently wrong.
 *
 * The delay lives in the fixture's vite config, not here.
 */
export default {
  render: () => (
    <div
      data-shot="frame"
      style={{
        width: 200,
        height: 120,
        background: "#4f46e5",
        overflow: "hidden",
      }}
    >
      <img
        data-shot="slow"
        src="/slow-image.png"
        alt=""
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
    </div>
  ),
} satisfies Scene;

export const Default: Shot = {};
