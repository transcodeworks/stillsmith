import Image from "next/image";
import Link from "next/link";
import { Inter, Karla } from "next/font/google";
import { usePathname } from "next/navigation";

const inter = Inter({ subsets: ["latin"], weight: "400" });
// Karla is NOT one of font-google.ts's static named exports — it exercises the
// import rewrite, including in the optimizeDeps scanner where esbuild would
// otherwise abort the whole scan on a missing named export.
const karla = Karla({ subsets: ["latin"], weight: "400" });

/** A 1×1 PNG data URL so we don't need a static asset pipeline. */
const PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

export function Hero() {
  const pathname = usePathname();
  return (
    <div
      className={inter.className}
      data-shot="hero"
      style={{
        display: "grid",
        placeItems: "center",
        height: "100vh",
        gap: 12,
        background: "#fafafa",
      }}
    >
      <Image src={PIXEL} alt="pixel" width={48} height={48} />
      <Link href="/about" data-shot="about-link">
        About
      </Link>
      <span data-shot="pathname" className={karla.className}>
        {pathname}
      </span>
    </div>
  );
}
