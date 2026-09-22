---
"@stillsmith/capture": minor
"@stillsmith/studio": minor
---

Split the authoring tools out of `@stillsmith/capture` into a new package, `@stillsmith/studio`, and drop the MCP server.

- **`@stillsmith/studio` (new).** The visual authoring GUI, its save API, and the ts-morph codemod now live in their own package. Run it with the new `stillsmith-studio` bin, or register its `stillsmithStudio()` Vite plugin via `viteOverrides.plugins` in `stillsmith.config.tsx`. `@stillsmith/capture` is a **peer** dependency of the studio — it rides on the server capture runs, and one project must mean one capture — so install both. `vite` is an optional peer: its types are part of the plugin's public signature, but only capture needs it at runtime, so a non-Vite host need not install it.
- **The studio warns when its tour runtime and yours differ.** The GUI's step preview runs the copy of `@stillsmith/tour` bundled into the studio; your app runs the one it installs. The state API reports the installed version as `tourVersion`, and tour mode warns when the two disagree.
- **`@stillsmith/capture` is the lean capture toolchain.** `stillsmith dev` is now a plain scene browser — the authoring GUI and `/__stillsmith/api` moved to the studio.
- **New `@stillsmith/capture/node` entry.** The Node toolchain API companion tooling builds on: `loadConfig`, `startServer` (whose `ServerOptions` gains `plugins`, extra Vite plugins appended after stillsmith's own), discovery (`discoverScenes`, `discoverTours`, `findSceneFiles`, `findTourFiles`), the module readers and id helpers discovery is built from, `formatHostReport`, and `findPackageRoot`. See the Node API reference. The root entry stays free of Node imports.
- **Plugin handshake names exported from the root entry.** `STILLSMITH_PLUGIN_NAME`, `STILLSMITH_STUDIO_PLUGIN_NAME`, and the `StillsmithPluginApi` type (what the stillsmith Vite plugin publishes on `api`), so companions don't hardcode the strings.
- **MCP server removed.** Agents author scenes and tours by editing the TypeScript files directly and verifying with `stillsmith capture --strict`; the MCP tools are gone. `stillsmith mcp` now exits 1 with an explanation on stderr — and nothing on stdout, so an old client config gets a readable error instead of garbage on its JSON-RPC channel.
- **New `stillsmith capture --strict`.** Warnings that used to leave the run exiting 0 — an annotation target that resolved to nothing, a shot no target captures — become a non-zero exit. This is what replaces the deleted MCP inspect tools for agents and CI.
- `stillsmith dev` prints the live authoring URL when the studio plugin is already mounted via `viteOverrides.plugins`, instead of the install hint.
- `ts-morph`, `react-resizable-panels`, `@modelcontextprotocol/sdk`, and `zod` are no longer dependencies of `@stillsmith/capture` (`typescript` becomes a direct dependency for tsconfig parsing).
