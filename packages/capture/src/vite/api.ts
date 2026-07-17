/**
 * The authoring GUI's backend, mounted on the dev server under `/__stillsmith/api`.
 *
 * Everything the GUI can do, it does through here — and every write funnels into
 * the codemod, so the GUI and (later) an agent editing by hand converge on the
 * same source of truth: the `.scene.tsx` file.
 *
 * Path safety: a request names a scene file, and we only ever act on it if it is
 * *already one of the discovered scene files*. There is no path to normalise and
 * no traversal to defend against — an unknown path is simply not a scene.
 */
import type { Tour } from "@stillsmith/tour";
import type { Connect, ViteDevServer } from "vite";

import { CodemodError, createShot, createTour, deleteShot, setShotProps } from "../core/codemod.js";
import { discoverScenes, discoverTours } from "../core/discover.js";
import type { ResolvedConfig, Shot } from "../types.js";

type Req = Connect.IncomingMessage;
type Res = Parameters<Connect.NextHandleFunction>[1];

export interface ShotDTO {
  /** The named export it lives in — what the codemod addresses. */
  exportName: string;
  /** Its capture name (kebab-cased export name unless overridden). */
  name: string;
  shot: Shot;
}

export interface SceneDTO {
  id: string;
  file: string;
  shots: ShotDTO[];
}

export interface TourDTO {
  /** The named export it lives in — what the codemod addresses. */
  exportName: string;
  id: string;
  file: string;
  tour: Tour;
}

export interface StateDTO {
  scenes: SceneDTO[];
  presets: ResolvedConfig["presets"];
  /** Empty (and the GUI hides its tour mode) unless `tours` globs are configured. */
  tours: TourDTO[];
  /**
   * External app origin for tour authoring (`appUrl` config). When set, the
   * tour stage loads this instead of the merged Vite server's `/`.
   */
  appUrl?: string;
}

function sendJson(res: Res, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

async function readJson<T>(req: Req): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const raw = Buffer.concat(chunks).toString("utf8");
  return (raw ? JSON.parse(raw) : {}) as T;
}

export function apiMiddleware(
  server: ViteDevServer,
  config: ResolvedConfig,
): Connect.NextHandleFunction {
  /** Resolve a client-supplied path to a real scene, or null. */
  const resolveSceneFile = async (file: unknown): Promise<string | null> => {
    if (typeof file !== "string") return null;
    const scenes = await discoverScenes(server, config);
    return scenes.some((s) => s.file === file) ? file : null;
  };

  /** Same rule for tours: only files discovery already knows about. */
  const resolveTourFile = async (file: unknown): Promise<string | null> => {
    if (typeof file !== "string") return null;
    const tours = await discoverTours(server, config);
    return tours.some((t) => t.file === file) ? file : null;
  };

  return async (req, res, next) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (!url.pathname.startsWith("/__stillsmith/api/")) return next();

    const route = url.pathname.slice("/__stillsmith/api".length);
    const method = req.method ?? "GET";

    try {
      // Everything the GUI needs to render: scenes, their shots, the presets,
      // and — where configured — the tours.
      if (method === "GET" && route === "/state") {
        const scenes = await discoverScenes(server, config);
        const tours = await discoverTours(server, config);
        const state: StateDTO = {
          presets: config.presets,
          appUrl: config.appUrl,
          scenes: scenes.map((s) => ({
            id: s.id,
            file: s.file,
            shots: s.shots.map(({ exportName, name, shot }) => ({ exportName, name, shot })),
          })),
          tours: tours.map(({ exportName, id, file, tour }) => ({ exportName, id, file, tour })),
        };
        return sendJson(res, 200, state);
      }

      if (method === "PUT" && route === "/shot") {
        const body = await readJson<{ file?: string; exportName?: string; props?: unknown }>(req);
        const file = await resolveSceneFile(body.file);
        if (!file) return sendJson(res, 400, { error: "unknown scene file" });
        if (!body.exportName) return sendJson(res, 400, { error: "missing exportName" });
        if (!body.props || typeof body.props !== "object") {
          return sendJson(res, 400, { error: "missing props" });
        }

        await setShotProps(
          file,
          body.exportName,
          body.props as Record<string, unknown>,
          config.root,
        );
        return sendJson(res, 200, { ok: true });
      }

      if (method === "POST" && route === "/shot/create") {
        const body = await readJson<{ file?: string; exportName?: string }>(req);
        const file = await resolveSceneFile(body.file);
        if (!file) return sendJson(res, 400, { error: "unknown scene file" });
        if (!body.exportName) return sendJson(res, 400, { error: "missing exportName" });

        await createShot(file, body.exportName, config.root);
        return sendJson(res, 200, { ok: true });
      }

      if (method === "DELETE" && route === "/shot") {
        const body = await readJson<{ file?: string; exportName?: string }>(req);
        const file = await resolveSceneFile(body.file);
        if (!file) return sendJson(res, 400, { error: "unknown scene file" });
        if (!body.exportName) return sendJson(res, 400, { error: "missing exportName" });

        await deleteShot(file, body.exportName, config.root);
        return sendJson(res, 200, { ok: true });
      }

      // Tours mirror shots exactly: same codemod, same path rule, same errors.
      if (method === "PUT" && route === "/tour") {
        const body = await readJson<{ file?: string; exportName?: string; props?: unknown }>(req);
        const file = await resolveTourFile(body.file);
        if (!file) return sendJson(res, 400, { error: "unknown tour file" });
        if (!body.exportName) return sendJson(res, 400, { error: "missing exportName" });
        if (!body.props || typeof body.props !== "object") {
          return sendJson(res, 400, { error: "missing props" });
        }

        await setShotProps(
          file,
          body.exportName,
          body.props as Record<string, unknown>,
          config.root,
        );
        return sendJson(res, 200, { ok: true });
      }

      if (method === "POST" && route === "/tour/create") {
        const body = await readJson<{ file?: string; exportName?: string }>(req);
        const file = await resolveTourFile(body.file);
        if (!file) return sendJson(res, 400, { error: "unknown tour file" });
        if (!body.exportName) return sendJson(res, 400, { error: "missing exportName" });

        await createTour(file, body.exportName, config.root);
        return sendJson(res, 200, { ok: true });
      }

      if (method === "DELETE" && route === "/tour") {
        const body = await readJson<{ file?: string; exportName?: string }>(req);
        const file = await resolveTourFile(body.file);
        if (!file) return sendJson(res, 400, { error: "unknown tour file" });
        if (!body.exportName) return sendJson(res, 400, { error: "missing exportName" });

        await deleteShot(file, body.exportName, config.root);
        return sendJson(res, 200, { ok: true });
      }

      return next();
    } catch (err) {
      // A refusal (shot isn't a plain literal) is the user's problem to fix, not
      // a server fault — say so plainly and distinguish it from a real crash.
      if (err instanceof CodemodError) return sendJson(res, 422, { error: err.message });
      return sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
    }
  };
}
