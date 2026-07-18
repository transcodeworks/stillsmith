---
"@stillsmith/capture": minor
"@stillsmith/tour": minor
---

Tours can name the demo data they need. A tour with `fixture: "demo-rocks"` seeds
it before the first step and clears it when the tour ends, so an onboarding tour
still has something to show on an empty account. Apps register what the name
means with `registerTourFixtures`, or pass handlers through `TourOptions.fixtures`.

The authoring GUI edits the field and seeds the stage, and the MCP `preview_step`
and `inspect_app` tools seed the page before rendering, so steps that point at
data-dependent elements resolve while you author them.
