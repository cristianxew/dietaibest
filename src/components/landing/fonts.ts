import { JetBrains_Mono, Playfair_Display } from "next/font/google";

/**
 * Landing-only fonts. The root layout loads Playfair without italics, which
 * would make the landing's `<em>` accents faux-italic, so the landing loads its
 * own display face (with italics) plus the mono used for eyebrows and labels.
 * Consumed through the `font-lp-display` / `font-lp-mono` utilities.
 */
export const landingDisplay = Playfair_Display({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-landing-display",
  display: "swap",
});

export const landingMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-landing-mono",
  display: "swap",
});
