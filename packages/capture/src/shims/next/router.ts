/**
 * Inert Pages Router (`next/router`). Same no-op surface as the App Router shim.
 */
import { useSyncExternalStore } from "react";

import { configureNavigation, type NavigationState } from "./navigation.js";

export { configureNavigation };

let asPath = "/";
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function noop(): Promise<boolean> {
  return Promise.resolve(true);
}

export function useRouter() {
  const path = useSyncExternalStore(
    subscribe,
    () => asPath,
    () => "/",
  );

  return {
    route: path,
    pathname: path.split("?")[0] ?? path,
    query: Object.fromEntries(new URLSearchParams(path.includes("?") ? path.split("?")[1] : "")),
    asPath: path,
    push: (_url: string) => {
      asPath = _url;
      emit();
      return noop();
    },
    replace: (_url: string) => {
      asPath = _url;
      emit();
      return noop();
    },
    reload: noop,
    back: noop,
    prefetch: noop,
    beforePopState: noop,
    events: {
      on: noop,
      off: noop,
      emit: noop,
    },
    isFallback: false,
    isReady: true,
    isPreview: false,
  };
}

/** Seed pages-router asPath (and the shared App Router state). */
export function configurePagesRouter(next: Partial<NavigationState> & { asPath?: string }): void {
  if (next.asPath) {
    asPath = next.asPath;
    emit();
  }
  configureNavigation(next);
}

export default { useRouter };
