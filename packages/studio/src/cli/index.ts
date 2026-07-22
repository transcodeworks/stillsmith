#!/usr/bin/env node
import { parseArgs } from "node:util";

import { formatHostReport, loadConfig, startServer } from "@stillsmith/capture/node";

import { stillsmithStudio } from "../index.js";

const USAGE = `stillsmith-studio — visual authoring for stillsmith scenes and tours

Serves your scenes with the authoring GUI mounted at /__stillsmith/author.
Edits made there are written back into your .scene.tsx and .tour.ts files.

Usage
  stillsmith-studio [--config <path>]

Options
  --config <path>    path to stillsmith.config.ts
  --help
`;

async function main(): Promise<void> {
  const { values } = parseArgs({
    // `pnpm run dev -- --config x` forwards the `--` separator literally, and
    // parseArgs treats `--` as a terminator. Drop it.
    args: process.argv.slice(2).filter((a) => a !== "--"),
    allowPositionals: false,
    options: {
      config: { type: "string" },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  if (values.help) {
    console.log(USAGE);
    return;
  }

  const config = await loadConfig(values.config);
  console.log(formatHostReport(config.hostReport));

  const { baseUrl } = await startServer(config, { plugins: [stillsmithStudio()] });
  console.log(`  authoring GUI   ${baseUrl}author`);
  console.log(`  scenes          ${baseUrl}`);
  console.log("\nPress Ctrl-C to stop.");
  // The Vite server keeps the process alive.
}

main().catch((err: unknown) => {
  console.error(`\n${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
