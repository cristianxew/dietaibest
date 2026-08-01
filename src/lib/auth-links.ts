import { defaultLocale, locales, type Locale } from "@/i18n/request";

/**
 * Helpers for building the URLs Supabase Auth redirects back to, and for
 * reading the parameters it returns.
 *
 * Two constraints drive this module:
 *
 * 1. Routing — every app page lives under `src/app/[locale]`, and the
 *    next-intl middleware runs with `localePrefix: "as-needed"`. A URL without
 *    a locale prefix is rewritten to `/{defaultLocale}{pathname}`, so any path
 *    we hand to Supabase must exist under `[locale]`, and non-default locales
 *    must carry their prefix explicitly.
 *
 * 2. Flow — the Supabase client uses the default `flowType: "implicit"`, so
 *    magic-link and recovery links come back with the tokens (or the error)
 *    in the URL *fragment*, not the query string. Anything that only reads
 *    `useSearchParams()` will miss both.
 */

/** Path (locale-less) of the page that finishes a magic-link sign-in. */
export const AUTH_CALLBACK_PATH = "/auth/callback";

/** Path (locale-less) of the page where a user sets a new password. */
export const AUTH_RESET_PASSWORD_PATH = "/auth/reset-password";

function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/**
 * Locale prefix for a path under `localePrefix: "as-needed"`.
 * Empty for the default locale, `/{locale}` otherwise.
 */
export function localePrefix(locale: string): string {
  if (!isLocale(locale) || locale === defaultLocale) {
    return "";
  }
  return `/${locale}`;
}

/**
 * Absolute URL for a Supabase `emailRedirectTo` / `redirectTo` option.
 *
 * The result must be registered in the Supabase dashboard under
 * Authentication → URL Configuration → Redirect URLs (a `https://domain/**`
 * wildcard covers every locale), otherwise Supabase silently falls back to the
 * configured Site URL.
 */
export function buildAuthRedirectUrl({
  origin,
  locale,
  path,
  params,
}: {
  origin: string;
  locale: string;
  path: string;
  params?: Record<string, string | undefined>;
}): string {
  const url = new URL(`${localePrefix(locale)}${path}`, origin);
  for (const [key, value] of Object.entries(params ?? {})) {
    if (value) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

export interface AuthCallbackParams {
  /** Supabase error slug, e.g. `access_denied`. */
  error?: string;
  /** Fine-grained reason, e.g. `otp_expired`. */
  errorCode?: string;
  errorDescription?: string;
  /** PKCE authorization code (present only when the client uses PKCE). */
  code?: string;
  /** Link type: `magiclink`, `recovery`, `signup`, ... */
  type?: string;
  /** Where to send the user once the session is established. */
  redirect?: string;
}

/**
 * Read Supabase callback parameters from BOTH the query string and the URL
 * fragment. The implicit flow returns errors and tokens in the fragment, so
 * reading only `location.search` reports "no session" instead of the actual
 * reason (expired link, already used, denied).
 */
export function readAuthCallbackParams(
  search: string,
  hash: string
): AuthCallbackParams {
  const query = new URLSearchParams(
    search.startsWith("?") ? search.slice(1) : search
  );
  const fragment = new URLSearchParams(
    hash.startsWith("#") ? hash.slice(1) : hash
  );

  const pick = (key: string) =>
    query.get(key) ?? fragment.get(key) ?? undefined;

  return {
    error: pick("error") || undefined,
    errorCode: pick("error_code") || undefined,
    errorDescription: pick("error_description")?.replace(/\+/g, " ") || undefined,
    code: pick("code") || undefined,
    type: pick("type") || undefined,
    redirect: query.get("redirect") || undefined,
  };
}

export type AuthFailureKind = "expired" | "invalid" | "denied" | "error";

/**
 * Map a Supabase callback error onto the states the callback UI renders.
 * Keeps the "request a new link" affordance tied to the cases where a new
 * link actually helps.
 */
export function classifyAuthFailure(
  params: Pick<AuthCallbackParams, "error" | "errorCode">
): AuthFailureKind {
  const { error, errorCode } = params;

  if (errorCode === "otp_expired" || errorCode === "email_link_invalid") {
    return "expired";
  }
  if (error === "access_denied") {
    return "denied";
  }
  if (error === "invalid_request" || error === "invalid_grant") {
    return "invalid";
  }
  return "error";
}

/**
 * Only same-origin, absolute-path redirects are followed after sign-in, so a
 * crafted `?redirect=` cannot bounce a freshly authenticated user off-site.
 */
export function safeRedirectPath(
  redirect: string | undefined,
  fallback = "/dashboard"
): string {
  if (!redirect) return fallback;
  if (!redirect.startsWith("/") || redirect.startsWith("//")) return fallback;
  return redirect;
}
