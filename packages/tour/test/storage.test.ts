import { describe, expect, it } from "vitest";
import { clearProgress, defaultStorage, readProgress, writeProgress } from "../src/storage.js";
import type { StorageLike } from "../src/types.js";

function memoryStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

describe("progress storage", () => {
  it("round-trips progress", () => {
    const s = memoryStorage();
    writeProgress("onboarding", { status: "active", step: 2 }, s);
    expect(readProgress("onboarding", s)).toMatchObject({ status: "active", step: 2 });
    expect(typeof readProgress("onboarding", s)?.at).toBe("string");
  });

  it("clears progress", () => {
    const s = memoryStorage();
    writeProgress("onboarding", { status: "completed", step: 4 }, s);
    clearProgress("onboarding", s);
    expect(readProgress("onboarding", s)).toBeNull();
  });

  it("keys are namespaced per tour", () => {
    const s = memoryStorage();
    writeProgress("a", { status: "completed", step: 0 }, s);
    expect(readProgress("b", s)).toBeNull();
    expect([...s.map.keys()]).toEqual(["stillsmith-tour:a"]);
  });

  it("tolerates corrupt JSON", () => {
    const s = memoryStorage();
    s.setItem("stillsmith-tour:bad", "{not json");
    expect(readProgress("bad", s)).toBeNull();
  });

  it("rejects wrong shapes instead of propagating them", () => {
    const s = memoryStorage();
    s.setItem("stillsmith-tour:odd", JSON.stringify({ status: "paused", step: 1 }));
    expect(readProgress("odd", s)).toBeNull();
    s.setItem("stillsmith-tour:odd", JSON.stringify({ status: "active", step: "two" }));
    expect(readProgress("odd", s)).toBeNull();
    s.setItem("stillsmith-tour:odd", JSON.stringify("active"));
    expect(readProgress("odd", s)).toBeNull();
  });

  it("treats null storage as no persistence", () => {
    writeProgress("x", { status: "active", step: 0 }, null);
    expect(readProgress("x", null)).toBeNull();
  });

  it("swallows throwing storage", () => {
    const throwing: StorageLike = {
      getItem: () => {
        throw new Error("quota");
      },
      setItem: () => {
        throw new Error("quota");
      },
      removeItem: () => {
        throw new Error("quota");
      },
    };
    expect(() => writeProgress("x", { status: "active", step: 0 }, throwing)).not.toThrow();
    expect(readProgress("x", throwing)).toBeNull();
    expect(() => clearProgress("x", throwing)).not.toThrow();
  });

  it("defaultStorage returns a working localStorage in this environment", () => {
    const s = defaultStorage(window);
    expect(s).not.toBeNull();
    writeProgress("probe", { status: "dismissed", step: 1 }, s);
    expect(readProgress("probe", s)?.status).toBe("dismissed");
    clearProgress("probe", s);
  });
});
