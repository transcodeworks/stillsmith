import { afterEach, describe, expect, it, vi } from "vitest";
import { createHistoryRouter } from "../src/router.js";

describe("history router adapter", () => {
  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("reports the current pathname", () => {
    const router = createHistoryRouter(window);
    window.history.replaceState(null, "", "/settings");
    expect(router.current()).toBe("/settings");
  });

  it("navigates and notifies subscribers", () => {
    const router = createHistoryRouter(window);
    const seen: string[] = [];
    const unsubscribe = router.onRouteChange((p) => seen.push(p));

    router.navigate("/rocks");
    expect(router.current()).toBe("/rocks");
    // One event, not two: the pushState wrap and the popstate dispatch both
    // fire, but the second is deduped by path.
    expect(seen).toEqual(["/rocks"]);
    unsubscribe();
  });

  it("observes the app's own pushState while subscribed, and restores it", () => {
    const router = createHistoryRouter(window);
    const original = window.history.pushState;
    const cb = vi.fn();
    const unsubscribe = router.onRouteChange(cb);
    expect(window.history.pushState).not.toBe(original);

    window.history.pushState(null, "", "/from-the-app");
    expect(cb).toHaveBeenCalledWith("/from-the-app");

    unsubscribe();
    expect(window.history.pushState).toBe(original);

    window.history.pushState(null, "", "/silent");
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("observes replaceState too", () => {
    const router = createHistoryRouter(window);
    const cb = vi.fn();
    const unsubscribe = router.onRouteChange(cb);
    window.history.replaceState(null, "", "/replaced");
    expect(cb).toHaveBeenCalledWith("/replaced");
    unsubscribe();
  });

  it("ignores same-path notifications", () => {
    window.history.replaceState(null, "", "/same");
    const router = createHistoryRouter(window);
    const cb = vi.fn();
    const unsubscribe = router.onRouteChange(cb);
    window.dispatchEvent(new PopStateEvent("popstate"));
    expect(cb).not.toHaveBeenCalled();
    unsubscribe();
  });
});
