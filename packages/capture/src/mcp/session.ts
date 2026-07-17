/**
 * A live stillsmith session: one Vite server, one browser, reused across tool calls.
 *
 * The agent's loop is propose → render → *look* → refine, and it will run several
 * times per annotation. Booting Vite and Chromium per call would make that loop
 * cost seconds each turn, so both are started once, lazily, and torn down when
 * the server exits.
 */
import { type Browser, chromium } from "playwright";

import {
  type DiscoveredScene,
  type DiscoveredTour,
  discoverScenes,
  discoverTours,
} from "../core/discover.js";
import { type StillsmithServer, startServer } from "../core/server.js";
import type { ResolvedConfig } from "../types.js";

export class Session {
  private server: StillsmithServer | null = null;
  private browser: Browser | null = null;

  constructor(readonly config: ResolvedConfig) {}

  async vite(): Promise<StillsmithServer> {
    // No HMR: a live-reload landing mid-shot would navigate the page out from
    // under the screenshot, exactly as it would during capture.
    if (!this.server) this.server = await startServer(this.config, { hmr: false });
    return this.server;
  }

  async chrome(): Promise<Browser> {
    if (!this.browser) this.browser = await chromium.launch();
    return this.browser;
  }

  /**
   * Scenes, re-read on every call.
   *
   * Deliberately not cached: the agent is *editing* scene files between calls,
   * and a cached scene list would hand it back the shots it just replaced. Vite's
   * module graph invalidates on write, so this is cheap.
   */
  async scenes(): Promise<DiscoveredScene[]> {
    const { server } = await this.vite();
    return discoverScenes(server, this.config);
  }

  /** Tours, re-read on every call — same no-cache reasoning as scenes. */
  async tours(): Promise<DiscoveredTour[]> {
    const { server } = await this.vite();
    return discoverTours(server, this.config);
  }

  async close(): Promise<void> {
    await this.browser?.close().catch(() => {});
    await this.server?.close().catch(() => {});
    this.browser = null;
    this.server = null;
  }
}
