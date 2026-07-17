/**
 * `next/script` → plain `<script>` for the `src` form. `strategy` ignored.
 */
import type { ReactNode, ScriptHTMLAttributes } from "react";

type ScriptProps = ScriptHTMLAttributes<HTMLScriptElement> & {
  strategy?: "beforeInteractive" | "afterInteractive" | "lazyOnload" | "worker";
  onLoad?: () => void;
  onReady?: () => void;
  onError?: () => void;
  children?: ReactNode;
};

export default function Script({
  strategy: _strategy,
  onReady,
  onLoad,
  onError,
  children,
  ...rest
}: ScriptProps) {
  return (
    <script
      {...rest}
      onLoad={() => {
        onLoad?.();
        onReady?.();
      }}
      onError={() => {
        onError?.();
      }}
    >
      {children}
    </script>
  );
}
