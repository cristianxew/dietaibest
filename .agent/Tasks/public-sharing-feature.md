# Public Sharing (Recipes & Meal Plans)

Last Updated: 2026-06-12

## Overview

Users can mark recipes and meal plan templates as public. Public content is
discoverable in-app by any authenticated user, with the owner attributed by a
derived author name (never the raw email). Public meal plans additionally get
an unauthenticated share link.

## How it works

### Recipes
- `Recipe.isPublic` (default false). Toggle: checkbox in the recipe form
  (`RecipeFormBasics`, i18n key `recipes.makePublicLabel`).
- Browse: "Public Recipes" tab in `RecipesList` → `getPublicRecipes()`
  (`src/actions/recipe.ts`) — `isPublic: true, userId: { not: viewer }`.
- Detail: `getRecipe()` allows owner OR public; returns `viewerIsOwner`
  (computed server-side — do NOT compare `recipe.userId === recipe.user.id`,
  that was the original bug) and `authorName`. Edit page redirects non-owners.
- Favorites: users can favorite public recipes; the Favorites tab where clause
  is `favoritedBy + AND:[{ OR: [own, isPublic] }]` so privated recipes drop out.
  `toggleFavorite` guards the favoriting branch (own OR public only).

### Meal plans
- `MealPlanTemplate.isPublic` + `shareToken` (generated in create/update).
- Browse: "Discover" tab in `MealPlanner` → `PublicPlans.tsx` →
  `getPublicMealPlans()` (serverAction runtime). Duplicate button copies a
  public plan (`duplicateMealPlan` — copies are always private).
- Share link: copy button on `PlanSwitcher` cards (public plans only) →
  `/[locale]/share/meal-plan/[token]` (public-pages group, unauthenticated).
  Backed by `getMealPlanByShareToken` — `where: { shareToken, isPublic: true }`,
  so flipping a plan private kills the link (404).
- Middleware: `/share/` is in `PUBLIC_ROUTE_PREFIXES` (prefix-matched public
  routes in `src/middleware.ts`, checked in BOTH the route gate and the
  withAuth `authorized` callback).

## Author identity & privacy

- `User.displayName` (nullable). Public surfaces render
  `getAuthorName(user)` (`src/lib/author-name.ts`):
  `displayName?.trim() || email prefix`.
- **Invariant: raw emails must never be serialized to other users' clients.**
  Public-facing actions select email server-side, map through `getAuthorName`,
  and strip the email before returning.
- A settings editor for displayName is not built yet (follow-up scope).

## Indexes

- `Recipe`: `(userId)`, `(isPublic, createdAt)`
- `MealPlanTemplate`: `(isPublic, createdAt)` (plus existing userId/shareToken)

## Tests

- `tests/unit/recipe-visibility.test.ts` — where clauses, viewerIsOwner,
  toggleFavorite guard, email scrubbing
- `tests/unit/meal-plan-public.test.ts` — getPublicMealPlans, share token
- `tests/unit/author-name.test.ts` — getAuthorName

## Known residual debt

- Other hardcoded strings in `MealPlanForm` (macros hint, Cancel) — not i18n'd.
- `getMealPlans` calls `revalidatePath` inside a getter (pre-existing oddity).
- Discover tab has no search/filter UI yet (action supports `search`/`duration`).
