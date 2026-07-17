/**
 * The framework-neutral core: `stillsmith`.
 *
 * Nothing here imports a UI framework, and the published types don't mention
 * one — a project without `@types/react` installed can still typecheck against
 * it. React projects should import from `stillsmith/react`, which pins the generic
 * types to `ReactNode` and selects the React renderer.
 */
import type { stillsmithConfig } from "./types.js";

/**
 * Framework-neutral config. `wrapper` is typed against an opaque node, so JSX in
 * the config will NOT typecheck here — React projects want the `defineConfig`
 * from `stillsmith/react` instead.
 */
export function defineConfig<TNode>(config: stillsmithConfig<TNode>): stillsmithConfig<TNode> {
  return config;
}

export type {
  Host,
  HostName,
  HostReport,
  stillsmithConfig,
  Preset,
  RenderNode,
  ResolvedConfig,
  Scene,
  Setup,
  Shot,
  Stabilize,
  // Two different things wanted the name `Target`: an output profile in the
  // config, and the element an annotation points at. Scene files name the latter
  // constantly and the former almost never, so it keeps the bare name.
  Target as OutputTarget,
} from "./types.js";

// Annotations are pure DOM — no framework anywhere near them.
export type {
  Anchor,
  Annotation,
  ArrowAnnotation,
  CalloutAnnotation,
  HighlightAnnotation,
  LabelAnnotation,
  Offset,
  OutlineAnnotation,
  Point,
  Target,
  TargetSuggestion,
} from "@stillsmith/annotate";
