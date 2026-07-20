import { registerTourFixtures, startTour } from "@stillsmith/tour";
import { StrictMode, useEffect, useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { Onboarding, Seeded } from "./tours/onboarding.tour.js";

/**
 * A deliberately tiny SPA with the two things a tour engine must survive:
 * a route change (hand-rolled history router — the tour's default adapter
 * dispatches popstate, which this listens for) and an async-mounted target.
 */

function navigate(path: string) {
  window.history.pushState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

/**
 * Specimens start empty — the "fresh project" a fixture exists to fill. Kept
 * outside React so a fixture can seed it before anything has mounted.
 */
const specimens = {
  ids: [] as string[],
  subs: new Set<() => void>(),
  get(): string[] {
    return specimens.ids;
  },
  subscribe(cb: () => void): () => void {
    specimens.subs.add(cb);
    return () => specimens.subs.delete(cb);
  },
  set(ids: string[]) {
    specimens.ids = ids;
    for (const cb of specimens.subs) cb();
  },
};

registerTourFixtures({
  "seed-specimens": {
    setup() {
      // Idempotent by construction: a resumed tour seeds the same list again.
      specimens.set(["obsidian"]);
      return () => specimens.set([]);
    },
  },
});

function Home() {
  const ids = useSyncExternalStore(specimens.subscribe, specimens.get);
  return (
    <main>
      <h1>Pebbles</h1>
      {ids.map((id) => (
        <article key={id} data-shot={`specimen-${id}`}>
          {id}
        </article>
      ))}
      <input data-shot="search" placeholder="Search rocks" />
      <button type="button" onClick={() => navigate("/settings")}>
        Settings
      </button>
      {/* Pinned to the bottom edge so a placement:"bottom" step must flip. */}
      <button type="button" data-shot="save" style={{ position: "fixed", bottom: 8, left: "50%" }}>
        Save
      </button>
    </main>
  );
}

function Settings() {
  // The tour's fourth step targets this panel; it mounts 600ms after the
  // route does, like any lazy pane — the engine has to outwait it.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 600);
    return () => clearTimeout(t);
  }, []);
  return (
    <main>
      <h1>Settings</h1>
      {ready && <section data-shot="theme">Theme: pebble grey</section>}
    </main>
  );
}

function App() {
  const [route, setRoute] = useState(window.location.pathname);
  useEffect(() => {
    const onPop = () => setRoute(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  return route === "/settings" ? <Settings /> : <Home />;
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("no #root");
createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// The e2e suite opts in per page-load; a bare visit stays quiet.
const wanted = new URLSearchParams(window.location.search).get("tour");
if (wanted === "seeded") startTour(Seeded);
else if (wanted !== null) startTour(Onboarding);
