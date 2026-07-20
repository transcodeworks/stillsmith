/**
 * Pebble as a runnable app — the demo bed for @stillsmith/tour.
 *
 * The scenes photograph the components with fixture props; this entry wires
 * the same components up with state and two hand-rolled routes, and mounts
 * the onboarding tour. `stillsmith dev` serves this at `/` and the authoring
 * GUI at `/__stillsmith/author`, so the tours mode edits this very app.
 */
import { registerTourFixtures, startTour } from "@stillsmith/tour";
import { StrictMode, useEffect, useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";

import { RockInspector } from "@/components/RockInspector";
import { RockShelf } from "@/components/RockShelf";
import { Toolbar } from "@/components/Toolbar";
import { DEMO_ROCKS, ROCKS } from "@/data/rocks";
import { shelfStore } from "@/data/shelf-store";
import { Onboarding } from "@/tours/onboarding.tour";
import "@/theme.css";

/**
 * What `fixture: "demo-rocks"` in the tour file means here.
 *
 * Registered at module scope because the tour starts below, before React has
 * mounted anything — a fixture registered in an effect would be too late.
 */
registerTourFixtures({
  "demo-rocks": {
    setup() {
      shelfStore.add(DEMO_ROCKS);
      return () => shelfStore.remove(DEMO_ROCKS.map((r) => r.id));
    },
  },
});

function navigate(path: string) {
  window.history.pushState(null, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

function Settings() {
  return (
    <main style={{ padding: 24, display: "grid", gap: 16, alignContent: "start" }}>
      <h2 style={{ margin: 0 }}>Settings</h2>
      <section
        data-shot="theme"
        style={{
          padding: 16,
          borderRadius: 12,
          background: "var(--panel)",
          border: "1px solid var(--line)",
          maxWidth: 420,
        }}
      >
        <strong>Theme</strong>
        <p style={{ color: "var(--muted)", margin: "6px 0 0" }}>
          Pebble grey, obsidian dark, or quartz light.
        </p>
      </section>
      <button type="button" onClick={() => navigate("/")} style={{ justifySelf: "start" }}>
        ← back to the shelf
      </button>
    </main>
  );
}

function Shelf() {
  const rocks = useSyncExternalStore(shelfStore.subscribe, shelfStore.get);
  const [selectedId, setSelectedId] = useState(ROCKS[1]?.id ?? "");
  const selected = rocks.find((r) => r.id === selectedId) ?? rocks[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <Toolbar />
      <div style={{ display: "flex", flex: 1, minHeight: 0 }}>
        <main style={{ flex: 1, overflow: "auto" }}>
          <RockShelf rocks={rocks} selectedId={selectedId} onSelect={setSelectedId} />
        </main>
        {selected && <RockInspector rock={selected} />}
      </div>
      <button
        type="button"
        onClick={() => startTour(Onboarding, { storage: null })}
        style={{
          position: "fixed",
          right: 16,
          bottom: 16,
          padding: "8px 14px",
          borderRadius: 999,
          border: "1px solid var(--line)",
          background: "var(--accent)",
          color: "var(--accent-fg)",
          cursor: "pointer",
        }}
      >
        ↻ take the tour
      </button>
      <button
        type="button"
        onClick={() => navigate("/settings")}
        style={{
          position: "fixed",
          left: 16,
          bottom: 16,
          padding: "8px 14px",
          borderRadius: 999,
          border: "1px solid var(--line)",
          background: "var(--panel)",
          color: "inherit",
          cursor: "pointer",
        }}
      >
        settings
      </button>
    </div>
  );
}

function App() {
  const [route, setRoute] = useState(window.location.pathname);
  useEffect(() => {
    const onPop = () => setRoute(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  return route === "/settings" ? <Settings /> : <Shelf />;
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("no #root");
createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// First visit gets the tour; persistence keeps it quiet afterwards. The
// floating button re-runs it on demand (with persistence off).
startTour(Onboarding);
