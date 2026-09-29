import Image from "next/image";
import { cn } from "@/lib/utils";

// The source PNGs are 3163×1029; 123×40 keeps that ratio at the nav height.
const WIDTH = 123;
const HEIGHT = 40;

interface BrandLogoProps {
  /** Preload the image (use for the above-the-fold nav logo). */
  priority?: boolean;
  /** Sizing overrides; the logo is sized by height (`h-10` by default) with auto width. */
  className?: string;
}

/**
 * Full DietAI logo (chef mark + wordmark). Renders the navy/coral artwork in
 * light mode and the white artwork in dark mode; only one is ever displayed.
 */
export function BrandLogo({ priority = false, className }: BrandLogoProps) {
  const sizing = cn("h-10 w-auto", className);

  return (
    <>
      <Image
        src="/Dietai_logo_light.png"
        alt="DietAI"
        width={WIDTH}
        height={HEIGHT}
        priority={priority}
        className={cn("block dark:hidden", sizing)}
      />
      <Image
        src="/Dietai_logo_dark.png"
        alt="DietAI"
        width={WIDTH}
        height={HEIGHT}
        priority={priority}
        className={cn("hidden dark:block", sizing)}
      />
    </>
  );
}
