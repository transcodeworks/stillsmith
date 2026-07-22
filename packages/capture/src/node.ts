/**
 * The Node-side toolchain API: `stillsmith/node`.
 *
 * Everything here runs a server, reads the filesystem, or drives a browser, so
 * it lives behind its own entry — the root `stillsmith` entry stays pure types
 * and is safe to import from code that also runs in a browser. This is the
 * surface companion tooling builds on; @stillsmith/studio's authoring server
 * and CLI are consumers.
 */
export { loadConfig } from "./core/config.js";
export {
  startServer,
  type ServerOptions,
  type StillsmithServer,
} from "./core/server.js";
export {
  discoverScenes,
  discoverTours,
  findSceneFiles,
  findTourFiles,
  type DiscoveredScene,
  type DiscoveredTour,
} from "./core/discover.js";
export { formatHostReport } from "./core/host.js";
export {
  fileStem,
  readShots,
  sceneId,
  sceneIdFromFile,
  shotNameFromExport,
  type ResolvedShot,
  type SceneModule,
} from "./scene-utils.js";
export {
  readTours,
  tourIdFromExport,
  type ResolvedTour,
  type TourModule,
} from "./tour-utils.js";
