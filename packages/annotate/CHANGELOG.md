# @stillsmith/annotate

## 0.3.0

### Minor Changes

- 89cb125: Drop the exports the deleted MCP server was the only consumer of.

  - **`@stillsmith/annotate` no longer exports `collectAnnotatable` or the `AnnotatableElement` type.** It enumerated every targetable element in a page for the MCP `inspect_scene` tool; with that tool gone it had no caller, and it was dead weight in the `annotate.global.js` bundle the capture driver injects into every page. `suggestTarget` — the click-to-target logic @stillsmith/studio uses — is unchanged.
  - **`@stillsmith/tour` no longer publishes the `./global.js` export** (`dist/tour.global.js`, the IIFE exposing the runtime as `__stillsmithTour`). It existed so the MCP `preview_step` tool could inject the runtime with `addScriptTag`; @stillsmith/studio bundles the package as ESM instead. The `.` and `./react` entries are unchanged.

## 0.2.0

### Patch Changes

- 43356d3: Keep arrowhead tips sharp by ending the shaft under the filled marker instead of through the point.
