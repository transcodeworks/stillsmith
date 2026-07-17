/**
 * `next/dynamic` → React.lazy + Suspense, honouring the `loading` option.
 */
import { type ComponentType, type ReactNode, Suspense, lazy } from "react";

interface DynamicOptions {
  loading?: () => ReactNode;
  ssr?: boolean;
  suspense?: boolean;
}

type Loader<P> = () => Promise<{ default: ComponentType<P> } | ComponentType<P>>;

function normalize<P>(mod: { default: ComponentType<P> } | ComponentType<P>): {
  default: ComponentType<P>;
} {
  if (typeof mod === "function") return { default: mod };
  return mod;
}

export default function dynamic<P extends object>(
  loader: Loader<P>,
  options: DynamicOptions = {},
): ComponentType<P> {
  const Lazy = lazy(() => loader().then(normalize));
  const Fallback = options.loading ?? (() => null);

  function DynamicComponent(props: P) {
    return (
      <Suspense fallback={<Fallback />}>
        <Lazy {...props} />
      </Suspense>
    );
  }

  return DynamicComponent;
}
