import type { Locale } from "./context";

/**
 * Where the user currently is in the app, resolved from the request pathname.
 * `descriptor` is a short English sentence injected into the system prompt;
 * `entity` (when present) lets the agent resolve deictic references like
 * "this recipe" to a concrete id without asking the user.
 */
export interface PageContext {
  descriptor: string;
  entity?: { type: "recipe"; id: string };
}

/**
 * Structured app areas used by the capability catalog to rank suggestions.
 * Areas without capability-relevant context (profile, settings, …) collapse
 * into "other".
 */
export type PageArea =
  | "dashboard"
  | "recipesList"
  | "recipeDetail"
  | "recipeEdit"
  | "recipeNew"
  | "mealPlans"
  | "nutrition"
  | "shopping"
  | "other";

export interface ResolvedPage {
  area: PageArea;
  entity?: { type: "recipe"; id: string };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The app routes under `/[locale]/...` using plain next/navigation, so
 * `usePathname()` returns a path that starts with the locale segment —
 * strip it before matching.
 */
function pageSegments(pathname: string, locale: string): string[] {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] === locale) segments.shift();
  return segments;
}

/** Map a (locale-prefixed) pathname to a structured page area + entity. */
export function resolvePageArea(
  pathname: string,
  locale: string
): ResolvedPage {
  const [section, second, third] = pageSegments(pathname, locale);

  if (section === "recipes") {
    if (!second) return { area: "recipesList" };
    if (second === "new") return { area: "recipeNew" };
    if (UUID_RE.test(second)) {
      const entity = { type: "recipe" as const, id: second };
      return third === "edit"
        ? { area: "recipeEdit", entity }
        : { area: "recipeDetail", entity };
    }
    return { area: "other" };
  }

  switch (section) {
    case "meal-plans":
      return { area: "mealPlans" };
    case "dashboard":
      return { area: "dashboard" };
    case "nutrition":
      return { area: "nutrition" };
    case "shopping":
      return { area: "shopping" };
    default:
      return { area: "other" };
  }
}

/** Map a (locale-prefixed) pathname to a PageContext. */
export function describePage(pathname: string, locale: Locale): PageContext {
  const { area, entity } = resolvePageArea(pathname, locale);

  switch (area) {
    case "recipesList":
      return {
        descriptor:
          "The user is on the recipes list page, browsing their recipe collection.",
      };
    case "recipeNew":
      return {
        descriptor:
          "The user is on the new-recipe page, creating a recipe by hand.",
      };
    case "recipeEdit":
      return { descriptor: "The user is editing a recipe.", entity };
    case "recipeDetail":
      return {
        descriptor: "The user is viewing a recipe's detail page.",
        entity,
      };
    case "mealPlans":
      return { descriptor: "The user is on the meal plans page." };
    case "dashboard":
      return { descriptor: "The user is on the dashboard." };
    case "nutrition":
      return { descriptor: "The user is on the nutrition page." };
    case "shopping":
      return { descriptor: "The user is on the shopping list page." };
  }

  switch (pageSegments(pathname, locale)[0]) {
    case "profile":
      return { descriptor: "The user is on their profile page." };
    case "settings":
      return { descriptor: "The user is on the settings page." };
    case "onboarding":
      return { descriptor: "The user is going through onboarding." };
    case "subscribe":
      return { descriptor: "The user is on the subscription page." };
    default:
      return { descriptor: "The user is somewhere in the DietAI app." };
  }
}
