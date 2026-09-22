# @stillsmith/tour

## 0.3.0

### Minor Changes

- 89cb125: Drop the exports the deleted MCP server was the only consumer of.

  - **`@stillsmith/annotate` no longer exports `collectAnnotatable` or the `AnnotatableElement` type.** It enumerated every targetable element in a page for the MCP `inspect_scene` tool; with that tool gone it had no caller, and it was dead weight in the `annotate.global.js` bundle the capture driver injects into every page. `suggestTarget` — the click-to-target logic @stillsmith/studio uses — is unchanged.
  - **`@stillsmith/tour` no longer publishes the `./global.js` export** (`dist/tour.global.js`, the IIFE exposing the runtime as `__stillsmithTour`). It existed so the MCP `preview_step` tool could inject the runtime with `addScriptTag`; @stillsmith/studio bundles the package as ESM instead. The `.` and `./react` entries are unchanged.

### Patch Changes

- Updated dependencies [89cb125]
  - @stillsmith/annotate@0.3.0

## 0.2.0

### Minor Changes

- fd289ae: Tours can name the demo data they need. A tour with `fixture: "demo-rocks"` seeds
  it before the first step and clears it when the tour ends, so an onboarding tour
  still has something to show on an empty account. Apps register what the name
  means with `registerTourFixtures`, or pass handlers through `TourOptions.fixtures`.

  The authoring GUI edits the field and seeds the stage, and the MCP `preview_step`
  and `inspect_app` tools seed the page before rendering, so steps that point at
  data-dependent elements resolve while you author them.

### Patch Changes

- 43356d3: Keep arrowhead tips sharp by ending the shaft under the filled marker instead of through the point.
- Updated dependencies [43356d3]
  - @stillsmith/annotate@0.2.0
