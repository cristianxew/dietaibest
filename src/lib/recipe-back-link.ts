/**
 * "Back" navigation for the recipe detail page.
 *
 * Pages that open a recipe pass their own in-app path along as `?from=<path>`
 * (e.g. `/meal-plans?selected=<id>`, `/dashboard`), so the detail page can send
 * the user back there instead of always to the recipe library. The value is
 * only ever used as a same-site path under the current locale: anything that
 * could point off-site is ignored, so the param can't become an open redirect.
 */

export type RecipeBackTarget = "recipes" | "meal-plans" | "dashboard" | "previous";

export type RecipeBackLink = {
  href: string;
  /** Which page `href` returns to; picks the link label ("previous" = generic "Back"). */
  target: RecipeBackTarget;
};

type SearchParamValue = string | string[] | undefined;

const MAX_FROM_LENGTH = 300;
/** Dummy origin used only to parse `from` as a relative URL and detect escapes. */
const PARSE_BASE = "http://internal.invalid";
/** Returning to a recipe form after viewing the recipe makes no sense. */
const RECIPE_FORM = /^\/recipes\/(new|[^/]+\/edit)\/?$/;

export const RECIPES_LIBRARY_PATH = "/recipes";

/** Return path for a recipe opened from the meal planner: the plan that was open. */
export function mealPlansReturnPath(planId?: string | null): string {
  return planId ? `/meal-plans?selected=${encodeURIComponent(planId)}` : "/meal-plans";
}

/**
 * Link to a recipe's page. `from` is the in-app path (without locale) that the
 * recipe page's "Back" link should return to.
 */
export function recipeHref(locale: string, recipeId: string, from?: string | null): string {
  const base = `/${locale}/recipes/${recipeId}`;
  return from ? `${base}?from=${encodeURIComponent(from)}` : base;
}

/**
 * Adds `from` to a recipe href built elsewhere (chat tool results carry
 * `/recipes/<id>`). A link to the page the user is already on is left alone.
 */
export function withReturnPath(href: string, from: string): string {
  if (from === href) return href;
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}from=${encodeURIComponent(from)}`;
}

/** `from` as a same-site path without the locale prefix, or null if unusable. */
function parseReturnPath(locale: string, from: SearchParamValue): { path: string; search: string } | null {
  if (typeof from !== "string" || from.length === 0 || from.length > MAX_FROM_LENGTH) return null;
  // Only root-relative paths: rejects "//host", "/\host", schemes and bare words.
  if (!from.startsWith("/") || from.startsWith("//") || from.includes("\\")) return null;

  let url: URL;
  try {
    url = new URL(from, PARSE_BASE);
  } catch {
    return null;
  }
  if (url.origin !== PARSE_BASE) return null;

  // Links built from the browser path may already carry the locale (non-default locales).
  let path = url.pathname;
  if (path === `/${locale}`) path = "/";
  else if (path.startsWith(`/${locale}/`)) path = path.slice(locale.length + 1);

  return { path, search: url.search };
}

function targetFor(path: string): RecipeBackTarget {
  if (path === "/meal-plans" || path.startsWith("/meal-plans/")) return "meal-plans";
  if (path === "/dashboard" || path.startsWith("/dashboard/")) return "dashboard";
  if (path === RECIPES_LIBRARY_PATH) return "recipes";
  return "previous";
}

export function resolveRecipeBackLink(
  locale: string,
  searchParams: { from?: SearchParamValue }
): RecipeBackLink {
  const library: RecipeBackLink = { href: `/${locale}${RECIPES_LIBRARY_PATH}`, target: "recipes" };

  const parsed = parseReturnPath(locale, searchParams.from);
  if (!parsed || RECIPE_FORM.test(parsed.path)) return library;

  const suffix = parsed.path === "/" ? "" : parsed.path;
  return { href: `/${locale}${suffix}${parsed.search}`, target: targetFor(parsed.path) };
}
