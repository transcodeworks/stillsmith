import type { ResolvedConfig } from "./types.js";

/**
 * The Vite inter-plugin protocol between stillsmith and its companions.
 *
 * Plugins find each other by name in `server.config.plugins`, and the stillsmith
 * plugin publishes its resolved config on `api`. Both sides of the handshake
 * import these from here rather than spelling the strings out, so a rename can't
 * silently break the other package. This module has no Node imports: the root
 * entry re-exports it, and a consumer's stillsmith.config.tsx runs in the browser.
 */

/** The name of the `stillsmith(config)` Vite plugin from `@stillsmith/capture/vite`. */
export const STILLSMITH_PLUGIN_NAME = "stillsmith";

/** The name of the `stillsmithStudio()` Vite plugin from `@stillsmith/studio`. */
export const STILLSMITH_STUDIO_PLUGIN_NAME = "stillsmith:studio";

/** What the stillsmith plugin publishes on `Plugin.api` for companions to read. */
export interface StillsmithPluginApi {
  config: ResolvedConfig;
}
