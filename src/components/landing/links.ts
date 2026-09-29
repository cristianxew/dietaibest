import { localePrefix } from "@/lib/auth-links";

/** Locale-less paths the landing links to. `/privacy`, `/terms` and `/cookies` are the legal pages. */
export type LandingRoute =
  | "/"
  | "/sign-in"
  | "/sign-up"
  | "/privacy"
  | "/terms"
  | "/cookies";

/**
 * Locale-aware href under `localePrefix: "as-needed"`:
 * `("es", "/sign-up")` → `/es/sign-up`, `("en", "/sign-up")` → `/sign-up`,
 * `("pl", "/")` → `/pl`. In-page anchors (`#features`) need no prefix.
 */
export function localizedHref(locale: string, path: LandingRoute): string {
  const prefix = localePrefix(locale);
  if (path === "/") return prefix || "/";
  return `${prefix}${path}`;
}
