/**
 * Detect the meta-framework / build context from the nearest package.json.
 *
 * Informative, never load-bearing: everything it chooses is overridable
 * (`vite:`, `shims:`), and everything it chose is printed every run.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import type { Host, HostName } from "../types.js";

interface PkgJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

function findNearestPackageJson(from: string): string | null {
  let dir = from;
  for (;;) {
    const candidate = path.join(dir, "package.json");
    if (existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function readDeps(pkgPath: string): Record<string, string> {
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as PkgJson;
    return {
      ...pkg.peerDependencies,
      ...pkg.devDependencies,
      ...pkg.dependencies,
    };
  } catch {
    return {};
  }
}

/** Specificity order: next > cra > vite > generic. */
function detectName(deps: Record<string, string>): HostName {
  if (deps.next) return "next";
  if (deps["react-scripts"]) return "cra";
  if (deps.vite) return "vite";
  return "generic";
}

export function detectHost(root: string): Host {
  const pkgPath = findNearestPackageJson(root);
  const deps = pkgPath ? readDeps(pkgPath) : {};
  const name = detectName(deps);

  switch (name) {
    case "next":
      return { name, envPrefix: "NEXT_PUBLIC_", shimSets: ["next"] };
    case "cra":
      return { name, envPrefix: "REACT_APP_", shimSets: [] };
    case "vite":
      return { name, shimSets: [] };
    default:
      return { name: "generic", shimSets: [] };
  }
}

/** One-liner printed by `dev` / `plan` / `capture` so synthesis is never silent. */
export function formatHostReport(report: import("../types.js").HostReport): string {
  const { host, configSource, aliasSource, shims } = report;
  if (configSource === "vite") {
    const shimNote = shims.length > 0 ? `; shims: ${shims.join(", ")}` : "";
    return `stillsmith: host ${host.name} — merged vite config${shimNote}`;
  }
  const parts: string[] = [];
  if (aliasSource === "tsconfig") parts.push("aliases: tsconfig paths");
  else if (aliasSource === "none") parts.push("aliases: none");
  if (shims.length > 0) parts.push(`shims: ${shims.join(", ")}`);
  const detail = parts.length > 0 ? ` (${parts.join("; ")})` : "";
  return `stillsmith: host ${host.name} — synthesized config${detail}`;
}
