/**
 * The default router adapter: drive `history.pushState`, observe URL changes.
 *
 * Observation is the hard half. `popstate` only fires for back/forward, so an
 * app router calling `pushState` is invisible without help; while subscribed,
 * the adapter wraps `pushState`/`replaceState` on the window's history and
 * restores them on unsubscribe. That covers most SPAs. A router with its own
 * state store (or one that rejects foreign pushStates) needs a custom
 * `RouterAdapter` wired to it — the interface is three functions.
 */
import type { RouterAdapter } from "./types.js";

export function createHistoryRouter(win: Window = window): RouterAdapter {
  return {
    navigate(path) {
      win.history.pushState(null, "", path);
      // Routers that listen for popstate treat this as a navigation; ones
      // that don't need a custom adapter.
      win.dispatchEvent(new PopStateEvent("popstate"));
    },

    current() {
      return win.location.pathname;
    },

    onRouteChange(cb) {
      // A `navigate()` above triggers both the pushState wrap and the popstate
      // dispatch; only report actual path changes so subscribers see one event.
      let last = win.location.pathname;
      const notify = () => {
        const path = win.location.pathname;
        if (path === last) return;
        last = path;
        cb(path);
      };
      win.addEventListener("popstate", notify);

      const history = win.history;
      const origPush = history.pushState;
      const origReplace = history.replaceState;
      history.pushState = function (...args: Parameters<History["pushState"]>) {
        origPush.apply(this, args);
        notify();
      };
      history.replaceState = function (...args: Parameters<History["replaceState"]>) {
        origReplace.apply(this, args);
        notify();
      };

      return () => {
        win.removeEventListener("popstate", notify);
        history.pushState = origPush;
        history.replaceState = origReplace;
      };
    },
  };
}
