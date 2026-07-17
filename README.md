<div align="center">

# stillsmith

**Screenshots of your product, taken from your real components.**

Declare scenes in `*.scene.tsx` files next to the code they render. `stillsmith`
drives a headless browser through every shot and writes the images — annotated,
deterministic, and impossible to leave stale.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](#license)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-plugin-646cff.svg)](https://vitejs.dev/)
[![Playwright](https://img.shields.io/badge/Playwright-capture-2ead33.svg)](https://playwright.dev/)

[Getting started](#getting-started) · [Documentation](https://transcodeworks.github.io/stillsmith) · [Why stillsmith](#why-stillsmith) · [Contributing](./CONTRIBUTING.md)

</div>

---

Hand-composed mockups drift from the product. Manually-taken screenshots go stale
the moment a component changes — and nobody notices until a customer does.

A **scene** renders the real component over fixture data. When a prop changes, the
scene stops compiling instead of quietly lying in your docs. `stillsmith capture`
then photographs every scene through a real browser, so the image in your
documentation is the component your users actually see.

```tsx
// src/components/card.scene.tsx
import type { Scene, Shot } from "@stillsmith/capture/react";
import { Card } from "@/components/Card";

export default {
  render: () => <Card title="Team settings" body="Manage members and roles." action="Open" />,
} satisfies Scene;

export const Default: Shot = {};
export const Docs: Shot = { tags: ["docs"], viewport: { width: 800, height: 500 } };
```

```bash
stillsmith capture
```

## Why stillsmith

- **Real components, not mockups.** Scenes import your actual code, so a screenshot
  can never disagree with the product. A breaking change fails the build.
- **Deterministic captures.** Fonts are awaited, animations frozen, the caret
  hidden — re-running produces byte-identical images, so CI diffs stay meaningful.
- **Annotations baked into the pixels.** Outlines, highlights, arrows, callouts,
  and numbered labels are drawn as a DOM overlay just before the shutter.
- **A visual authoring tool.** `stillsmith dev` renders the scene live and lets you
  place annotations by clicking, and **drag them to fine-tune their position** —
  then writes the change back into your `.scene.tsx` as a clean, reviewable diff.
- **Your build config, reused.** stillsmith merges your app's Vite config rather than
  bringing its own — and when there is no Vite config (Next.js, CRA), it synthesizes
  one from your tsconfig paths and PostCSS setup, with shims for modules like
  `next/image` and `next/font`. Either way a scene imports a real component and
  just works.
- **Agent-ready.** A built-in MCP server lets an AI agent inspect a scene, preview
  a proposed annotation, and see the result before writing a line.
- **Guided tours, same bet.** [`@stillsmith/tour`](./packages/tour) runs onboarding
  tours from type-checked `.tour.ts` files in your repo, anchored on the same
  `data-shot` selectors your screenshots use — authored visually in `stillsmith dev`
  against your running app. See the [tours guide](https://transcodeworks.github.io/stillsmith/guides/tours/)
  and [DESIGN-TOURS.md](./DESIGN-TOURS.md).

## Getting started

```bash
pnpm add -D @stillsmith/capture
npx stillsmith init       # config + setup + an example scene
npx stillsmith install    # one-time: the Playwright Chromium build
```

Then declare a scene next to a component, and capture it:

```bash
stillsmith plan       # print what would be captured
stillsmith capture    # write the images
stillsmith dev        # browse scenes and author annotations visually
```

The **[package README](./packages/capture/README.md)** walks through declaring
scenes, configuring presets and targets, and the full CLI.

## Documentation

Docs are published at
**[transcodeworks.github.io/stillsmith](https://transcodeworks.github.io/stillsmith)**
(source in [`docs/`](./docs), built with [Starlight](https://starlight.astro.build/)).
The guides:

| Guide | What it covers |
| --- | --- |
| [What stillsmith is](https://transcodeworks.github.io/stillsmith/start/what-stillsmith-is/) | The idea, and when to reach for it. |
| [Getting started](https://transcodeworks.github.io/stillsmith/start/getting-started/) | Install, first scene, first capture. |
| [Scenes](https://transcodeworks.github.io/stillsmith/guides/scenes/) | Declaring scenes and shots. |
| [Annotations](https://transcodeworks.github.io/stillsmith/guides/annotations/) | The five kinds, targets, and `offset`. |
| [The authoring GUI](https://transcodeworks.github.io/stillsmith/guides/authoring/) | Placing and dragging annotations visually. |
| [Configuration](https://transcodeworks.github.io/stillsmith/guides/configuration/) | Presets, targets, and the one-file config. |
| [MCP](https://transcodeworks.github.io/stillsmith/guides/mcp/) | Driving stillsmith from an agent. |
| [CLI reference](https://transcodeworks.github.io/stillsmith/reference/cli/) | Every command and flag. |

For the architecture and roadmap, see **[DESIGN.md](./DESIGN.md)**.

## Repository layout

| Path | What |
| --- | --- |
| [`packages/capture`](./packages/capture) | `@stillsmith/capture` — the published npm package: CLI, Vite plugin, scene runtime, capture pipeline, authoring GUI, MCP server. |
| [`examples`](./examples) | A minimal consumer. Doubles as an end-to-end fixture: a real component, a real Vite config, real captures. |
| [`docs`](./docs) | The documentation site. |

## Development

This is a [pnpm](https://pnpm.io/) workspace.

```bash
pnpm install
pnpm build                  # build the package
pnpm dev                    # rebuild on change

pnpm example capture        # capture the example's scenes
pnpm example plan           # …or just print the plan

pnpm check                  # biome lint + format
pnpm typecheck
pnpm test                   # unit + end-to-end (drives a real browser)
```

The example depends on `stillsmith` via `workspace:*`, so `pnpm build` then
`pnpm example capture` exercises the real published entrypoints — the same
`exports` map and `bin` a consumer would get.

## Status

Capture, annotations, the visual authoring tool, and the MCP server all work end
to end. See **[DESIGN.md](./DESIGN.md)** for what's next.

## License

[MIT](https://opensource.org/licenses/MIT) © Transcode Inc.
