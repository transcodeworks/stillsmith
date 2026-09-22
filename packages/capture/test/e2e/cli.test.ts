import { type ChildProcess, spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The `stillsmith` binary, driven the way a shell or a CI step drives it.
 *
 * Everything here is about the process contract — exit codes and which stream
 * a line lands on — which the in-process tests in capture.test.ts can't see.
 * It runs the built `bin/stillsmith.js`, so `pnpm build` first.
 */
const APP = fileURLToPath(new URL("../fixtures/app", import.meta.url));
const BIN = fileURLToPath(new URL("../../bin/stillsmith.js", import.meta.url));

interface Run {
  code: number | null;
  stdout: string;
  stderr: string;
}

function start(args: string[]): { child: ChildProcess; out: { stdout: string; stderr: string } } {
  const child = spawn(process.execPath, [BIN, ...args], {
    cwd: APP,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, FORCE_COLOR: "0" },
  });
  const out = { stdout: "", stderr: "" };
  child.stdout?.on("data", (chunk: Buffer) => {
    out.stdout += chunk.toString();
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    out.stderr += chunk.toString();
  });
  return { child, out };
}

/** Run to completion. */
function run(args: string[]): Promise<Run> {
  const { child, out } = start(args);
  return new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, ...out }));
  });
}

/**
 * Run a long-lived command until `done` is satisfied by what it has printed so
 * far, then stop it. The Vite server in `stillsmith dev` never exits on its own.
 */
async function runUntil(args: string[], done: (stdout: string) => boolean): Promise<Run> {
  const { child, out } = start(args);
  const exited = new Promise<number | null>((resolve) => child.on("close", resolve));

  try {
    await new Promise<void>((resolve, reject) => {
      child.on("error", reject);
      child.stdout?.on("data", () => {
        if (done(out.stdout)) resolve();
      });
      exited.then(() => {
        reject(
          new Error(`stillsmith ${args.join(" ")} exited early:\n${out.stdout}\n${out.stderr}`),
        );
      });
    });
  } finally {
    child.kill("SIGTERM");
    const hardStop = setTimeout(() => child.kill("SIGKILL"), 5_000);
    await exited;
    clearTimeout(hardStop);
  }

  return { code: null, ...out };
}

describe("stillsmith capture --strict", () => {
  // A target that filters on a tag no shot carries: every shot is an orphan,
  // so the warning fires and the plan is empty. Nothing is captured, and that
  // is precisely the path that used to slip past `--strict`.
  const orphans = ["capture", "--config", "stillsmith.orphans.config.tsx"];

  it("exits non-zero when every shot is orphaned and nothing gets captured", async () => {
    const result = await run([...orphans, "--strict"]);

    expect(result.stdout).toContain("Nothing to capture");
    expect(result.stderr).toContain("not captured by any target");
    expect(result.stderr).toMatch(/--strict: \d+ warning\(s\) above\./);
    expect(result.code).toBe(1);
  });

  it("still exits 0 for the same warnings without --strict", async () => {
    const result = await run(orphans);

    expect(result.stdout).toContain("Nothing to capture");
    expect(result.stderr).toContain("not captured by any target");
    expect(result.stderr).not.toContain("--strict");
    expect(result.code).toBe(0);
  });
});

describe("stillsmith mcp", () => {
  it("refuses with an explanation on stderr and nothing on stdout", async () => {
    const result = await run(["mcp"]);

    // Stdout is the client's JSON-RPC channel; anything there is garbage to it.
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("MCP server was removed");
    expect(result.stderr).toContain("@stillsmith/studio");
    expect(result.code).toBe(1);
  });

  it("still answers --help", async () => {
    const result = await run(["mcp", "--help"]);

    expect(result.stdout).toContain("Usage");
    expect(result.code).toBe(0);
  });
});

describe("stillsmith dev", () => {
  const settled = (stdout: string) => stdout.includes("Press Ctrl-C to stop.");

  it("points at the authoring GUI when the studio plugin is mounted via viteOverrides", async () => {
    const result = await runUntil(["dev", "--config", "stillsmith.studio.config.tsx"], settled);

    expect(result.stdout).toMatch(
      /^ {2}author {3}http:\/\/127\.0\.0\.1:\d+\/__stillsmith\/author$/m,
    );
    expect(result.stdout).not.toContain("install @stillsmith/studio");
  });

  it("suggests installing the studio otherwise", async () => {
    const result = await runUntil(["dev"], settled);

    expect(result.stdout).toContain("install @stillsmith/studio and run `stillsmith-studio`");
    expect(result.stdout).not.toMatch(/^ {2}author/m);
  });
});
