/**
 * Entry for the annotation engine.
 *
 * Built twice by tsup:
 *   - ESM, so Node and the authoring GUI can import it normally;
 *   - IIFE (`dist/annotate.global.js`), which the capture driver injects into the
 *     page with `addScriptTag`. That exposes these exports as the global
 *     `__stillsmithAnnotate`.
 */
export { drawAnnotations } from "./draw.js";
export { type ResolvedTarget, resolveTarget, resolveTargetRect } from "./resolve.js";
export { type AnnotatableElement, collectAnnotatable, suggestTarget } from "./suggest.js";
export type * from "./types.js";
