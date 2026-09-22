import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { findPackageRoot } from "../../src/node.js";

// Imported via the node entry to pin the public export. Exercised against a
// throwaway tree rather than the repo's own layout, which pnpm may rearrange.
let root: string;
let deepest: string;

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "stillsmith-paths-"));
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "outer" }));

  const inner = path.join(root, "packages", "inner");
  fs.mkdirSync(inner, { recursive: true });
  fs.writeFileSync(path.join(inner, "package.json"), JSON.stringify({ name: "inner" }));

  // A manifest that isn't JSON on the way up must be stepped over, not fatal.
  const broken = path.join(inner, "dist", "chunk");
  fs.mkdirSync(broken, { recursive: true });
  fs.writeFileSync(path.join(broken, "package.json"), "{ not json");

  deepest = path.join(broken, "deep");
  fs.mkdirSync(deepest);
});

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("findPackageRoot", () => {
  it("returns the nearest ancestor whose package.json carries the name", () => {
    expect(findPackageRoot(deepest, "inner")).toBe(path.join(root, "packages", "inner"));
  });

  it("keeps walking past packages with other names", () => {
    expect(findPackageRoot(deepest, "outer")).toBe(root);
  });

  it("throws, naming the package, when no ancestor matches", () => {
    expect(() => findPackageRoot(deepest, "@stillsmith/nowhere")).toThrow(
      "Could not locate the @stillsmith/nowhere package root",
    );
  });
});
