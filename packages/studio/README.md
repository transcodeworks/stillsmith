# @stillsmith/studio

The visual authoring studio for [stillsmith](https://transcodeworks.github.io/stillsmith).
It rides on the dev server `@stillsmith/capture` already runs and serves a GUI
that edits shots, annotations, and tours — then writes every change back into
your `.scene.tsx` and `.tour.ts` files as a clean, reviewable diff.

> **Status: early development.** The studio works end to end, but APIs may
> still change.

## Install

```bash
pnpm add -D @stillsmith/studio
```

`@stillsmith/capture` is a peer dependency and must be installed alongside it
(it almost certainly already is) — the studio rides on the server capture runs,
and both must be the same capture.

## Run

```bash
npx stillsmith-studio
```

| URL | What's there |
| --- | --- |
| `/__stillsmith/author` | The authoring GUI. |
| `/__stillsmith/` | The plain scene browser. |

Pick a scene, place annotations by clicking, drag them to fine-tune their
offsets, and Save — the studio edits the TypeScript source through a codemod
that touches only the properties you changed, formatted with your project's own
formatter. With `tours` globs configured, a second mode authors
[`@stillsmith/tour`](../tour) files the same way, against your live app.

## As a Vite plugin

The CLI is a thin wrapper. If you start the server yourself (or want the
authoring routes during `stillsmith capture` — e.g. to screenshot the studio
itself), register the plugin in `stillsmith.config.tsx`:

```tsx
import { stillsmithStudio } from "@stillsmith/studio";

export default defineConfig({
  // …
  viteOverrides: { plugins: [stillsmithStudio()] },
});
```

The plugin takes no options: it finds the `stillsmith` plugin on the server it
runs in and reads the resolved config from there.

## License

[MIT](./LICENSE) © Transcode Inc.
