/**
 * Restores `window.localStorage` under vitest's jsdom environment.
 *
 * jsdom implements localStorage, but Node ships its own `localStorage` global
 * that stays `undefined` unless the process gets `--localstorage-file`. Vitest
 * copies the jsdom window onto `globalThis` and skips any key that already
 * exists there unless it names the key explicitly — and its list covers the
 * `Storage` constructor, not `localStorage`. Node's inert getter therefore wins
 * and `window.localStorage` reads back `undefined`, which sends
 * `defaultStorage()` down its "storage unavailable" path and takes the engine's
 * default persistence with it. happy-dom's key list has the same gap, so the
 * environment isn't the lever here.
 *
 * A throwaway jsdom window donates the real Storage rather than a hand-rolled
 * stand-in, so tests observe the same string coercion and key ordering a
 * browser gives them.
 */
import { JSDOM } from "jsdom";

const donor = new JSDOM("", { url: "http://localhost:3000/" });

Object.defineProperty(globalThis, "localStorage", {
  value: donor.window.localStorage,
  configurable: true,
  writable: true,
});
