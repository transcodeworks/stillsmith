/**
 * `next/font/google` — inject a fonts.googleapis.com stylesheet and return
 * `{ className, style, variable }`. Named exports are created on demand via a
 * Proxy so any Google font family works without a static export list.
 *
 * Vite/esbuild resolve `import { Inter } from "next/font/google"` against the
 * Proxy's `get` trap when the module is loaded as CJS-interop; for pure ESM
 * named imports, a small companion rewrite (see font-rewrite.ts) runs in both
 * the Vite and esbuild pipelines.
 */
export interface FontOptions {
  weight?: string | number | Array<string | number>;
  style?: "normal" | "italic" | Array<"normal" | "italic">;
  subsets?: string[];
  display?: string;
  variable?: string;
  preload?: boolean;
  fallback?: string[];
  adjustFontFallback?: boolean | string;
  declarations?: Array<{ prop: string; value: string }>;
}

export interface FontResult {
  className: string;
  style: { fontFamily: string };
  variable: string;
}

const injected = new Set<string>();

function familyCssName(family: string): string {
  // Inter → Inter; Open_Sans → Open Sans
  return family.replace(/_/g, " ");
}

function weightsOf(options: FontOptions): string {
  const w = options.weight;
  if (Array.isArray(w)) return w.join(";");
  if (w !== undefined) return String(w);
  return "400";
}

function injectStylesheet(family: string, options: FontOptions): void {
  if (typeof document === "undefined") return;
  const cssFamily = familyCssName(family);
  const key = `${cssFamily}:${weightsOf(options)}`;
  if (injected.has(key)) return;
  injected.add(key);

  const params = new URLSearchParams({
    family: `${cssFamily}:wght@${weightsOf(options)}`,
    display: options.display ?? "swap",
  });
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?${params.toString()}`;
  document.head.appendChild(link);
}

export function createGoogleFont(family: string) {
  return (options: FontOptions = {}): FontResult => {
    injectStylesheet(family, options);
    const cssFamily = familyCssName(family);
    const fallback = (options.fallback ?? ["system-ui", "sans-serif"]).join(", ");
    const className = `stillsmith-font-${family.toLowerCase().replace(/_/g, "-")}`;
    const variable = options.variable ?? `--font-${family.toLowerCase().replace(/_/g, "-")}`;

    if (typeof document !== "undefined") {
      const styleId = `stillsmith-font-style-${className}`;
      if (!document.getElementById(styleId)) {
        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = `.${className}{font-family:${cssFamily}, ${fallback}}${options.variable ? `.${className}{${variable}:${cssFamily}, ${fallback}}` : ""}`;
        document.head.appendChild(style);
      }
    }

    return {
      className,
      style: { fontFamily: `${cssFamily}, ${fallback}` },
      variable,
    };
  };
}

// Common fonts as static named exports (covers most projects without the plugin).
export const Inter = createGoogleFont("Inter");
export const Roboto = createGoogleFont("Roboto");
export const Open_Sans = createGoogleFont("Open_Sans");
export const Lato = createGoogleFont("Lato");
export const Montserrat = createGoogleFont("Montserrat");
export const Poppins = createGoogleFont("Poppins");
export const Source_Sans_3 = createGoogleFont("Source_Sans_3");
export const Nunito = createGoogleFont("Nunito");
export const Raleway = createGoogleFont("Raleway");
export const Ubuntu = createGoogleFont("Ubuntu");
export const Playfair_Display = createGoogleFont("Playfair_Display");
export const Merriweather = createGoogleFont("Merriweather");
export const Oswald = createGoogleFont("Oswald");
export const Rubik = createGoogleFont("Rubik");
export const Noto_Sans = createGoogleFont("Noto_Sans");

const named = {
  Inter,
  Roboto,
  Open_Sans,
  Lato,
  Montserrat,
  Poppins,
  Source_Sans_3,
  Nunito,
  Raleway,
  Ubuntu,
  Playfair_Display,
  Merriweather,
  Oswald,
  Rubik,
  Noto_Sans,
};

const fonts: Record<string, ReturnType<typeof createGoogleFont>> = new Proxy(named, {
  get(target, prop) {
    if (typeof prop === "symbol") return undefined;
    if (prop in target) return target[prop as keyof typeof target];
    return createGoogleFont(prop);
  },
  has: () => true,
});

export default fonts;
