import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { detectHost, formatHostReport } from "../../src/core/host.js";
import { aliasesFromTsconfig } from "../../src/core/aliases.js";
import { resolveShims } from "../../src/shims/registry.js";

const NEXT_SHAPED = fileURLToPath(new URL("../fixtures/next-shaped", import.meta.url));
const NO_VITE = fileURLToPath(new URL("../fixtures/no-vite", import.meta.url));

describe("detectHost", () => {
  it("detects next from a stub dependency (real next not installed)", () => {
    const host = detectHost(NEXT_SHAPED);
    expect(host.name).toBe("next");
    expect(host.envPrefix).toBe("NEXT_PUBLIC_");
    expect(host.shimSets).toEqual(["next"]);
  });

  it("falls back to generic when there is no meta-framework", () => {
    const host = detectHost(NO_VITE);
    expect(host.name).toBe("generic");
    expect(host.shimSets).toEqual([]);
  });
});

describe("tsconfig aliases", () => {
  it("maps @/* paths", () => {
    const aliases = aliasesFromTsconfig(NO_VITE);
    const at = aliases.find((a) => a.find === "@");
    expect(at).toBeDefined();
    expect(String(at!.replacement)).toContain(`${path.sep}src`);
  });
});

describe("resolveShims", () => {
  it("activates the next set for a next host", () => {
    const host = detectHost(NEXT_SHAPED);
    const { specifiers } = resolveShims(host, { root: NEXT_SHAPED, shims: undefined });
    expect(specifiers).toContain("next/image");
    expect(specifiers).toContain("server-only");
  });

  it("respects shims: false", () => {
    const host = detectHost(NEXT_SHAPED);
    const { aliases, specifiers } = resolveShims(host, { root: NEXT_SHAPED, shims: false });
    expect(aliases).toEqual([]);
    expect(specifiers).toEqual([]);
  });

  it("disables individual specifiers", () => {
    const host = detectHost(NEXT_SHAPED);
    const { specifiers } = resolveShims(host, {
      root: NEXT_SHAPED,
      shims: { "next/script": false },
    });
    expect(specifiers).not.toContain("next/script");
    expect(specifiers).toContain("next/image");
  });
});

describe("formatHostReport", () => {
  it("names synthesis and shims", () => {
    const host = detectHost(NEXT_SHAPED);
    const line = formatHostReport({
      host,
      configSource: "synthesized",
      aliasSource: "tsconfig",
      shims: ["next/image", "next/link"],
    });
    expect(line).toContain("host next");
    expect(line).toContain("synthesized");
    expect(line).toContain("next/image");
  });
});

describe("server-only shim", () => {
  it("throws the named recipe on import", async () => {
    const host = detectHost(NEXT_SHAPED);
    const { aliases } = resolveShims(host, { root: NEXT_SHAPED, shims: undefined });
    const serverOnly = aliases.find((a) => String(a.find).includes("server-only"));
    expect(serverOnly).toBeDefined();

    await expect(import(serverOnly!.replacement)).rejects.toThrow(
      /this component is server-only; scenes render in a browser — extract the presentational child and shoot that/,
    );
  });
});
