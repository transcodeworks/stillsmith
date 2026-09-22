import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * `__BUNDLED_TOUR_VERSION__` is a tsup `define`, stamped into the GUI bundle at
 * build time. Under vitest nothing stamps it, so stub the global before the
 * module is evaluated: it reads the constant at import.
 */
const BUNDLED = "1.2.3";

let tourVersionWarning: typeof import("../../src/gui/tourVersion.js").tourVersionWarning;

beforeAll(async () => {
  vi.stubGlobal("__BUNDLED_TOUR_VERSION__", BUNDLED);
  ({ tourVersionWarning } = await import("../../src/gui/tourVersion.js"));
});

afterAll(() => {
  vi.unstubAllGlobals();
});

describe("tourVersionWarning", () => {
  it("is silent when the installed version matches the bundled one", () => {
    expect(tourVersionWarning(BUNDLED)).toBeNull();
  });

  it("is silent when the project installs no @stillsmith/tour", () => {
    expect(tourVersionWarning(undefined)).toBeNull();
    expect(tourVersionWarning("")).toBeNull();
  });

  it("names both versions when they differ", () => {
    const warning = tourVersionWarning("2.0.0");
    expect(warning).toContain(`@stillsmith/tour ${BUNDLED}`);
    expect(warning).toContain("installs 2.0.0");
  });
});
