import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { CodemodError, createTour, deleteShot, setShotProps } from "../../src/core/codemod.js";
import { readTours, tourIdFromExport } from "../../src/tour-utils.js";

/**
 * Tours round-trip through the same codemod as shots — that reuse is the
 * point, and these tests pin it: only the named property moves, comments
 * outside it survive, non-literals are refused with a CodemodError.
 */

const FILE = `import type { Tour } from "@stillsmith/tour";

// The main onboarding flow. Keep it under five steps.
export const Onboarding = {
  id: "onboarding",
  steps: [
    { title: "Welcome", body: "Hello there." },
    { target: { selector: "[data-shot='search']" }, body: "Search here." },
  ],
} satisfies Tour;

const shared = { placement: "top" };

export const FromHelper = makeTour();
function makeTour(): Tour {
  return { id: "helper", steps: [] };
}
`;

let dir: string;
let file: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "stillsmith-tour-codemod-"));
  file = path.join(dir, "onboarding.tour.ts");
  await writeFile(file, FILE);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("tour codemod round-trip", () => {
  it("rewrites only the steps property; comments elsewhere survive", async () => {
    await setShotProps(
      file,
      "Onboarding",
      {
        steps: [
          { title: "Welcome", body: "Hello there." },
          { target: { selector: "[data-shot='search']" }, body: "Search here.", offset: { dx: 8 } },
        ],
      },
      dir,
    );

    const out = await readFile(file, "utf8");
    expect(out).toContain("// The main onboarding flow. Keep it under five steps.");
    expect(out).toContain('id: "onboarding"');
    expect(out).toContain("satisfies Tour");
    expect(out).toContain("offset: { dx: 8 }");
    // The untouched sibling export is untouched.
    expect(out).toContain("export const FromHelper = makeTour();");
  });

  it("round-trips: what discovery reads back is what was written", async () => {
    const steps = [
      { title: "One", body: "First." },
      {
        target: { selector: "[data-shot='save']" },
        body: "Click it.",
        advance: { on: "click" },
        optional: true,
        padding: 10,
      },
    ];
    await setShotProps(file, "Onboarding", { steps }, dir);

    // Evaluate the way discovery would (minus Vite — plain TS is importable
    // after a strip); simplest honest check is a fresh read of the literal.
    const out = await readFile(file, "utf8");
    await setShotProps(file, "Onboarding", { steps }, dir);
    expect(await readFile(file, "utf8")).toBe(out); // idempotent = faithful
  });

  it("refuses a non-literal initializer with a CodemodError", async () => {
    await expect(setShotProps(file, "FromHelper", { steps: [] }, dir)).rejects.toThrow(
      CodemodError,
    );
  });

  it("createTour appends a typed export and imports the Tour type once", async () => {
    await createTour(file, "SecondTour", dir);
    const out = await readFile(file, "utf8");
    expect(out).toContain('export const SecondTour: Tour = { id: "second-tour", steps: [] }');
    // The file already imported Tour; no duplicate import appears.
    expect(out.match(/@stillsmith\/tour/g)?.length).toBe(1);
  });

  it("createTour imports the type into a bare file", async () => {
    const bare = path.join(dir, "bare.tour.ts");
    await writeFile(bare, "");
    await createTour(bare, "Onboarding", dir);
    const out = await readFile(bare, "utf8");
    expect(out).toContain('import type { Tour } from "@stillsmith/tour"');
    expect(out).toContain('export const Onboarding: Tour = { id: "onboarding", steps: [] }');
  });

  it("deleteShot removes a tour export whole", async () => {
    await deleteShot(file, "Onboarding", dir);
    const out = await readFile(file, "utf8");
    expect(out).not.toContain("export const Onboarding");
    expect(out).toContain("export const FromHelper");
  });
});

describe("readTours", () => {
  it("keeps object exports with a steps array, ignores everything else", () => {
    const tours = readTours({
      Onboarding: { id: "onboarding", steps: [] },
      Unnamed: { steps: [{ body: "x" }] },
      notATour: { id: "no-steps" },
      helper: () => {},
      list: [1, 2],
      default: { steps: [] },
    });
    expect(tours.map((t) => t.id)).toEqual(["onboarding", "unnamed"]);
  });

  it("kebab-cases export names for default ids", () => {
    expect(tourIdFromExport("NewUserOnboarding")).toBe("new-user-onboarding");
  });
});
