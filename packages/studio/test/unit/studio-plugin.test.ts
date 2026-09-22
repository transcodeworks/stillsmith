import type { Plugin, ViteDevServer } from "vite";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  STILLSMITH_PLUGIN_NAME,
  STILLSMITH_STUDIO_PLUGIN_NAME,
  type StillsmithPluginApi,
} from "@stillsmith/capture";

import { stillsmithStudio } from "../../src/index.js";

/**
 * The handshake between studio and capture: studio finds the stillsmith plugin
 * by name in the server's plugin list and reads its resolved config off `api`.
 * The real mount drags in the API (and ts-morph); it is stubbed so these tests
 * can pin the handshake alone.
 */

const mountStudio = vi.hoisted(() => vi.fn());
vi.mock("../../src/server/plugin.js", () => ({ mountStudio }));

const FAKE_CONFIG = { root: "/fake" } as unknown as StillsmithPluginApi["config"];

function fakeServer(plugins: Plugin[]): ViteDevServer {
  return { config: { plugins } } as unknown as ViteDevServer;
}

async function configureServer(plugin: Plugin, server: ViteDevServer): Promise<void> {
  const hook = plugin.configureServer;
  const handler = typeof hook === "function" ? hook : hook?.handler;
  if (!handler) throw new Error("plugin has no configureServer hook");
  await handler.call({} as never, server);
}

beforeEach(() => {
  mountStudio.mockReset();
});

describe("stillsmithStudio", () => {
  it("registers under the shared studio plugin name", () => {
    expect(stillsmithStudio().name).toBe(STILLSMITH_STUDIO_PLUGIN_NAME);
  });

  it("throws when the stillsmith plugin is not on the server", async () => {
    const server = fakeServer([{ name: "vite:something-else" }]);
    await expect(configureServer(stillsmithStudio(), server)).rejects.toThrow(/was not found/);
    expect(mountStudio).not.toHaveBeenCalled();
  });

  it("throws when the stillsmith plugin publishes no config on api", async () => {
    const server = fakeServer([{ name: STILLSMITH_PLUGIN_NAME }]);
    await expect(configureServer(stillsmithStudio(), server)).rejects.toThrow(/too old/);
    expect(mountStudio).not.toHaveBeenCalled();
  });

  it("mounts with the config the stillsmith plugin publishes", async () => {
    const api: StillsmithPluginApi = { config: FAKE_CONFIG };
    const server = fakeServer([{ name: STILLSMITH_PLUGIN_NAME, api }]);
    await configureServer(stillsmithStudio(), server);
    expect(mountStudio).toHaveBeenCalledTimes(1);
    expect(mountStudio).toHaveBeenCalledWith(server, FAKE_CONFIG);
  });

  it("mounts once when registered twice on the same server", async () => {
    const api: StillsmithPluginApi = { config: FAKE_CONFIG };
    const server = fakeServer([{ name: STILLSMITH_PLUGIN_NAME, api }]);
    // The CLI adds the plugin, and a config's viteOverrides may add it again:
    // two instances, one server. The second must be a no-op.
    await configureServer(stillsmithStudio(), server);
    await configureServer(stillsmithStudio(), server);
    expect(mountStudio).toHaveBeenCalledTimes(1);
  });
});
