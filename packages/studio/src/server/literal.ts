/**
 * Print a plain JS value as TypeScript source.
 *
 * The GUI edits shots as data and we have to put that data back into a
 * `.scene.tsx` file, so something has to turn `{ kind: "callout", … }` into
 * source text. `JSON.stringify` would work but quotes every key, and we can't
 * rely on the consumer having a formatter that unquotes them.
 *
 * It also has to decide where to break lines, and that decision sticks: both
 * Biome and Prettier *preserve* an object that was written expanded. So a naive
 * printer that always expands turns `offset: { dx: -40, dy: -12 }` into four
 * lines, and saving a single number rewrites the whole shot. Print compact when
 * it fits and expand only when it doesn't, and the formatter leaves the result
 * alone — so the diff is just the value that changed.
 */

/** Identifiers that can be written bare as an object key. */
const BARE_KEY = /^[A-Za-z_$][\w$]*$/;

/** Roughly the line width a JS project formats to. Borderline cases get fixed
 * by the project's own formatter afterwards, so this only has to be close. */
const MAX_WIDTH = 96;

const INDENT = "  ";

function entriesOf(value: object): [string, unknown][] {
  // `undefined` means "no such property", not "the property is undefined".
  return Object.entries(value).filter(([, v]) => v !== undefined);
}

function printKey(key: string): string {
  return BARE_KEY.test(key) ? key : JSON.stringify(key);
}

function primitive(value: unknown): string | null {
  if (value === null) return "null";
  switch (typeof value) {
    case "string":
      return JSON.stringify(value);
    case "boolean":
      return String(value);
    case "number":
      if (!Number.isFinite(value)) throw new Error(`Cannot print ${value} as a literal`);
      return String(value);
    default:
      return null;
  }
}

/** Single-line form, however long it comes out. */
function compact(value: unknown): string {
  const prim = primitive(value);
  if (prim !== null) return prim;

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return `[${value.map(compact).join(", ")}]`;
  }

  if (value !== null && typeof value === "object") {
    const entries = entriesOf(value);
    if (entries.length === 0) return "{}";
    return `{ ${entries.map(([k, v]) => `${printKey(k)}: ${compact(v)}`).join(", ")} }`;
  }

  throw new Error(`Cannot print ${typeof value} as a literal`);
}

export function printLiteral(value: unknown, depth = 0): string {
  const prim = primitive(value);
  if (prim !== null) return prim;

  // Fits on one line at this depth? Then keep it on one line.
  const flat = compact(value);
  if (depth * INDENT.length + flat.length <= MAX_WIDTH) return flat;

  const pad = INDENT.repeat(depth);
  const padInner = INDENT.repeat(depth + 1);

  if (Array.isArray(value)) {
    const items = value.map((v) => `${padInner}${printLiteral(v, depth + 1)}`);
    return `[\n${items.join(",\n")},\n${pad}]`;
  }

  if (value !== null && typeof value === "object") {
    const items = entriesOf(value).map(
      ([key, v]) => `${padInner}${printKey(key)}: ${printLiteral(v, depth + 1)}`,
    );
    return `{\n${items.join(",\n")},\n${pad}}`;
  }

  throw new Error(`Cannot print ${typeof value} as a literal`);
}
