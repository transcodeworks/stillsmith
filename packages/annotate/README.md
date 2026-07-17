# @stillsmith/annotate

The shared annotation core of the stillsmith family. You probably want one of its
consumers instead:

- **[stillsmith](../stillsmith)** — capture annotated screenshots from your real
  components (a dev dependency).
- **@stillsmith/tour** — run guided onboarding tours inside your app (a
  production dependency).

This package is what they agree on: the `Target` model (how an annotation or a
tour step points at an element — `selector` → `text` → `rect`, with `data-shot`
attributes as the endorsed stable hook), the DOM overlay drawer
(`drawAnnotations`), target resolution (`resolveTarget`), and target suggestion
(`suggestTarget`, `collectAnnotatable` — turning a clicked element into the most
stable selector available, graded `stable` / `ok` / `brittle`).

It is deliberately dependency-free and browser-only: no Node, no framework, no
Playwright. Two artifacts ship:

- `dist/index.js` — ESM, for normal imports;
- `dist/annotate.global.js` — an IIFE exposing the same API as the global
  `__stillsmithAnnotate`, for injection into a page (`addScriptTag`).
