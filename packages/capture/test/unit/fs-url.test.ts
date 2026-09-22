import { describe, expect, it } from "vitest";

import { fsUrl } from "../../src/core/paths.js";

describe("fsUrl", () => {
  it("keeps a POSIX absolute path byte-identical to the old bare-concatenation form", () => {
    expect(fsUrl("/home/u/project/scenes/hero.tsx")).toBe("/@fs/home/u/project/scenes/hero.tsx");
  });

  it("puts a slash after @fs and forward slashes in a Windows path", () => {
    expect(fsUrl("D:\\Projects\\x\\scenes\\hero.tsx")).toBe("/@fs/D:/Projects/x/scenes/hero.tsx");
  });

  it("accepts a Windows path that already uses forward slashes", () => {
    expect(fsUrl("D:/Projects/x/scenes/hero.tsx")).toBe("/@fs/D:/Projects/x/scenes/hero.tsx");
  });
});
