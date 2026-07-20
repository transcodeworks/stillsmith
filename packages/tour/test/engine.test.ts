/**
 * Engine behaviour in jsdom: sequencing, advance triggers, persistence,
 * teardown. Geometry (cutout boxes, flip) needs real layout and is asserted
 * by stillsmith's e2e suite in a real browser.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTour } from "../src/engine.js";
import { registerTourFixtures } from "../src/fixtures.js";
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

describe("tour fixtures", () => {
  /** A tour whose only step targets an element the fixture has to create. */
  const SEEDED: Tour = {
    id: "seeded",
    fixture: "demo",
    steps: [{ target: { selector: "#seeded" }, body: "Seeded data." }],
  };

  /** Appends the element `SEEDED` points at, and removes it on cleanup. */
  function seedFixture() {
    const setup = vi.fn(() => {
      const el = document.createElement("div");
      el.id = "seeded";
      document.body.append(el);
      return () => el.remove();
    });
    return { setup };
  }

  afterEach(() => {
    document.body.innerHTML = "";
    // The registry is a window property; one test's handlers must not answer
    // the next test's lookups.
    delete (window as { __stillsmithTourFixtures?: unknown }).__stillsmithTourFixtures;
  });

  it("seeds before the first step and undoes it on completion", async () => {
    const fixture = seedFixture();
    const tour = createTour(SEEDED, {
      router: fakeRouter(),
      storage: null,
      fixtures: { demo: fixture },
      waitTimeoutMs: 200,
    });

    tour.start();
    await settle();
    expect(fixture.setup).toHaveBeenCalledTimes(1);
    // The step resolved against an element that only the fixture created.
    expect(query("body")?.textContent).toBe("Seeded data.");
    expect(document.querySelector("#seeded")).not.toBeNull();

    tour.next(); // past the last step: completes
    await settle();
    expect(tour.active).toBe(false);
    expect(document.querySelector("#seeded")).toBeNull();
  });

  it.each([
    ["stop()", (t: ReturnType<typeof createTour>) => t.stop()],
    ["destroy()", (t: ReturnType<typeof createTour>) => t.destroy()],
    [
      "Escape",
      () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })),
    ],
  ])("undoes the fixture when the tour ends via %s", async (_label, end) => {
    const fixture = seedFixture();
    const tour = createTour(SEEDED, {
      router: fakeRouter(),
      storage: null,
      fixtures: { demo: fixture },
      waitTimeoutMs: 200,
    });
    tour.start();
    await settle();

    end(tour);
    await settle();
    expect(document.querySelector("#seeded")).toBeNull();
  });

  it("undoes the fixture exactly once", async () => {
    const cleanup = vi.fn();
    const tour = createTour(SEEDED, {
      router: fakeRouter(),
      storage: null,
      fixtures: { demo: { setup: () => cleanup } },
      waitTimeoutMs: 200,
    });
    tour.start();
    await settle();

    tour.stop();
    tour.destroy();
    tour.destroy();
    await settle();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("keeps the fixture up across step changes", async () => {
    const cleanup = vi.fn();
    const tour = createTour(
      { ...SEEDED, steps: [{ body: "one" }, { body: "two" }] },
      { router: fakeRouter(), storage: null, fixtures: { demo: { setup: () => cleanup } } },
    );
    tour.start();
    await settle();
    tour.next();
    await settle();
    tour.back();
    await settle();
    expect(cleanup).not.toHaveBeenCalled();
    tour.destroy();
  });

  it("waits for an async setup before showing the first step", async () => {
    const tour = createTour(SEEDED, {
      router: fakeRouter(),
      storage: null,
      waitTimeoutMs: 400,
      fixtures: {
        demo: {
          setup: async () => {
            await new Promise((r) => setTimeout(r, 120));
            const el = document.createElement("div");
            el.id = "seeded";
            document.body.append(el);
          },
        },
      },
    });

    tour.start();
    await settle(40);
    expect(query("tooltip")).toBeNull(); // still seeding
    await settle(300);
    expect(query("body")?.textContent).toBe("Seeded data.");
    tour.destroy();
  });

  it("prefers a cleanup returned by setup over the teardown handler", async () => {
    const returned = vi.fn();
    const teardown = vi.fn();
    const tour = createTour(
      { ...SEEDED, steps: [{ body: "one" }] },
      {
        router: fakeRouter(),
        storage: null,
        fixtures: { demo: { setup: () => returned, teardown } },
      },
    );
    tour.start();
    await settle();
    tour.stop();
    await settle();
    expect(returned).toHaveBeenCalledTimes(1);
    expect(teardown).not.toHaveBeenCalled();
  });

  it("falls back to the teardown handler when setup returns nothing", async () => {
    const teardown = vi.fn();
    const tour = createTour(
      { ...SEEDED, steps: [{ body: "one" }] },
      {
        router: fakeRouter(),
        storage: null,
        fixtures: { demo: { setup: () => {}, teardown } },
      },
    );
    tour.start();
    await settle();
    tour.stop();
    await settle();
    expect(teardown).toHaveBeenCalledTimes(1);
    // The context names the tour, so one handler can serve several.
    expect(teardown.mock.calls[0]?.[0]).toMatchObject({ tourId: "seeded" });
  });

  it("ends the tour on an unregistered fixture, persisting nothing", async () => {
    const storage = memoryStorage();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const tour = createTour(SEEDED, { router: fakeRouter(), storage });

    tour.start();
    await settle();
    expect(tour.active).toBe(false);
    expect(warn.mock.calls[0]?.[0]).toContain("not registered");
    // Nothing was written at all: setup runs before the first step persists, so
    // a misconfigured app doesn't burn the tour's one shot.
    expect(storage.map.size).toBe(0);
    warn.mockRestore();
  });

  it("ends the tour when setup throws, persisting nothing", async () => {
    const storage = memoryStorage();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const tour = createTour(SEEDED, {
      router: fakeRouter(),
      storage,
      fixtures: {
        demo: {
          setup: () => {
            throw new Error("no database");
          },
        },
      },
    });

    tour.start();
    await settle();
    expect(tour.active).toBe(false);
    expect(warn.mock.calls[0]?.[0]).toContain("no database");
    expect(storage.map.size).toBe(0);
    warn.mockRestore();
  });

  it("warns but keeps going when teardown fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const tour = createTour(
      { ...SEEDED, steps: [{ body: "one" }] },
      {
        router: fakeRouter(),
        storage: null,
        fixtures: {
          demo: {
            setup: () => () => {
              throw new Error("cleanup exploded");
            },
          },
        },
      },
    );
    tour.start();
    await settle();
    expect(() => tour.stop()).not.toThrow();
    await settle();
    expect(warn.mock.calls.at(-1)?.[0]).toContain("cleanup exploded");
    warn.mockRestore();
  });

  it("seeds again when a tour resumes mid-way", async () => {
    const storage = memoryStorage();
    storage.map.set("stillsmith-tour:seeded", JSON.stringify({ status: "active", step: 1, at: 0 }));
    const fixture = seedFixture();
    const tour = createTour(
      { ...SEEDED, steps: [{ body: "one" }, { target: { selector: "#seeded" }, body: "two" }] },
      { router: fakeRouter(), storage, fixtures: { demo: fixture }, waitTimeoutMs: 200 },
    );

    tour.start();
    await settle();
    expect(fixture.setup).toHaveBeenCalledTimes(1);
    expect(tour.stepIndex).toBe(1);
    expect(query("body")?.textContent).toBe("two");
    tour.destroy();
  });

  it("leaves nothing behind when the tour is destroyed mid-setup", async () => {
    const cleanup = vi.fn();
    const tour = createTour(SEEDED, {
      router: fakeRouter(),
      storage: null,
      fixtures: {
        demo: {
          setup: async () => {
            await new Promise((r) => setTimeout(r, 100));
            return cleanup;
          },
        },
      },
    });

    tour.start();
    await settle(20);
    tour.destroy(); // seeding is still in flight
    await settle(200);
    // The seed landed after the tour ended, so the engine undid it anyway.
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(query("tooltip")).toBeNull();
  });

  it("prefers option fixtures over the window registry", async () => {
    const registered = vi.fn();
    const passed = vi.fn();
    registerTourFixtures({ demo: { setup: registered } }, window);
    const tour = createTour(
      { ...SEEDED, steps: [{ body: "one" }] },
      { router: fakeRouter(), storage: null, fixtures: { demo: { setup: passed } } },
    );

    tour.start();
    await settle();
    expect(passed).toHaveBeenCalledTimes(1);
    expect(registered).not.toHaveBeenCalled();
    tour.destroy();
  });

  it("falls back to the window registry when no option is passed", async () => {
    const fixture = seedFixture();
    registerTourFixtures({ demo: fixture }, window);
    const tour = createTour(SEEDED, {
      router: fakeRouter(),
      storage: null,
      waitTimeoutMs: 200,
    });

    tour.start();
    await settle();
    expect(fixture.setup).toHaveBeenCalledTimes(1);
    expect(query("body")?.textContent).toBe("Seeded data.");
    tour.destroy();
  });

  it("never seeds a tour the user already finished", async () => {
    const storage = memoryStorage();
    storage.map.set(
      "stillsmith-tour:seeded",
      JSON.stringify({ status: "completed", step: 0, at: 0 }),
    );
    const fixture = seedFixture();
    const tour = createTour(SEEDED, {
      router: fakeRouter(),
      storage,
      fixtures: { demo: fixture },
    });

    tour.start();
    await settle();
    expect(fixture.setup).not.toHaveBeenCalled();
  });
});
