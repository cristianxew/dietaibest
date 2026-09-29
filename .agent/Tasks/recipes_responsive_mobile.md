# Recipes Library & Detail — Mobile / Tablet Responsive Pass

**Date:** 2026-09-29
**Status:** Completed

## Problem

On phones the recipes library (`/recipes`) was hard to use:

- The sticky control panel stacked search + category select + difficulty select +
  tabs + view switcher + "Add recipe" into ~380px that stayed pinned while
  scrolling, leaving ~160px of a 667px screen for recipes.
- The bar was pinned with `top-16` inside `#main-content`, which is already the
  scroll container *below* the fixed mobile header — so cards scrolled through a
  64px gap above the bar.
- Card favorite/delete actions were hover-only. Tailwind v4 gates `hover:` behind
  `@media (hover: hover)`, so on touch screens they were unreachable (and the
  list-view delete button was invisible but still tappable).
- Pagination rendered up to 11 buttons and overflowed narrow screens.
- The search input used `text-sm` (14px), which makes iOS Safari zoom on focus.
- The detail page time-stats bar and action row overflowed at 375px.

## Solution (decided with the product owner)

| Decision | Choice |
|---|---|
| Filters on mobile | Bottom drawer (vaul `Drawer`) behind a "Filters" button with an active-count badge |
| Sticky behavior | Toolbar hides on scroll down, reappears on scroll up (below `lg`) |
| "Add recipe" on mobile | Next to the page title |
| Scope | Library list + recipe detail page |

Desktop (`lg+`) keeps the previous layout.

### Breakpoint behavior of the library toolbar

| Width | Row 1 | Row 2 | Elsewhere |
|---|---|---|---|
| `< sm` (phones) | search + icon-only Filters button | full-width tabs with short labels (`tabsShort.*`) | view switch + per-page inside the drawer; Add button in header |
| `sm`–`lg` (tablets) | search + "Filters" button | tabs + view switch | per-page inside the drawer; Add button in header |
| `lg+` (desktop) | search + category/difficulty selects | tabs + view switch + Add button | per-page select in results row |

Active category/difficulty filters are also shown as removable chips in the
results summary on every size — the only visible trace of drawer filters on
phones.

## Files

- `src/hooks/use-hide-on-scroll.ts` — **new.** Hide-on-scroll-down hook. Finds the
  nearest scrolling ancestor (the protected shell scrolls `#main-content`, not
  `window`), uses an 8px direction tolerance, never hides near the top, while
  focus is inside the bar, or while `disabled` (search suggestions open).
  Returns a callback ref so it attaches when the bar mounts after the skeleton.
- `src/components/recipes/RecipeFiltersDrawer.tsx` — **new.** Trigger button +
  bottom drawer with chip selectors (category, difficulty, view (`< sm` only),
  recipes per page). Filters apply live; footer has "Clear" and
  "Show N recipes" (closes). Exports `ITEMS_PER_PAGE_OPTIONS`.
- `src/components/recipes/RecipesList.tsx` — compact toolbar, sticky `top-0`,
  full-bleed margins matched to the new page gutters (`-mx-4 sm:-mx-6 lg:-mx-10`),
  removable filter chips, mobile pagination ("Previous · Page X of Y · Next"),
  scroll-to-top of the list on page change, `sm:grid-cols-2` grid, i18n for the
  previously hardcoded search/pagination strings.
- `src/app/[locale]/(protected-pages)/recipes/page.tsx` — tighter phone gutters
  (`px-4 py-5 sm:p-6 lg:p-10`), header with `AddRecipeButton` below `lg`,
  translated eyebrow.
- `src/components/recipes/RecipeCard.tsx` — `pointer-coarse:` variants keep the
  heart visible/tappable on touch; delete is hidden on touch (it lives on the
  detail page); list view is compact on phones (smaller thumbnail, badges hidden,
  1-line description); shorter `16/10` image on phones.
- `src/components/recipes/RecipeDetailClient.tsx`, `RecipeScalableContent.tsx`,
  `InstructionsList.tsx`, `IngredientsList.tsx`, `MacroDisplay.tsx`,
  `RecipeFavoriteButton.tsx` — phone gutters/typography, equal-width stats bar,
  icon-only favorite on phones (`labelClassName`) so "Add to plan" fits, owner
  image actions visible on touch, translated "Ingredients"/"Total"/"Add to plan".
- `messages/{en,es,pl}.json` — new `recipes.*` keys: `libraryEyebrow`,
  `tabsShort.*`, `filters.*`, `search.*`, `gridView`, `listView`, `pagination`,
  `firstPage`, `lastPage`, `goToPage`, `totalTime`, `addToPlan`; `pageOf` fixed
  to ICU syntax (`{current}`, was `{{current}}`).

## Gotchas

- **Sticky offsets inside the protected shell:** `#main-content` is the scroll
  container and already starts below the 64px mobile header. Sticky children
  use `top-0`, not `top-16`.
- **Hover-only actions:** Tailwind v4 `hover:`/`group-hover:` never fire on touch.
  Pair them with `pointer-coarse:` variants (or render the action elsewhere).
- **iOS input zoom:** inputs need ≥16px text on touch (`text-base lg:text-sm`).
- **Global heading font:** `h1–h6` get the Playfair display stack from
  `globals.css`; small uppercase section labels rendered as headings need
  `font-sans`.

## Verification

Checked with Playwright against a local Postgres seed at 375×667, 390×844,
768×1024 and 1440×900: no horizontal overflow on list, list view or detail; the
toolbar measures ~122px on phones (was ~380px), hides on scroll down and returns
on scroll up; drawer filters, removable chips, list view, search suggestions,
pagination and the detail page render correctly. `tsc --noEmit` and ESLint pass.

## Follow-ups (not in scope)

- Category names on cards/detail still show the raw DB name (e.g. "DINNER")
  instead of `categoryNames.*`.
- `MacroDisplay` still hardcodes "Fiber" and the English "serving(s)" suffix.
- The protected shell uses `100vh` (`ChatContainer`); `100dvh` would avoid the
  iOS Safari toolbar overlapping the bottom of the scroll area.
