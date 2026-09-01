# stillsmith

Screenshots of your product, taken from your **real components**.

Declare scenes in `*.scene.tsx` files next to the code they render — the same way
you'd write a Storybook story. `stillsmith capture` drives a headless browser
through every declared shot and writes the PNGs.

Hand-composed mockups drift from the product and manual screenshots go stale
silently. A scene renders the real component over fixture data, so when a prop
changes, the scene fails to compile instead of quietly lying in your docs.

> **Status: early development.** Capture, annotations, and the visual authoring
> tool work end to end, but APIs may still change.

## Install

```bash
pnpm add -D @stillsmith/capture
npx stillsmith init       # config + setup + an example scene
npx stillsmith install    # one-time: the Playwright Chromium build
```

## Declare a scene

```tsx
// src/components/card.scene.tsx
import type { Scene, Shot } from "@stillsmith/capture/react";
import { Card } from "@/components/Card";

export default {
  render: () => <Card title="Team settings" body="Manage members and roles." action="Open" />,
} satisfies Scene;

/** One shot per named export. */
export const Default: Shot = {};

export const Docs: Shot = {
  tags: ["docs"],
  viewport: { width: 800, height: 500 },
};
```

The scene id defaults to the filename (`card.scene.tsx` → `card`), and a shot's
name defaults to its kebab-cased export name. A shot called `default` drops the
suffix, so the common single-shot case writes `card.png`, not `card-default.png`.

## Configure

One file. Config *and* the browser-side harness:

```tsx
// stillsmith.config.tsx
import { defineConfig } from "@stillsmith/capture/react";
import { QueryClientProvider } from "@tanstack/react-query";
import "@/theme.css";

export default defineConfig({
  scenes: ["src/**/*.scene.tsx"],
  vite: "./vite.config.ts",

  presets: {
    docs: { width: 1280, height: 800, dpr: 2, colorScheme: "dark" },
    thumb: { width: 1280, height: 800, dpr: 1, colorScheme: "light" },
  },

  targets: {
    docs: { outDir: "docs/public/images", flat: true, presets: ["docs"], tags: ["docs"] },
    all: { outDir: "screenshots", presets: ["thumb"] },
  },

  // Wraps every scene. Only ever called in the browser.
  wrapper: ({ children }) => (
    <QueryClientProvider client={seededClient}>{children}</QueryClientProvider>
  ),

  // stillsmith owns the preset's colour scheme; you decide what it means.
  applyColorScheme: (scheme) =>
    document.documentElement.classList.toggle("dark", scheme === "dark"),
});
```

**stillsmith merges your app's Vite config when you have one.** Your aliases,
plugins, and CSS pipeline all apply to scenes, which is what lets a scene import
a real component and have it just work. If your app config carries plugins that
can't run in a headless browser (Tauri, router codegen), strip them with
`viteOverrides`.

No Vite project? stillsmith synthesizes a config from your tsconfig paths, PostCSS
setup, and host-prefixed env (`NEXT_PUBLIC_*`, `REACT_APP_*`, …), and ships
shims for meta-framework modules like `next/image`. Set `vite: false` to force
synthesis even when a vite.config exists. Tours against a separately-running
app use `appUrl` (e.g. `"http://localhost:3000"`).

A **preset** is a browser configuration — size, pixel density, colour scheme. A
**target** is an output profile: where images go, at which presets, for which
shots. Tag a shot and a tag-filtered target picks it up, so one scene set can
feed both a docs site and a marketing page without duplicating declarations.

### How one file can serve two runtimes

The config is read in **Node** (the CLI needs presets, targets and globs before a
browser exists) and again in the **browser** (which needs `wrapper` and
`applyColorScheme`). Normally that forces a split — it's why Storybook has
`main.ts` *and* `preview.ts`.

stillsmith avoids the split by bundling the config for Node itself, with stylesheets
and other assets resolved to empty stubs and your Vite aliases resolved the way
your app resolves them. So `import "@/theme.css"` and a JSX `wrapper` are both
safe in the config: Node can *import* them, and only the browser ever *calls*
them.

If something in your config genuinely can't run in Node — top-level `window`,
say — stillsmith says so and points you at the escape hatch:

```tsx
// stillsmith.config.tsx
export default defineConfig({
  setup: "./stillsmith.setup.tsx",   // browser-only half lives here instead
  …
});
```

```tsx
// stillsmith.setup.tsx
import { defineSetup } from "@stillsmith/capture/react";

export default defineSetup({ wrapper, applyColorScheme });
```

Both forms produce identical captures; the split is available, not required.

### Frameworks

`@stillsmith/capture` is the framework-neutral core; `@stillsmith/capture/react` is the
React binding — it types `wrapper` and `Scene` against `ReactNode` and selects the React
renderer. React is an *optional* peer dependency, and the core's published types
mention no framework at all, so a non-React project can depend on stillsmith without
installing React or `@types/react`.

React is the only renderer that ships today. Adding another is additive — a
`stillsmith/vue` binding and a Vue runtime — because capture, annotations, targets,
scene discovery, the codemod, and the authoring GUI are all framework-free
already. If you ask for a renderer that isn't shipped, stillsmith says so.

## Annotations

Shots can carry annotations — drawn as a DOM overlay just before the shutter, so
they're baked into the PNG. Five kinds: `outline`, `highlight` (with optional
spotlight dimming), `arrow`, `callout`, and `label` (a numbered pin).

```tsx
export const Annotated: Shot = {
  tags: ["docs"],
  annotations: [
    { kind: "highlight", target: { selector: "[data-shot='card']" }, dim: true },
    {
      kind: "callout",
      target: { selector: "[data-shot='card']" },
      text: "The title sits above the body copy.",
      badge: 1,
      placement: "top",
      offset: { dx: -40, dy: -12 },
    },
    { kind: "label", target: { selector: "[data-shot='save']" }, badge: 2, offset: { dx: -10, dy: -10 } },
  ],
};
```

**Targets** resolve by `selector` → `text` → `rect`, so one annotation adapts
across presets rather than being pinned to coordinates. Prefer a `data-shot`
attribute on the component: class names and DOM structure move, a `data-shot`
doesn't. An unresolved target prints a warning and is skipped — it never fails
the run, because a screenshot pipeline that hard-fails on a moved selector is one
people turn off.

**`offset`** nudges any annotation in any direction (`{ dx, dy }`, CSS pixels)
when the automatic placement isn't quite right — a callout overlapping an arrow,
a pin sitting on top of the label it's meant to sit beside. It's applied last,
*after* placement and after the keep-it-on-screen clamp, so an explicit offset
always lands exactly where you asked. Each kind moves the sensible thing: the box
for `outline`/`highlight`/`callout` (a callout's leader line follows, so it still
points at its target), the pin for `label`, and the arrowhead for `arrow` (the
tail stays put).

## Authoring annotations visually

The visual authoring studio ships separately as
[`@stillsmith/studio`](https://www.npmjs.com/package/@stillsmith/studio):

```bash
pnpm add -D @stillsmith/studio
npx stillsmith-studio     # → http://localhost:5173/__stillsmith/author
```

Pick a scene, place annotations by clicking, drag them to fine-tune their
`offset`, and Save — the studio edits only the properties you changed in your
`.scene.tsx`, formatted with your project's own formatter. Its preview runs the
same drawing engine as the capture, so what you nudge is what ships.

## For agents

Scenes and shots are ordinary TypeScript files, so an agent works with its
normal file tools: edit the `*.scene.tsx`, run `stillsmith capture --strict`,
look at the image, refine. `stillsmith plan` is the dry run.

Use `--strict`: without it an annotation whose target selector matched nothing is
a warning on a run that still exits 0, and the image ships with the callout
missing. `--strict` turns those warnings into a non-zero exit, so a failed edit
is a failed command.

## Capture

```bash
stillsmith plan                          # what would be captured
stillsmith capture                       # every target
stillsmith capture --target docs
stillsmith capture --scene card --preset docs
stillsmith capture --strict              # warnings become a non-zero exit
stillsmith dev                           # browse the scenes (no authoring GUI)
```

Captures are deterministic — fonts are awaited, animations and transitions are
frozen, and the caret is hidden — so re-running produces byte-identical PNGs and
CI diffs stay clean. Each output directory also gets a `manifest.json` listing
every image with its scene, shot, preset, and real pixel dimensions, so a docs
site can enumerate screenshots instead of hardcoding filenames.

## Filters

| Flag | Selects |
| --- | --- |
| `--target <name>` | Output profile. Default: every target. |
| `--scene <ids>` | Comma-separated scene ids. |
| `--shot <names>` | Comma-separated shot names. |
| `--preset <names>` | Comma-separated preset names. |
| `--tag <tags>` | Comma-separated tags. |
| `--clean` | Delete the targeted images first. |
| `--strict` | Exit non-zero if the run raises any warning (unresolved annotation targets, shots no target captures). |
