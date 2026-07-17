/**
 * `next/link` → `<a>`. Scenes don't navigate; the anchor just has to look right.
 */
import type { AnchorHTMLAttributes, ReactNode } from "react";

type Href =
  | string
  | {
      pathname?: string;
      query?: Record<string, string | number | boolean | undefined>;
      hash?: string;
    };

function stringifyHref(href: Href): string {
  if (typeof href === "string") return href;
  const path = href.pathname ?? "";
  const query = href.query
    ? `?${Object.entries(href.query)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join("&")}`
    : "";
  const hash = href.hash ? (href.hash.startsWith("#") ? href.hash : `#${href.hash}`) : "";
  return `${path}${query}${hash}`;
}

type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: Href;
  children?: ReactNode;
  replace?: boolean;
  scroll?: boolean;
  prefetch?: boolean;
  locale?: string | false;
};

export default function Link({
  href,
  children,
  replace: _replace,
  scroll: _scroll,
  prefetch: _prefetch,
  locale: _locale,
  ...rest
}: LinkProps) {
  return (
    <a href={stringifyHref(href)} {...rest}>
      {children}
    </a>
  );
}
