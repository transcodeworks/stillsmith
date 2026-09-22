import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolveTourVersion } from "../../src/server/api.js";

/**
 * The consumer's @stillsmith/tour version is found by walking up from their
 * config root through `node_modules`, the way Node itself resolves — so a root
 * nested below the project's `node_modules` still finds it, and a project
 * without the package reports none rather than failing.
 */

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "stillsmith-tour-version-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function installTour(root: string, version: string): Promise<void> {
  const pkg = path.join(root, "node_modules", "@stillsmith", "tour");
  await mkdir(pkg, { recursive: true });
  await writeFile(
    path.join(pkg, "package.json"),
    JSON.stringify({ name: "@stillsmith/tour", version }),
  );
}

describe("resolveTourVersion", () => {
  it("reads the version installed beside the root", async () => {
    await installTour(dir, "3.4.5");
    expect(await resolveTourVersion(dir)).toBe("3.4.5");
  });

  it("walks up from a nested root", async () => {
    await installTour(dir, "3.4.5");
    const nested = path.join(dir, "apps", "docs");
    await mkdir(nested, { recursive: true });
    expect(await resolveTourVersion(nested)).toBe("3.4.5");
  });

  it("prefers the nearest installation", async () => {
    await installTour(dir, "1.0.0");
    const nested = path.join(dir, "apps", "docs");
    await installTour(nested, "2.0.0");
    expect(await resolveTourVersion(nested)).toBe("2.0.0");
  });

  it("is undefined when no @stillsmith/tour is installed", async () => {
    expect(await resolveTourVersion(dir)).toBeUndefined();
  });

  it("is undefined when the manifest is unreadable", async () => {
    const pkg = path.join(dir, "node_modules", "@stillsmith", "tour");
    await mkdir(pkg, { recursive: true });
    await writeFile(path.join(pkg, "package.json"), "{ not json");
    expect(await resolveTourVersion(dir)).toBeUndefined();
  });
});
