import type { Scene, Shot } from "@stillsmith/capture/react";

/**
 * Imports cleanly in Node, throws in the browser.
 *
 * That asymmetry is the point: discovery (`ssrLoadModule`) has to succeed, so the
 * failure lands where it used to be invisible — rejecting the runtime's dynamic
 * import of the scene. A rejected promise is not a `pageerror`, so capture saw
 * nothing at all and could only report a bare timeout. It must now report *this*
 * message.
 *
 * The guard is what makes it browser-only. Don't remove it, or the scene fails at
 * discovery instead and the test stops covering the interesting path.
 */
if (typeof window !== "undefined") {
  throw new Error("scene exploded on import");
}

export default {
  render: () => <div />,
} satisfies Scene;

export const Default: Shot = {};
