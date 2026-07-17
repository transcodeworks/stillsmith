/**
 * `next/font/local` — returns a fallback stack + a console warning.
 *
 * Honest limitation: `src:` is a string relative to the call site, resolved by
 * an SWC transform at compile time — a runtime shim cannot see the caller's
 * location. Override via `shims:` or use a dedicated vite.config (tier 1).
 */
import type { FontOptions, FontResult } from "./font-google.js";

export interface LocalFontOptions extends FontOptions {
  src: string | Array<{ path: string; weight?: string; style?: string }>;
}

function localFont(options: LocalFontOptions): FontResult {
  if (typeof console !== "undefined") {
    console.warn(
      "stillsmith: next/font/local cannot resolve `src` at runtime (it needs a compile-time transform). " +
        'Using a system fallback. Override with `shims: { "next/font/local": "./your-shim.ts" }` ' +
        "or add a small vite.config with the Vite font plugin.",
    );
  }
  const fallback = (options.fallback ?? ["system-ui", "sans-serif"]).join(", ");
  const className = "stillsmith-font-local";
  const variable = options.variable ?? "--font-local";
  return {
    className,
    style: { fontFamily: fallback },
    variable,
  };
}

export default localFont;
