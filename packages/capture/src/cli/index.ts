#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { parseArgs } from "node:util";

import { capture } from "../core/capture.js";
import { loadConfig } from "../core/config.js";
import { discoverScenes } from "../core/discover.js";
import { formatHostReport } from "../core/host.js";
import {
  type Filters,
  type PlanItem,
  buildPlan,
  findOrphanShots,
  formatPlan,
} from "../core/plan.js";
import { startServer } from "../core/server.js";
import { init } from "./init.js";

const USAGE = `stillsmith — screenshots from your real components

Usage
  stillsmith init                  scaffold stillsmith.config.ts, a setup file, and an example scene
  stillsmith dev                   serve the scenes for browsing
  stillsmith plan [filters]        print what would be captured
  stillsmith capture [filters]     capture and write images
  stillsmith install               install the Playwright Chromium build

Filters
  --target <name>    output profile (default: every target)
  --scene <ids>      comma-separated scene ids
  --shot <names>     comma-separated shot names
  --preset <names>   comma-separated preset names
  --tag <tags>       comma-separated tags
  --clean            delete the targeted images before capturing

Other
  --config <path>    path to stillsmith.config.ts
  --help
`;

const list = (v: string | undefined) =>
  v
    ? v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    // `pnpm run capture -- --shot x` forwards the `--` separator literally, and
    // parseArgs treats `--` as a terminator — everything after it would land in
    // positionals and every filter would be silently ignored. Drop it.
    args: process.argv.slice(2).filter((a) => a !== "--"),
    allowPositionals: true,
    options: {
      target: { type: "string" },
      scene: { type: "string" },
      shot: { type: "string" },
      preset: { type: "string" },
      tag: { type: "string" },
      config: { type: "string" },
      clean: { type: "boolean", default: false },
      help: { type: "boolean", short: "h", default: false },
    },
  });

  const command = positionals[0] ?? "help";
  if (values.help || command === "help") {
    console.log(USAGE);
    return;
  }

  if (command === "init") {
    await init();
    return;
  }

  if (command === "mcp") {
    // Loaded lazily: the MCP SDK is dead weight for every other command, and
    // this keeps `stillsmith capture` startup lean.
    const [{ runMcpServer }, config] = await Promise.all([
      import("../mcp/server.js"),
      loadConfig(values.config),
    ]);
    console.error(formatHostReport(config.hostReport));
    await runMcpServer(config);
    return; // stdio transport keeps the process alive.
  }

  if (command === "install") {
    const result = spawnSync("npx", ["playwright", "install", "chromium"], { stdio: "inherit" });
    process.exitCode = result.status ?? 1;
    return;
  }

  const config = await loadConfig(values.config);
  console.log(formatHostReport(config.hostReport));

  const filters: Filters = {
    scenes: list(values.scene),
    shots: list(values.shot),
    presets: list(values.preset),
    tags: list(values.tag),
  };

  if (command === "dev") {
    const { baseUrl } = await startServer(config);
    console.log(`  authoring GUI   ${baseUrl}author`);
    console.log(`  scenes          ${baseUrl}`);
    console.log("\nPress Ctrl-C to stop.");
    return; // The Vite server keeps the process alive.
  }

  if (command !== "plan" && command !== "capture") {
    console.error(`Unknown command: ${command}\n`);
    console.log(USAGE);
    process.exitCode = 1;
    return;
  }

  // No HMR for capture: a live-reload landing mid-shot would navigate the page
  // out from under the screenshot.
  const { server, baseUrl, close } = await startServer(config, { hmr: false });
  let plan: PlanItem[];
  let scenes: Awaited<ReturnType<typeof discoverScenes>>;

  try {
    scenes = await discoverScenes(server, config);
    const targets = values.target ? [values.target] : Object.keys(config.targets);
    plan = targets.flatMap((t) => buildPlan(config, scenes, t, filters));
  } catch (err) {
    await close();
    throw err;
  }

  const unfiltered =
    !values.target && !values.scene && !values.shot && !values.preset && !values.tag;
  if (unfiltered) {
    const orphans = findOrphanShots(scenes, plan);
    if (orphans.length > 0) {
      console.warn(
        `\nWarning: ${orphans.length} shot(s) are not captured by any target:\n` +
          orphans.map((o) => `  ${o}`).join("\n") +
          "\nTheir presets don't intersect a target's, or they lack the tag a target filters on.\n",
      );
    }
  }

  if (command === "plan") {
    await close();
    console.log(formatPlan(plan));
    return;
  }

  if (plan.length === 0) {
    await close();
    console.log("Nothing to capture (no shots matched).");
    return;
  }

  try {
    const { captured, outDirs, warnings } = await capture(config, plan, baseUrl, {
      clean: values.clean,
    });
    console.log(`\nCaptured ${captured} screenshot(s) into:`);
    for (const dir of outDirs) console.log(`  ${dir}`);
    if (warnings > 0) {
      // Loud but non-fatal: the images exist, some annotation just didn't land.
      console.warn(`\n${warnings} annotation target(s) did not resolve (see ⚠ above).`);
    }
  } finally {
    await close();
  }
}

main().catch((err: unknown) => {
  console.error(`\n${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
