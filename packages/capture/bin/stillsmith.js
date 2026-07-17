#!/usr/bin/env node
/**
 * Committed entrypoint. `bin` points here rather than straight at
 * `dist/cli/index.js`, for the same reason vite ships `bin/vite.js` and astro
 * ships `bin/astro.mjs`: the bin target should be a file that exists in the
 * repo, not a build artifact.
 *
 * It matters for local linking. pnpm creates bin symlinks during install, and a
 * bin whose target doesn't exist yet fails to link ("Failed to create bin …
 * ENOENT") — which on a fresh clone is every bin, since install necessarily runs
 * before build. A later install won't repair it either; the lockfile is already
 * up to date, so nothing relinks. Pointing at a committed file sidesteps all of
 * that: the link always succeeds, and dist is resolved at run time.
 */
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const cli = new URL("../dist/cli/index.js", import.meta.url);

if (!existsSync(fileURLToPath(cli))) {
  console.error("stillsmith: dist/ is missing — run `pnpm build` in packages/capture.");
  process.exit(1);
}

await import(cli.href);
