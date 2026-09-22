import type { Plugin } from "vite";

import { findSceneFiles } from "../core/discover.js";
import { assertRuntimeBuilt, fsUrl, runtimePath } from "../core/paths.js";
import { STILLSMITH_PLUGIN_NAME, type StillsmithPluginApi } from "../plugin-names.js";
import type { ResolvedConfig } from "../types.js";

const ENTRY_ID = "virtual:stillsmith/entry";
const RESOLVED_ENTRY_ID = `\0${ENTRY_ID}`;
/** How the browser must ask for a `\0`-prefixed virtual module. */
const ENTRY_URL = "/@id/__x00__virtual:stillsmith/entry";

const SHELL = `<!doctype html>
<html>
  <head><meta charset="utf-8" /><title>stillsmith</title></head>
  <body style="margin:0">
    <div id="root"></div>
    <script type="module" src="${ENTRY_URL}"></script>
  </body>
</html>
`;

/**
 * Mounts the scene runtime into the consumer's Vite server.
 *
 * Scenes are discovered by glob and baked into a virtual entry module as
 * explicit dynamic imports, rather than a hand-maintained route map. The entry
 * is served at `/__stillsmith/`, so it never collides with the app's own routes.
 */
export function stillsmith(config: ResolvedConfig): Plugin {
  let sceneFiles: string[] = [];

  return {
    name: STILLSMITH_PLUGIN_NAME,
    apply: "serve",

    // Vite's inter-plugin handshake: companion plugins (@stillsmith/studio) find
    // this plugin by name and read the resolved config here, so they take no
    // config of their own and never load it twice.
    api: { config } satisfies StillsmithPluginApi,

    async buildStart() {
      assertRuntimeBuilt(config.framework);
      sceneFiles = await findSceneFiles(config);
    },

    resolveId(id) {
      if (id === ENTRY_ID) return RESOLVED_ENTRY_ID;
      return null;
    },

    load(id) {
      if (id !== RESOLVED_ENTRY_ID) return null;

      const loaders = sceneFiles
        .map((file) => `  ${JSON.stringify(file)}: () => import(${JSON.stringify(fsUrl(file))}),`)
        .join("\n");

      // The harness normally lives inline in stillsmith.config.tsx, in which case
      // the config file IS the setup: the browser imports it through the app's
      // own Vite, so its JSX, CSS imports and aliases all work unchanged. A
      // separate `setup:` file wins when one is given.
      const setupSource = config.setup ?? config.configPath;

      return [
        `import { start } from ${JSON.stringify(fsUrl(runtimePath(config.framework)))};`,
        `import setup from ${JSON.stringify(fsUrl(setupSource))};`,
        "",
        "start({",
        "  scenes: {",
        loaders,
        "  },",
        "  setup,",
        "});",
      ].join("\n");
    },

    configureServer(server) {
      /**
       * A new or deleted *scene* file changes the entry's import map, so the
       * entry has to be rebuilt and the page reloaded.
       *
       * Crucially, this must ignore every other file. Capture writes its images
       * into the project (a target's outDir is typically `docs/public/images`),
       * Vite's watcher sees those writes as `add` events, and a blanket reload
       * here would navigate the very page being captured — the next screenshot
       * then catches a blank, mid-navigation document. So: re-glob, and only act
       * when the set of scene files actually changed.
       */
      const onFileAddedOrRemoved = async () => {
        const next = await findSceneFiles(config);
        const unchanged =
          next.length === sceneFiles.length && next.every((f, i) => f === sceneFiles[i]);
        if (unchanged) return;

        sceneFiles = next;
        const mod = server.moduleGraph.getModuleById(RESOLVED_ENTRY_ID);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: "full-reload" });
      };
      server.watcher.on("add", onFileAddedOrRemoved);
      server.watcher.on("unlink", onFileAddedOrRemoved);

      server.middlewares.use(async (req, res, next) => {
        const pathname = new URL(req.url ?? "/", "http://localhost").pathname;

        if (pathname !== "/__stillsmith" && pathname !== "/__stillsmith/") return next();

        try {
          const html = await server.transformIndexHtml(req.url ?? "/__stillsmith/", SHELL);
          res.setHeader("Content-Type", "text/html");
          res.end(html);
        } catch (err) {
          next(err);
        }
      });
    },
  };
}

export default stillsmith;
