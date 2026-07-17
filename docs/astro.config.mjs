import starlight from "@astrojs/starlight";
import starlightLlmTools from "@wave-rf/starlight-llm-tools";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://transcodeworks.github.io",
  base: "/stillsmith",
  integrations: [
    starlight({
      title: "stillsmith",
      description: "Screenshots of your product, taken from your real components.",
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/transcodeworks/stillsmith",
        },
      ],
      tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
      sidebar: [
        {
          label: "Start here",
          items: [
            { label: "What stillsmith is", slug: "start/what-stillsmith-is" },
            { label: "Getting started", slug: "start/getting-started" },
          ],
        },
        {
          label: "Guides",
          items: [
            { label: "Scenes and shots", slug: "guides/scenes" },
            { label: "Configuration", slug: "guides/configuration" },
            { label: "Next.js & other hosts", slug: "guides/hosts" },
            { label: "Annotations", slug: "guides/annotations" },
            { label: "Guided tours", slug: "guides/tours" },
            { label: "The authoring GUI", slug: "guides/authoring" },
            { label: "Agents (MCP)", slug: "guides/mcp" },
          ],
        },
        {
          label: "Reference",
          items: [{ label: "CLI", slug: "reference/cli" }],
        },
      ],
      plugins: [starlightLlmTools()],
    }),
  ],
});
