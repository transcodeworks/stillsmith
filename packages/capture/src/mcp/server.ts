/**
 * The stillsmith MCP server.
 *
 * The obvious design — "give the agent tools to write shots" — would be wasted
 * effort: an agent already edits `*.scene.tsx` perfectly well with its ordinary
 * file tools. What it *cannot* do is see the rendered scene, or know what's
 * targetable. So every tool here closes exactly that gap:
 *
 *   list_scenes    what exists
 *   inspect_scene  what's targetable, and how stable each selector is
 *   preview        render an UNSAVED shot and hand back the image to look at
 *   capture        run the real pipeline
 *   plan           dry run
 *
 * Tours get the same treatment, against the consumer's real app instead of a
 * scene: list_tours (what exists), inspect_app (what's targetable on a
 * route), preview_step (render a step — saved or proposed — and look at it).
 *
 * Together they give an agent the same loop the human authoring GUI provides —
 * propose, render, look, refine — with the save step being a normal file edit.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

import { inspectPage } from "../core/annotate.js";
import { type Logger, capture, renderShot, withAppPage, withScenePage } from "../core/capture.js";
import { type Filters, buildPlan, formatPlan } from "../core/plan.js";
import { applyStepPreview } from "../core/tour-preview.js";
import type { Annotation } from "@stillsmith/annotate";
import type { Step } from "@stillsmith/tour";
import type { Preset, ResolvedConfig, Shot } from "../types.js";
import { Session } from "./session.js";

/** JSON-RPC owns stdout. Everything human-readable goes to stderr. */
const stderrLogger: Logger = {
  info: (line) => process.stderr.write(`${line}\n`),
  warn: (line) => process.stderr.write(`${line}\n`),
};

const text = (s: string) => ({ content: [{ type: "text" as const, text: s }] });

const json = (value: unknown) => text(JSON.stringify(value, null, 2));

function image(png: Buffer, caption: string) {
  return {
    content: [
      { type: "text" as const, text: caption },
      { type: "image" as const, data: png.toString("base64"), mimeType: "image/png" },
    ],
  };
}

/**
 * Build a plan item by hand, for a shot that may not exist on disk.
 *
 * `preview` renders a shot the agent has only *proposed* — it isn't in any file
 * yet, so it can't come from `buildPlan`. Everything downstream (stabilisation,
 * annotations, screenshot) is the same code the real capture runs, so what the
 * agent sees is what it will get.
 */
function previewItem(
  sceneFile: string,
  sceneId: string,
  shot: Shot,
  presetName: string,
  preset: Preset,
) {
  return {
    sceneId,
    sceneFile,
    shotName: "preview",
    shot,
    presetName,
    preset,
    viewport: shot.viewport ?? { width: preset.width, height: preset.height },
    file: "",
    // Previews go inline to the agent, never to disk, so the target's format
    // is irrelevant here — png keeps them lossless and matches `image()`.
    format: "png" as const,
  };
}

export async function runMcpServer(config: ResolvedConfig): Promise<void> {
  const session = new Session(config);
  const server = new McpServer({ name: "stillsmith", version: "0.1.0" });

  const resolvePreset = (name?: string): [string, Preset] => {
    const presetName = name ?? Object.keys(config.presets)[0];
    if (!presetName) throw new Error("no presets are configured");
    const preset = config.presets[presetName];
    if (!preset) {
      throw new Error(
        `Unknown preset "${presetName}". Available: ${Object.keys(config.presets).join(", ")}`,
      );
    }
    return [presetName, preset];
  };

  const findScene = async (sceneId: string) => {
    const scenes = await session.scenes();
    const scene = scenes.find((s) => s.id === sceneId);
    if (!scene) {
      throw new Error(
        `Unknown scene "${sceneId}". Available: ${scenes.map((s) => s.id).join(", ")}`,
      );
    }
    return scene;
  };

  server.registerTool(
    "list_scenes",
    {
      title: "List scenes",
      description:
        "Every scene stillsmith has discovered, with its file, its shots (the named exports), and the presets and targets configured. Start here.",
      inputSchema: {},
    },
    async () => {
      const scenes = await session.scenes();
      return json({
        presets: config.presets,
        targets: config.targets,
        scenes: scenes.map((s) => ({
          id: s.id,
          file: s.file,
          shots: s.shots.map((sh) => ({
            exportName: sh.exportName,
            name: sh.name,
            tags: sh.tags,
            annotations: sh.shot.annotations?.length ?? 0,
          })),
        })),
      });
    },
  );

  server.registerTool(
    "inspect_scene",
    {
      title: "Inspect a scene's annotatable elements",
      description:
        "Render a scene and list what an annotation can point at: ready-to-use `target` selectors, how stable each one is, plus tag, role, text and viewport rect. " +
        "Use this BEFORE writing any annotation — a selector you guessed at will silently fail to resolve at capture time.",
      inputSchema: {
        scene: z.string().describe("Scene id, from list_scenes"),
        preset: z.string().optional().describe("Preset to render at. Defaults to the first."),
        limit: z.number().optional().describe("Max elements to return (default 100)"),
      },
    },
    async ({ scene: sceneId, preset: presetName, limit }) => {
      const scene = await findScene(sceneId);
      const [name, preset] = resolvePreset(presetName);
      const { baseUrl } = await session.vite();
      const browser = await session.chrome();

      const item = previewItem(scene.file, scene.id, {}, name, preset);
      const elements = await withScenePage(browser, baseUrl, config, item, (page) =>
        inspectPage(page, limit ?? 100),
      );

      return json({
        scene: scene.id,
        preset: name,
        viewport: item.viewport,
        hint: "quality: stable = survives re-renders and preset changes; ok = usable, but a data-shot attribute would be better; brittle = an absolute rect, will break.",
        elements,
      });
    },
  );

  server.registerTool(
    "preview",
    {
      title: "Preview an unsaved shot",
      description:
        "Render a shot spec you pass inline — it does NOT have to exist in any file — and return the PNG to look at. " +
        "This is how you check an annotation actually lands where you intended before writing it into a *.scene.tsx. Iterate here, then save with your normal file edit tools.",
      inputSchema: {
        scene: z.string().describe("Scene id, from list_scenes"),
        preset: z.string().optional().describe("Preset to render at. Defaults to the first."),
        shot: z
          .object({
            viewport: z.object({ width: z.number(), height: z.number() }).optional(),
            fullPage: z.boolean().optional(),
            delay: z.number().optional(),
            annotations: z.array(z.unknown()).optional(),
          })
          .describe("A Shot: viewport, fullPage, delay, annotations."),
      },
    },
    async ({ scene: sceneId, preset: presetName, shot }) => {
      const scene = await findScene(sceneId);
      const [name, preset] = resolvePreset(presetName);
      const { baseUrl } = await session.vite();
      const browser = await session.chrome();

      const item = previewItem(
        scene.file,
        scene.id,
        shot as Shot & { annotations?: Annotation[] },
        name,
        preset,
      );
      const { image: png, warnings } = await renderShot(browser, baseUrl, config, item);

      const caption = warnings.length
        ? `Preview of ${scene.id} at ${name}. ${warnings.length} annotation target(s) DID NOT RESOLVE and were skipped:\n- ${warnings.join("\n- ")}\nUse inspect_scene to find selectors that exist.`
        : `Preview of ${scene.id} at ${name} (${item.viewport.width}×${item.viewport.height}). All annotation targets resolved.`;

      return image(png, caption);
    },
  );

  server.registerTool(
    "plan",
    {
      title: "Plan a capture",
      description: "What `capture` would write, without writing anything.",
      inputSchema: {
        target: z.string().optional(),
        scene: z.string().optional(),
        shot: z.string().optional(),
        preset: z.string().optional(),
      },
    },
    async (args) => {
      const scenes = await session.scenes();
      const filters = toFilters(args);
      const targets = args.target ? [args.target] : Object.keys(config.targets);
      const plan = targets.flatMap((t) => buildPlan(config, scenes, t, filters));
      return text(formatPlan(plan));
    },
  );

  server.registerTool(
    "capture",
    {
      title: "Capture screenshots",
      description:
        "Run the real capture pipeline and write images to disk. Returns the paths written, and the images.",
      inputSchema: {
        target: z.string().optional(),
        scene: z.string().optional(),
        shot: z.string().optional(),
        preset: z.string().optional(),
      },
    },
    async (args) => {
      const scenes = await session.scenes();
      const filters = toFilters(args);
      const targets = args.target ? [args.target] : Object.keys(config.targets);
      const plan = targets.flatMap((t) => buildPlan(config, scenes, t, filters));

      if (plan.length === 0) return text("Nothing to capture (no shots matched).");

      const { baseUrl } = await session.vite();
      const result = await capture(config, plan, baseUrl, { log: stderrLogger });

      return json({
        captured: result.captured,
        warnings: result.warnings,
        files: plan.map((p) => p.file),
      });
    },
  );

  server.registerTool(
    "list_tours",
    {
      title: "List tours",
      description:
        "Every tour stillsmith has discovered from the `tours` globs, with its file, export name, and a per-step summary. Empty if the project hasn't configured tours.",
      inputSchema: {},
    },
    async () => {
      const tours = await session.tours();
      return json({
        tours: tours.map((t) => ({
          id: t.id,
          exportName: t.exportName,
          file: t.file,
          steps: t.tour.steps.map((s, index) => ({
            index,
            title: s.title,
            target: s.target,
            route: s.route,
            advance: s.advance?.on ?? "next",
            optional: s.optional ?? false,
          })),
        })),
      });
    },
  );

  server.registerTool(
    "inspect_app",
    {
      title: "Inspect the running app's targetable elements",
      description:
        "Open the consumer's real app at a route and list what a tour step can anchor to: ready-to-use `target` selectors with stability grades. " +
        "The tours counterpart of inspect_scene — use it BEFORE writing a step's target.",
      inputSchema: {
        route: z.string().optional().describe("Route to open. Defaults to /."),
        preset: z.string().optional().describe("Viewport preset. Defaults to the first."),
        limit: z.number().optional().describe("Max elements to return (default 100)"),
      },
    },
    async ({ route, preset: presetName, limit }) => {
      const [name, preset] = resolvePreset(presetName);
      const { baseUrl } = await session.vite();
      const browser = await session.chrome();

      const elements = await withAppPage(
        browser,
        baseUrl,
        config,
        { route: route ?? "/", preset },
        (page) => inspectPage(page, limit ?? 100),
      );

      return json({
        route: route ?? "/",
        preset: name,
        hint: "quality: stable = survives re-renders; ok = usable, but a data-shot attribute would be better; brittle = an absolute rect, will break.",
        elements,
      });
    },
  );

  server.registerTool(
    "preview_step",
    {
      title: "Preview a tour step over the running app",
      description:
        "Render one step — from a saved tour by index, or a spec you pass inline — over the consumer's real app, and return the PNG to look at. " +
        "The runtime is resolved from the project's own @stillsmith/tour install, so what you see is what ships. Iterate here, then save with your normal file edit tools.",
      inputSchema: {
        tour: z
          .string()
          .optional()
          .describe("Tour id, from list_tours. Sets defaults for step/route/overlay."),
        step: z.number().optional().describe("Step index within the tour."),
        spec: z
          .object({
            target: z
              .object({
                selector: z.string().optional(),
                text: z.string().optional(),
                nth: z.number().optional(),
              })
              .optional(),
            title: z.string().optional(),
            body: z.string(),
            placement: z.string().optional(),
            route: z.string().optional(),
            padding: z.number().optional(),
            radius: z.number().optional(),
            offset: z.object({ dx: z.number().optional(), dy: z.number().optional() }).optional(),
          })
          .optional()
          .describe("An inline Step, overriding `step`. Does not have to exist in any file."),
        preset: z.string().optional().describe("Viewport preset. Defaults to the first."),
      },
    },
    async ({ tour: tourId, step: stepIndex, spec, preset: presetName }) => {
      const [name, preset] = resolvePreset(presetName);

      const tours = await session.tours();
      const tour = tourId ? tours.find((t) => t.id === tourId) : undefined;
      if (tourId && !tour) {
        throw new Error(
          `Unknown tour "${tourId}". Available: ${tours.map((t) => t.id).join(", ")}`,
        );
      }

      let step = spec as Step | undefined;
      let index = 0;
      const total = tour?.tour.steps.length ?? 1;
      if (!step) {
        if (!tour || stepIndex === undefined) {
          throw new Error("Pass either `spec` (an inline step) or `tour` + `step` (an index).");
        }
        step = tour.tour.steps[stepIndex];
        if (!step) {
          throw new Error(
            `Tour "${tour.id}" has ${total} step(s); index ${stepIndex} is out of range.`,
          );
        }
        index = stepIndex;
      } else if (stepIndex !== undefined) {
        index = stepIndex;
      }

      const { baseUrl } = await session.vite();
      const browser = await session.chrome();
      const route = step.route ?? "/";

      const { png, warnings } = await withAppPage(
        browser,
        baseUrl,
        config,
        { route, preset },
        async (page) => {
          const warnings = await applyStepPreview(page, config.root, step, {
            index,
            total,
            overlay: tour?.tour.overlay,
          });
          const png = await page.screenshot({
            animations: config.stabilize.animations === "disable" ? "disabled" : "allow",
          });
          return { png, warnings };
        },
      );

      const caption = warnings.length
        ? `Step preview at ${route} (${name}). The target DID NOT RESOLVE:\n- ${warnings.join("\n- ")}\nUse inspect_app to find selectors that exist on this route.`
        : `Step preview at ${route} (${name}). The target resolved.`;

      return image(png, caption);
    },
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);

  const shutdown = async () => {
    await session.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

function toFilters(args: { scene?: string; shot?: string; preset?: string }): Filters {
  return {
    scenes: args.scene ? [args.scene] : undefined,
    shots: args.shot ? [args.shot] : undefined,
    presets: args.preset ? [args.preset] : undefined,
  };
}
