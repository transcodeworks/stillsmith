/**
 * The shell that swaps workbenches: shots (scene stage, annotations) or
 * tours (app stage, steps). Two parallel apps rather than one with forked
 * internals — they share the field controls, the API client, and the save
 * discipline, but their stages and selection models genuinely differ.
 */
import { useState } from "react";

import { App, type AppProps } from "./App.jsx";
import { ToursApp } from "./ToursApp.jsx";

type Mode = "shots" | "tours";

const MODE_KEY = "stillsmith-author-mode";

function initialMode(): Mode {
  try {
    return window.localStorage.getItem(MODE_KEY) === "tours" ? "tours" : "shots";
  } catch {
    return "shots";
  }
}

export function AuthorRoot(props: AppProps = {}) {
  const [mode, setMode] = useState<Mode>(initialMode);

  const switchTo = (next: Mode) => {
    setMode(next);
    try {
      window.localStorage.setItem(MODE_KEY, next);
    } catch {
      // Preference only; losing it costs one click.
    }
  };

  const toggle = (
    <div className="mode-toggle" role="tablist" aria-label="Editing mode">
      <button
        type="button"
        role="tab"
        aria-selected={mode === "shots"}
        className={mode === "shots" ? "on" : ""}
        onClick={() => switchTo("shots")}
      >
        shots
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "tours"}
        className={mode === "tours" ? "on" : ""}
        onClick={() => switchTo("tours")}
      >
        tours
      </button>
    </div>
  );

  return mode === "tours" ? (
    <ToursApp modeToggle={toggle} />
  ) : (
    <App {...props} modeToggle={toggle} />
  );
}
