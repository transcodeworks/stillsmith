# @stillsmith/tour

**Guided onboarding tours, defined as code in your repo.**

A tour is a plain, type-checked object: steps that anchor to elements by
selector, with a spotlight, a tooltip, and advance triggers. It lives in a
`.tour.ts` file next to the feature it tours, ships in the same PR as the UI
change that would otherwise break it, and is authored visually with
[stillsmith](../stillsmith)'s editor — which writes the source back.

This package is only the runtime: framework-neutral, two small dependencies
(`@floating-ui/dom` for positioning, `@stillsmith/annotate` for the shared
target model), with an optional React binding.

```ts
// src/tours/onboarding.tour.ts
import type { Tour } from "@stillsmith/tour";

export const Onboarding = {
  id: "onboarding",
  steps: [
    { title: "Welcome", body: "Let's take a quick look around." },
    { target: { selector: "[data-shot='search']" }, body: "Find anything from here." },
    {
      target: { selector: "[data-shot='save']" },
      body: "Save your work — go ahead, click it.",
      advance: { on: "click" },
    },
    { route: "/settings", target: { selector: "[data-shot='theme']" }, body: "Make it yours." },
  ],
} satisfies Tour;
```

```ts
import { startTour } from "@stillsmith/tour";
import { Onboarding } from "./tours/onboarding.tour.js";

startTour(Onboarding);
```

Or with React:

```tsx
import { TourAutoStart } from "@stillsmith/tour/react";

<TourAutoStart tour={Onboarding} />; // persistence keeps it quiet after completion
```

## What the runtime handles

- **Element waiting** — targets that mount late (route changes, suspense,
  fetches) are polled out, per-step, with a budget. `optional: true` skips a
  step that never resolves; a required miss ends the tour with a console
  warning and no persisted verdict, so it tries again next visit.
- **Spotlight** — an SVG cutout scrim: everything dims except the target, the
  hole passes clicks through (which is what makes `advance: { on: "click" }`
  work), and the cutout animates between steps.
- **Positioning** — Floating UI flip/shift, so tooltips stay on screen; a
  step's `offset` is applied last and always wins.
- **Routes** — a step with `route` navigates there first (via a three-function
  `RouterAdapter`; the default drives `history.pushState`). `advance: { on:
  "route" }` moves on when the app arrives somewhere.
- **Persistence** — progress in `localStorage`: completed and dismissed tours
  stay quiet, an interrupted tour resumes where it left off.
- **Keyboard & focus** — focus moves into the card and back out at the end;
  Esc dismisses; arrows step; Tab cycles within the card.
- **Fixtures** — a tour can name the demo data it needs, so it still has
  something to show on an empty account.

## Fixtures

An empty shelf makes for a short tour. Name a fixture on the tour and register
what the name means at app startup; the engine seeds it before the first step
and cleans up when the tour ends, however it ends.

```ts
import { registerTourFixtures } from "@stillsmith/tour";

registerTourFixtures({
  "demo-rocks": {
    setup() {
      shelfStore.add(DEMO_ROCKS);
      return () => shelfStore.remove(DEMO_ROCKS.map((r) => r.id));
    },
  },
});

export const Onboarding = { id: "onboarding", fixture: "demo-rocks", steps } satisfies Tour;
```

`setup` must be idempotent — a resumed tour seeds again — and an unregistered
or failing fixture ends the tour with a warning and no persisted verdict, so it
retries next visit. See the
[tours guide](https://transcodeworks.github.io/stillsmith/guides/tours/) for the
full contract.

## Targets

The `target` model is [`@stillsmith/annotate`](../annotate)'s: `selector` →
`text` → `rect`, with `data-shot` attributes as the endorsed stable hook —
the same anchors your stillsmith screenshots use, suggested and graded by the
same editor.
