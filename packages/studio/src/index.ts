/**
 * `@stillsmith/studio` — the visual authoring layer over a stillsmith dev server.
 *
 * One export: a Vite plugin. It rides on the server @stillsmith/capture already
 * runs, mounting the authoring GUI at `/__stillsmith/author` and its save API
 * under `/__stillsmith/api`. Registered either by the `stillsmith-studio` CLI or
 * by hand in `stillsmith.config.tsx`'s `viteOverrides.plugins`.
 *
 * This module must stay browser-inert: a consumer's stillsmith.config.tsx may
 * import it at top level, and the scene runtime imports that config file *in
 * the browser*. Everything Node-flavoured (fs reads, ts-morph via the API) is
 * loaded dynamically inside `configureServer`, which only ever runs in Node.
 */
import type { ResolvedConfig } from "@stillsmith/capture";
import type { Plugin } from "vite";

export type { SceneDTO, ShotDTO, StateDTO, TourDTO } from "./server/api.js";

export function stillsmithStudio(): Plugin {
  return {
    name: "stillsmith:studio",
    apply: "serve",

    // Allow-list studio's own package root, mirroring what capture does for
    // its runtime: under pnpm the package is a symlink into the store, outside
    // every default fs.allow root. (Dynamic import keeps this entry
    // browser-inert; config hooks only ever run in Node.)
    async config() {
      const { STUDIO_ROOT } = await import("./paths.js");
      return { server: { fs: { allow: [STUDIO_ROOT] } } };
    },

    async configureServer(server) {
      // Idempotent: the CLI adds this plugin, and a config's viteOverrides may
      // add it again. The first instance mounts; the twin becomes a no-op.
      const flagged = server as typeof server & { _stillsmithStudioMounted?: boolean };
      if (flagged._stillsmithStudioMounted) return;
      flagged._stillsmithStudioMounted = true;

      // The handshake: capture's plugin publishes its resolved config on `api`,
      // so studio needs no config of its own and never loads it twice.
      const host = server.config.plugins.find((p) => p.name === "stillsmith");
      const config = (host?.api as { config?: ResolvedConfig } | undefined)?.config;
      if (!config) {
        throw new Error(
          "@stillsmith/studio must run on a stillsmith dev server — the stillsmith " +
            "Vite plugin was not found. Start it with `stillsmith-studio`, or add " +
            "the plugin from @stillsmith/capture/vite alongside this one.",
        );
      }

      const { mountStudio } = await import("./server/plugin.js");
      mountStudio(server, config);
    },
  };
}

export default stillsmithStudio;
