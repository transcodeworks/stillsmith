/**
 * `next/image` → `<img>`. Handles Next's static-import `{src,width,height}`
 * object and Vite's URL string; `fill` becomes absolute positioning.
 */
import type { CSSProperties, ImgHTMLAttributes } from "react";

interface StaticImageData {
  src: string;
  height: number;
  width: number;
  blurDataURL?: string;
}

type ImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "width" | "height" | "alt"> & {
  src: string | StaticImageData;
  alt: string;
  width?: number | string;
  height?: number | string;
  fill?: boolean;
  /** Next-only — stripped. */
  priority?: boolean;
  loader?: unknown;
  placeholder?: unknown;
  quality?: unknown;
  blurDataURL?: string;
  unoptimized?: boolean;
};

export default function Image({
  src,
  alt,
  width,
  height,
  fill,
  style,
  className,
  priority: _priority,
  loader: _loader,
  placeholder: _placeholder,
  quality: _quality,
  blurDataURL: _blur,
  unoptimized: _unoptimized,
  ...rest
}: ImageProps) {
  const url = typeof src === "string" ? src : src.src;
  const w = typeof src === "object" ? src.width : width;
  const h = typeof src === "object" ? src.height : height;

  const fillStyle: CSSProperties | undefined = fill
    ? {
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "cover",
        ...style,
      }
    : style;

  return (
    <img
      src={url}
      alt={alt}
      width={fill ? undefined : w}
      height={fill ? undefined : h}
      style={fillStyle}
      className={className}
      {...rest}
    />
  );
}
