import type { Tour } from "@stillsmith/tour";

/**
 * The tour the runtime e2e drives. Each step pins one behaviour:
 * centered welcome, plain anchored tooltip, flip at the viewport edge +
 * click-to-advance, and a route change onto an async-mounted target.
 */
export const Onboarding = {
  id: "fixture-onboarding",
  steps: [
    { title: "Welcome", body: "A centered welcome step." },
    { target: { selector: "[data-shot='search']" }, body: "Search from here." },
    {
      target: { selector: "[data-shot='save']" },
      body: "Click save to continue.",
      // The button sits at the bottom edge, so this placement cannot hold —
      // the tooltip must flip above the target.
      placement: "bottom",
      advance: { on: "click" },
    },
    {
      route: "/settings",
      target: { selector: "[data-shot='theme']" },
      body: "The theme panel mounts late.",
    },
  ],
} satisfies Tour;
