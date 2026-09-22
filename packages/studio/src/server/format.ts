import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Format a file we just rewrote, using the project's own formatter.
 *
 * The codemod emits reasonable source, but "reasonable" isn't "matches the rest
 * of this repo" — line width, quote style and trailing commas are all local
 * conventions. Running the formatter the project already has means a saved shot
 * produces the diff its author would have written by hand, instead of a diff
 * full of unrelated style churn.
 *
 * Entirely best-effort: no formatter, or a failing one, is not an error. The
 * file is already correct TypeScript.
 */
export async function formatFile(file: string, root: string): Promise<void> {
  const formatter = findFormatter(root);
  if (!formatter) return;

  const { bin, args } = formatter;
  await new Promise<void>((resolve) => {
    const child = spawn(bin, [...args, file], { stdio: "ignore" });
    child.on("close", () => resolve());
    child.on("error", () => resolve());
  });
}

interface Formatter {
  bin: string;
  args: string[];
}

/** Walk up from `root` looking for a formatter in a node_modules/.bin. */
function findFormatter(root: string): Formatter | null {
  let dir = root;
  for (;;) {
    const bin = path.join(dir, "node_modules", ".bin");

    const biome = path.join(bin, "biome");
    if (existsSync(biome)) return { bin: biome, args: ["format", "--write"] };

    const prettier = path.join(bin, "prettier");
    if (existsSync(prettier)) return { bin: prettier, args: ["--write"] };

    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
