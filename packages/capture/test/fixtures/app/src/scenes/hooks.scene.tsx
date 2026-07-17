import type { Scene, Shot } from "@stillsmith/capture/react";
import { useEffect, useState } from "react";

/**
 * A scene component that calls hooks — which sounds like it tests nothing, and
 * tests something stillsmith got wrong for its whole life.
 *
 * If the page ends up with two React instances, react-dom hands the hook
 * dispatcher to one of them while this component reads it from the other, and
 * `useState` throws "Invalid hook call" before anything renders. That is exactly
 * what happened whenever a dependency was optimized late — which, with no
 * index.html for Vite's scanner to crawl and HMR off during capture, was always.
 *
 * The effect matters too: it proves the commit ran and effects flushed, not just
 * that the module evaluated.
 */
function Counter() {
  const [status, setStatus] = useState("effect did not run");
  useEffect(() => setStatus("effect ran"), []);

  return (
    <p data-shot="status" style={{ font: "14px/1.4 monospace" }}>
      {status}
    </p>
  );
}

export default {
  render: () => <Counter />,
} satisfies Scene;

export const Default: Shot = {};
