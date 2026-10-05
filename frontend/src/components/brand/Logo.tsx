import Image from "next/image";
import { cn } from "@/lib/cn";

// Vector files in public/brand, traced from the supplied artwork (originals
// in docs/brand). `tone` picks the colour for the surface the logo sits on:
// "ink" for light backgrounds, "white" for the dark footer.
type Tone = "ink" | "white";

/** The small mark — the O with the runner. The default logo everywhere. */
export function LogoMark({ tone = "ink", className }: { tone?: Tone; className?: string }) {
  return (
    <Image
      src={tone === "white" ? "/brand/mark-white.svg" : "/brand/mark.svg"}
      alt="ΑΛΛΟΥ"
      width={74}
      height={73}
      unoptimized // already an SVG — nothing for the image optimizer to do
      className={cn("h-9 w-auto", className)}
    />
  );
}

/** The full vertical lockup with the tagline. Needs room: below roughly
 * 240px wide the tagline text becomes too small to read. */
export function LogoFull({ tone = "ink", className }: { tone?: Tone; className?: string }) {
  return (
    <Image
      src={tone === "white" ? "/brand/logo-white.svg" : "/brand/logo.svg"}
      alt="ΑΛΛΟΥ — Travel beyond the finish lines"
      width={271}
      height={356}
      unoptimized
      className={cn("h-auto w-[260px]", className)}
    />
  );
}
