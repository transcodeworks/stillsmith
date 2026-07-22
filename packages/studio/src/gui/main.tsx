/**
 * Entry for the authoring GUI.
 *
 * This app is bundled at publish time with its own React and served as a static
 * asset — it is deliberately NOT compiled by the consumer's Vite. Their build
 * compiles their scenes (which is the whole point of merging their config); it
 * has no business also being load-bearing for stillsmith's own UI, and dragging our
 * React into their module graph is how you end up with two Reacts.
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { AuthorRoot } from "./Root.jsx";
import { STYLES } from "./styles.js";

const style = document.createElement("style");
style.textContent = STYLES;
document.head.appendChild(style);

const root = document.getElementById("root");
if (!root) throw new Error("stillsmith: no #root");

createRoot(root).render(
  <StrictMode>
    <AuthorRoot />
  </StrictMode>,
);
