/**
 * Engine behaviour in jsdom: sequencing, advance triggers, persistence,
 * teardown. Geometry (cutout boxes, flip) needs real layout and is asserted
 * by stillsmith's e2e suite in a real browser.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTour } from "../src/engine.js";
import type { RouterAdapter, StorageLike, Tour } from "../src/types.js";

function memoryStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

function fakeRouter(initial = "/"): RouterAdapter & { navigate: ReturnType<typeof vi.fn> } {
  let path = initial;
  const subs = new Set<(p: string) => void>();
  return {
    navigate: vi.fn((p: string) => {
      path = p;
      for (const cb of subs) cb(p);
    }),
    current: () => path,
    onRouteChange: (cb) => {
      subs.add(cb);
      return () => subs.delete(cb);
    },
  };
}

/** The engine settles between async stages; let real timers drain them. */
const settle = (ms = 80) => new Promise((r) => setTimeout(r, ms));

const query = (name: string) =>
  document.querySelector<HTMLElement>(`[data-stillsmith-tour='${name}']`);

const TOUR: Tour = {
  id: "onboarding",
  steps: [
    { title: "Welcome", body: "A centered step." },
    { target: { selector: "#search" }, body: "Search here." },
    { target: { selector: "#save" }, body: "Now save.", advance: { on: "click" } },
  ],
};

describe("tour engine", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <input id="search" />
      <button id="save">Save</button>
    `;
  });
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("walks the steps and completes", async () => {
    const storage = memoryStorage();
    const onFinish = vi.fn();
    const tour = createTour(TOUR, { router: fakeRouter(), storage, onFinish });

    tour.start();
    await settle();
    expect(tour.active).toBe(true);
    expect(query("body")?.textContent).toBe("A centered step.");
    // A centered step has no hole to click through; the scrim is full.
    expect(query("overlay")).not.toBeNull();

    query("next")?.click();
    await settle();
    expect(query("body")?.textContent).toBe("Search here.");
    expect(tour.stepIndex).toBe(1);

    query("back")?.click();
    await settle();
    expect(tour.stepIndex).toBe(0);

    tour.goTo(2);
    await settle();
    // Interactive step: no Next button except on the last step, which this is —
    // so "Done" renders alongside the click-to-advance.
    expect(query("body")?.textContent).toBe("Now save.");

    document.querySelector<HTMLElement>("#save")?.click();
    await settle();
    expect(tour.active).toBe(false);
    expect(onFinish).toHaveBeenCalled();
    expect(JSON.parse(storage.map.get("stillsmith-tour:onboarding") ?? "{}")).toMatchObject({
      status: "completed",
    });
    expect(query("tooltip")).toBeNull();
    expect(query("overlay")).toBeNull();
  });

  it("dismisses on Escape and persists it", async () => {
    const storage = memoryStorage();
    const onDismiss = vi.fn();
    const tour = createTour(TOUR, { router: fakeRouter(), storage, onDismiss });
    tour.start();
    await settle();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await settle();
    expect(tour.active).toBe(false);
    expect(onDismiss).toHaveBeenCalledWith(0);
    expect(JSON.parse(storage.map.get("stillsmith-tour:onboarding") ?? "{}")).toMatchObject({
      status: "dismissed",
      step: 0,
    });
  });

  it("does not restart a completed or dismissed tour", async () => {
    const storage = memoryStorage();
    storage.setItem(
      "stillsmith-tour:onboarding",
      JSON.stringify({ status: "dismissed", step: 1, at: "" }),
    );
    const tour = createTour(TOUR, { router: fakeRouter(), storage });
    tour.start();
    await settle();
    expect(tour.active).toBe(false);
    expect(query("tooltip")).toBeNull();
  });

  it("resumes an active tour at the persisted step", async () => {
    const storage = memoryStorage();
    storage.setItem(
      "stillsmith-tour:onboarding",
      JSON.stringify({ status: "active", step: 1, at: "" }),
    );
    const tour = createTour(TOUR, { router: fakeRouter(), storage });
    tour.start();
    await settle();
    expect(tour.stepIndex).toBe(1);
    expect(query("body")?.textContent).toBe("Search here.");
    tour.destroy();
  });

  it("an explicit start(0) clears prior progress", async () => {
    const storage = memoryStorage();
    storage.setItem(
      "stillsmith-tour:onboarding",
      JSON.stringify({ status: "completed", step: 2, at: "" }),
    );
    const tour = createTour(TOUR, { router: fakeRouter(), storage });
    tour.start(0);
    await settle();
    expect(tour.active).toBe(true);
    expect(tour.stepIndex).toBe(0);
    tour.destroy();
  });

  it("skips an optional step whose target never resolves", async () => {
    const tour = createTour(
      {
        id: "t",
        steps: [
          { target: { selector: "#missing" }, body: "never", optional: true },
          { target: { selector: "#search" }, body: "found" },
        ],
      },
      { router: fakeRouter(), storage: null, waitTimeoutMs: 100 },
    );
    tour.start();
    await settle(400);
    expect(tour.active).toBe(true);
    expect(query("body")?.textContent).toBe("found");
    tour.destroy();
  });

  it("ends the tour on a required missing target, without persisting a verdict", async () => {
    const storage = memoryStorage();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const tour = createTour(
      { id: "t", steps: [{ target: { selector: "#missing" }, body: "never" }] },
      { router: fakeRouter(), storage, waitTimeoutMs: 100 },
    );
    tour.start();
    await settle(400);
    expect(tour.active).toBe(false);
    expect(warn).toHaveBeenCalled();
    // Still "active" in storage: the tour tries again next load instead of
    // being remembered as dismissed by a user who never saw it.
    expect(JSON.parse(storage.map.get("stillsmith-tour:t") ?? "{}")).toMatchObject({
      status: "active",
    });
    warn.mockRestore();
  });

  it("navigates to a step's route before waiting for its target", async () => {
    const router = fakeRouter("/");
    const el = document.createElement("div");
    el.id = "on-settings";
    // The element only "mounts" once the route changes, like a real SPA.
    router.onRouteChange((p) => {
      if (p === "/settings") document.body.appendChild(el);
    });
    const tour = createTour(
      {
        id: "t",
        steps: [{ target: { selector: "#on-settings" }, body: "here", route: "/settings" }],
      },
      { router, storage: null },
    );
    tour.start();
    await settle(400);
    expect(router.navigate).toHaveBeenCalledWith("/settings");
    expect(query("body")?.textContent).toBe("here");
    tour.destroy();
  });

  it("advances when the app reaches an advance route", async () => {
    const router = fakeRouter("/");
    const tour = createTour(
      {
        id: "t",
        steps: [
          {
            target: { selector: "#search" },
            body: "go to settings",
            advance: { on: "route", path: "/settings" },
          },
          { body: "made it" },
        ],
      },
      { router, storage: null },
    );
    tour.start();
    await settle();
    expect(query("body")?.textContent).toBe("go to settings");

    router.navigate("/settings");
    await settle();
    expect(query("body")?.textContent).toBe("made it");
    tour.destroy();
  });

  it("destroy() removes every node and stops persisting", async () => {
    const storage = memoryStorage();
    const tour = createTour(TOUR, { router: fakeRouter(), storage });
    tour.start();
    await settle();
    tour.destroy();
    expect(document.querySelectorAll("[data-stillsmith-tour]").length).toBe(0);
    // Progress stays "active" — destroy is teardown, not a decision.
    expect(JSON.parse(storage.map.get("stillsmith-tour:onboarding") ?? "{}")).toMatchObject({
      status: "active",
    });
  });

  it("start() while active is a no-op", async () => {
    const tour = createTour(TOUR, { router: fakeRouter(), storage: null });
    tour.start();
    await settle();
    tour.next();
    await settle();
    tour.start();
    await settle();
    expect(tour.stepIndex).toBe(1);
    tour.destroy();
  });
});
