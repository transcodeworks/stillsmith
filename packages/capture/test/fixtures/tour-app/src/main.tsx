import { startTour } from "@stillsmith/tour";
import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Onboarding } from "./tours/onboarding.tour.js";

/**
 * A deliberately tiny SPA with the two things a tour engine must survive:
 * a route change (hand-rolled history router — the tour's default adapter
 * dispatches popstate, which this listens for) and an async-mounted target.
 */

function navigate(path: string) {
  window.history.pushState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function Home() {
  return (
    <main>
      <h1>Pebbles</h1>
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
if (new URLSearchParams(window.location.search).has("tour")) {
  startTour(Onboarding);
}
