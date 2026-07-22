---
"@stillsmith/capture": minor
"@stillsmith/studio": minor
"@stillsmith/annotate": minor
"@stillsmith/tour": minor
---

Split the authoring tools out of `@stillsmith/capture` into a new package, `@stillsmith/studio`, and drop the MCP server.

- **`@stillsmith/studio` (new).** The visual authoring GUI, its save API, and the ts-morph codemod now live in their own package. Run it with the new `stillsmith-studio` bin, or register its `stillsmithStudio()` Vite plugin via `viteOverrides.plugins` in `stillsmith.config.tsx`.
- **`@stillsmith/capture` is the lean capture toolchain.** `stillsmith dev` is now a plain scene browser — the authoring GUI and `/__stillsmith/api` moved to the studio. A new `@stillsmith/capture/node` entry exposes the Node toolchain API (`loadConfig`, `startServer`, discovery) for companion tooling, and `startServer` accepts extra Vite plugins.
- **MCP server removed.** Agents author scenes and tours by editing the TypeScript files directly and verifying with `stillsmith capture`; the `stillsmith mcp` command and its tools are gone.
- `ts-morph`, `react-resizable-panels`, `@modelcontextprotocol/sdk`, and `zod` are no longer dependencies of `@stillsmith/capture` (`typescript` becomes a direct dependency for tsconfig parsing).
