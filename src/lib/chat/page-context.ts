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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Map a (locale-prefixed) pathname to a PageContext. The app routes under
 * `/[locale]/...` using plain next/navigation, so `usePathname()` returns a
 * path that starts with the locale segment — strip it before matching.
 */
export function describePage(pathname: string, locale: Locale): PageContext {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] === locale) segments.shift();

  const [section, second, third] = segments;

  if (section === "recipes") {
    if (!second) {
      return {
        descriptor:
          "The user is on the recipes list page, browsing their recipe collection.",
      };
    }
    if (second === "new") {
      return {
        descriptor:
          "The user is on the new-recipe page, creating a recipe by hand.",
      };
    }
    if (UUID_RE.test(second)) {
      if (third === "edit") {
        return {
          descriptor: "The user is editing a recipe.",
          entity: { type: "recipe", id: second },
        };
      }
      return {
        descriptor: "The user is viewing a recipe's detail page.",
        entity: { type: "recipe", id: second },
      };
    }
  }

  switch (section) {
    case "meal-plans":
      return { descriptor: "The user is on the meal plans page." };
    case "dashboard":
      return { descriptor: "The user is on the dashboard." };
    case "nutrition":
      return { descriptor: "The user is on the nutrition page." };
    case "shopping":
      return { descriptor: "The user is on the shopping list page." };
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
