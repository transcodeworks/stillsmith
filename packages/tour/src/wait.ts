/**
 * Element waiting: the #1 correctness problem of every runtime tour engine.
 * SPA targets mount asynchronously — after a route change, a suspense
 * boundary, a fetch — so a step must outwait its target, not assume it.
 *
 * A poll, not a MutationObserver: an observer graph misses reparenting and
 * shadow swaps, and the poll is twenty lines that survive everything.
 */
import { type ResolvedTarget, resolveTarget, type Target } from "@stillsmith/annotate";

export interface WaitOptions {
  timeoutMs: number;
  /** Poll interval, ms. Default 150. */
  intervalMs?: number;
  signal?: AbortSignal;
}

/**
 * Resolve `target` in `doc`, retrying until it exists or the budget runs out.
 * Returns null on timeout or abort. Never throws.
 */
export function waitForTarget(
  target: Target,
  doc: Document,
  options: WaitOptions,
): Promise<ResolvedTarget | null> {
  const interval = options.intervalMs ?? 150;

  return new Promise((resolve) => {
    const started = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const finish = (value: ResolvedTarget | null) => {
      if (timer !== undefined) clearTimeout(timer);
      options.signal?.removeEventListener("abort", onAbort);
      resolve(value);
    };
    const onAbort = () => finish(null);

    if (options.signal?.aborted) return finish(null);
    options.signal?.addEventListener("abort", onAbort);

    const attempt = () => {
      const resolved = resolveTarget(target, doc);
      if (resolved.rect) return finish(resolved);
      if (Date.now() - started >= options.timeoutMs) return finish(null);
      timer = setTimeout(attempt, interval);
    };
    attempt();
  });
}
