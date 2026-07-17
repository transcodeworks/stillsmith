/**
 * Inert App Router navigation hooks. Seed via `configureNavigation`.
 * Per-scene seeding is H3 — this is the shared mutable default.
 */
import { useSyncExternalStore } from "react";

export interface NavigationState {
  pathname: string;
  params: Record<string, string | string[]>;
  search: string;
}

let state: NavigationState = {
  pathname: "/",
  params: {},
  search: "",
};

const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/** Seed route state for navigation shims (setup wrapper or tests). */
export function configureNavigation(next: Partial<NavigationState>): void {
  state = {
    pathname: next.pathname ?? state.pathname,
    params: next.params ?? state.params,
    search: next.search ?? state.search,
  };
  emit();
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

function getSnapshot(): NavigationState {
  return state;
}

function noop(): void {}

export function usePathname(): string {
  return useSyncExternalStore(
    subscribe,
    () => getSnapshot().pathname,
    () => "/",
  );
}

export function useParams<
  T extends Record<string, string | string[]> = Record<string, string | string[]>,
>(): T {
  return useSyncExternalStore(
    subscribe,
    () => getSnapshot().params as T,
    () => ({}) as T,
  );
}

export function useSearchParams(): URLSearchParams {
  const search = useSyncExternalStore(
    subscribe,
    () => getSnapshot().search,
    () => "",
  );
  return new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
}

export function useRouter() {
  return {
    push: noop,
    replace: noop,
    back: noop,
    forward: noop,
    prefetch: noop,
    refresh: noop,
  };
}

export function redirect(_url: string): never {
  throw new Error(
    "stillsmith: next/navigation redirect() has no effect in scenes — scenes are client renders.",
  );
}

export function notFound(): never {
  throw new Error(
    "stillsmith: next/navigation notFound() has no effect in scenes — scenes are client renders.",
  );
}
