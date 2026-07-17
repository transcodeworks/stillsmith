import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { waitForTarget } from "../src/wait.js";

describe("waitForTarget", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves immediately when the target exists", async () => {
    document.body.innerHTML = "<button data-shot='go'>Go</button>";
    const resolved = await waitForTarget({ selector: "[data-shot='go']" }, document, {
      timeoutMs: 1000,
    });
    expect(resolved?.element).toBe(document.querySelector("[data-shot='go']"));
  });

  it("outwaits a late-mounting target", async () => {
    const promise = waitForTarget({ selector: "#late" }, document, { timeoutMs: 5000 });
    setTimeout(() => {
      const el = document.createElement("div");
      el.id = "late";
      document.body.appendChild(el);
    }, 500);

    await vi.advanceTimersByTimeAsync(700);
    const resolved = await promise;
    expect(resolved?.element?.id).toBe("late");
  });

  it("returns null on timeout", async () => {
    const promise = waitForTarget({ selector: "#never" }, document, { timeoutMs: 1000 });
    await vi.advanceTimersByTimeAsync(1200);
    expect(await promise).toBeNull();
  });

  it("returns null on abort", async () => {
    const controller = new AbortController();
    const promise = waitForTarget({ selector: "#never" }, document, {
      timeoutMs: 60_000,
      signal: controller.signal,
    });
    await vi.advanceTimersByTimeAsync(300);
    controller.abort();
    expect(await promise).toBeNull();
  });

  it("returns null instantly on an already-aborted signal", async () => {
    const controller = new AbortController();
    controller.abort();
    const resolved = await waitForTarget({ selector: "body" }, document, {
      timeoutMs: 1000,
      signal: controller.signal,
    });
    expect(resolved).toBeNull();
  });
});
