/**
 * `next/head` — append children's rendered nodes into document.head on mount.
 */
import { Children, type ReactNode, cloneElement, isValidElement, useEffect, useId } from "react";
import { createPortal } from "react-dom";

interface HeadProps {
  children?: ReactNode;
}

export default function Head({ children }: HeadProps) {
  const id = useId();

  useEffect(() => {
    return () => {
      for (const el of document.head.querySelectorAll(
        `[data-stillsmith-head="${CSS.escape(id)}"]`,
      )) {
        el.remove();
      }
    };
  }, [id]);

  if (typeof document === "undefined") return null;

  const stamped = Children.map(children, (child) => {
    if (!isValidElement<{ "data-stillsmith-head"?: string }>(child)) return child;
    return cloneElement(child, { "data-stillsmith-head": id });
  });

  return createPortal(stamped, document.head);
}
