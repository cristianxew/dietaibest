"use client";

import React from "react";
import { cn } from "@/lib/utils";

type LogoTone = "auto" | "light" | "dark";

interface LogoSymbolProps {
  size?: number;
  /**
   * `auto`  — navy glyph on light surfaces, white glyph on dark surfaces.
   * `light` — always the white glyph (use on dark backgrounds, e.g. the FAB).
   * `dark`  — always the navy glyph.
   */
  tone?: LogoTone;
  className?: string;
}

const NAVY = "/Dietai_logo_symbol.svg";
const WHITE = "/Dietai_logo_symbol_dark.svg";

export function LogoSymbol({ size = 24, tone = "auto", className }: LogoSymbolProps) {
  const dimensions = { width: size, height: size };

  if (tone === "light") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={WHITE} alt="DietAI" {...dimensions} className={cn("block", className)} />
    );
  }
  if (tone === "dark") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={NAVY} alt="DietAI" {...dimensions} className={cn("block", className)} />
    );
  }
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={NAVY} alt="DietAI" {...dimensions} className={cn("block dark:hidden", className)} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={WHITE} alt="" aria-hidden {...dimensions} className={cn("hidden dark:block", className)} />
    </>
  );
}
