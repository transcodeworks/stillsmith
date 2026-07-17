import type { Tour } from "@stillsmith/tour";

/**
 * Pebble's onboarding tour. The anchors are the same `data-shot` hooks the
 * scenes photograph — the screenshot in the docs and the step in the app
 * point at the same element, and rot (or don't) together.
 *
 * Authored in `stillsmith dev` (tours mode) or by hand; either way this file is
 * the artifact — type-checked, reviewed, shipped.
 */
export const Onboarding = {
  id: "pebble-onboarding",
  steps: [
    {
      title: "Welcome to Pebble",
      body: "Your rocks, your shelf. A quick tour of the important bits.",
    },
    {
      target: { selector: "[data-shot='search']" },
      title: "Find any specimen",
      body: "Search by name, kind, or where you found it.",
    },
    {
      target: { selector: "[data-shot='rock-obsidian']" },
      title: "Pick a rock",
      body: "Click Obsidian to open it in the inspector.",
      advance: { on: "click" },
    },
    {
      target: { selector: "[data-shot='polish']" },
      title: "Log some polish",
      body: "Tumble time is tracked per specimen.",
      placement: "left",
    },
    {
      route: "/settings",
      target: { selector: "[data-shot='theme']" },
      title: "Make it yours",
      body: "Themes live in settings. That's the tour — happy collecting!",
    },
  ],
} satisfies Tour;
