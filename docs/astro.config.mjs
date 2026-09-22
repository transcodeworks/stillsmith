import starlight from "@astrojs/starlight";
import starlightLlmTools from "@wave-rf/starlight-llm-tools";
import { defineConfig } from "astro/config";

const base = "/stillsmith";

export default defineConfig({
  site: "https://transcodeworks.github.io",
  base,
  redirects: {
    "/guides/mcp": `${base}/guides/authoring/`,
  },
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
            { label: "The authoring studio", slug: "guides/authoring" },
          ],
        },
        {
          label: "Reference",
          items: [
            { label: "CLI", slug: "reference/cli" },
            { label: "Node API", slug: "reference/node-api" },
          ],
        },
      ],
      plugins: [starlightLlmTools()],
    }),
  ],
});
