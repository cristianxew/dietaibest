# Nutrition Learning Hub

**Status:** v2 shipped (branch `feat/nutrition-learning-hub`)
**Last Updated:** 2026-06-11

## Overview

The `/nutrition` route is a learning destination ("Nutrition Hub") instead of a single-purpose calculator. Goal: conscious eating — users compare foods, measure meals against their personal daily needs, and learn what nutrients do.

## Routes

| Route | Module |
|---|---|
| `/nutrition` | Hub landing: module cards + daily-rotating Featured Face-Off teaser |
| `/nutrition/compare` | Food Face-Off — side-by-side full nutrition; shareable `?a=fdc:<id>&b=recipe:<uuid>` |
| `/nutrition/vs-day` | Meal vs Your Day — fill-your-day bars against personalized RDA |
| `/nutrition/nutrients` | Nutrient Encyclopedia index (18 nutrients) |
| `/nutrition/nutrients/[slug]` | Nutrient detail: prose + live USDA top sources |
| `/nutrition/swaps` | Smart Swaps — curated pairs, deltas computed from USDA data |
| `/nutrition/calculator` | The original calculator (relocated, i18n-fixed) |

## Architecture

- **Pure logic** in `src/lib/nutrients/`: `registry.ts` (22 nutrients, USDA numbers, goal/limit/neutral direction), `extract.ts` (sparse `NutrientVector` — missing key = unknown, NEVER zero), `aggregate.ts` (recipe ingredient aggregation with `full|partial|macrosOnly` coverage), `insights.ts` (deterministic threshold rules — NO LLM; UI builds sentences from ICU messages), `rda.ts` + `rda-data.ts` (NIH DRI brackets by sex×age; precedence userTarget > DRI > derived > FDA DV), `compare-url.ts`, `encyclopedia.ts`, `swaps-data.ts`.
- **Server actions** in `src/actions/nutrition-hub.ts` (`getItemProfiles`, `searchMyRecipes`, `getMyRdaProfile`) via the `serverAction` runtime.
- **Components** in `src/components/nutrition-hub/` (compare/, vs-day/, nutrients/, swaps/, shared/).
- **Data**: USDA FDC only. `fdcFoodsByIds` fetches the extended nutrient set; `FdcCache.nutrientProfile` column (`core`|`extended`) drives profile-aware cache staleness in `getFoodsCached(ids, { profile })`. **No Edamam imports anywhere in hub code** (per-user macro cache policy); Edamam-sourced recipes degrade to the 5 macros stored on `Recipe`.
- **Ask Dietai**: seeds the chat composer via the `dietai:open-chat` CustomEvent (`src/lib/chat/open-chat.ts`); user presses send. System prompt untouched (ADR-0001).
- **i18n**: namespaces `nutritionHub.*`, `nutrition.calculator.*`, `chat.seeds.nutritionHub.*` in en/es/pl. Parity locked by `tests/unit/i18n-nutrition-hub-parity.test.ts`.

## Gotchas

- Dev server caches message catalogs — restart `bun dev` after editing `messages/*.json` or keys render raw.
- USDA food descriptions are English-only in all locales (no translation layer).
- `prisma migrate dev` wants to RESET the remote dev DB (pre-existing drift). Use: hand-written migration SQL → `prisma db execute --schema` → `migrate resolve --applied` → `generate`.
- fdcIds in `swaps-data.ts`/`encyclopedia.ts` are live-verified; when adding pairs, verify via `/api/fdc/search` — memory-guessed ids WILL betray you (168421 turned out to be kale, not iceberg).
- Insight absolute floors are tuned for raw per-100g duels; `SwapCard` relaxes them (ratio story matters for swaps).

## v2 — Fix My Week (shipped)

Spec: `docs/superpowers/specs/2026-06-11-nutrition-hub-v2-my-week-design.md`. Plan: `docs/superpowers/plans/2026-06-11-nutrition-hub-v2-my-week.md`.

- **`/nutrition/my-week`** — analyzes the next 7 scheduled days (active `MealPlanSchedule`s) against the personal `RdaProfile`: week strip, top-3 ranked Findings with culprit attribution, collapsible nutrient×day heatmap.
- **Engines** (pure, TDD'd): `src/lib/nutrients/schedule-window.ts` (date→dayNumber, mirrors `getActiveMealPlanSchedule` semantics — plans do NOT cycle), `week-analysis.ts` (Findings: goal deficit = <70% target on majority of known days; limit excess = over ceiling on ≥2 days; kcal both directions; carbs/fat never), `swap-scorer.ts` (multi-objective: gap closure − 0.5×penalty for worsening other findings; hard filters: ±25% kcal band, allergen tokens, candidate must know target nutrient; honest `tradeoffs[]`).
- **`src/lib/recipeNutrients.ts`** — batched recipe→profile resolver (1 prisma query + 1 `getFoodsCached` for the whole week); `nutrition-hub.ts` delegates to it.
- **Actions** (`src/actions/nutrition-week.ts`): `getMyWeekAnalysis`, `getSwapSuggestions`, `applySwap` (in-place `MealPlanMeal.recipeId` UPDATE, returns `previousRecipeId` for undo), `matchRecipeIngredients`, `generateGapRecipe`.
- **KEY DISCOVERY:** nothing else in the repo writes `RecipeIngredient` rows — `analyzeRecipeAction` computed FDC matches but they were never persisted, so all recipes were `macrosOnly`. `matchRecipeIngredients` is the one-tap fix surfaced by the "Improve your data" card; micro-analysis only activates as users run it.
- **AI honesty rule:** `generateGapRecipe` drafts via `getSkeletonModel()`, persists the recipe, then runs FDC matching BEFORE showing numbers — LLM-claimed nutrition is never displayed; nothing is auto-applied. Gated by `assertCanUseAiMealPlan` + `assertCanCreateRecipe`. Generated recipes get tags `["generated", "nutrition-fix"]`.
- **Coverage gating:** >50% macrosOnly meals → findings restricted to kcal/protein/fiber and the Improve-data card goes prominent.
- Hub landing leads with `MyWeekHero` (live verdict); `/meal-plans` shows `PlannerNutritionBanner` when findings exist.
- Servings semantics match the planner's own `calculateMealMacros`: per-serving × `MealPlanMeal.servings`.

### v2 gotchas

- Swap suggestions depend on ingredient-match coverage: a target nutrient absent from a candidate's vector excludes it (sparse = honest). With a macrosOnly library, only kcal/protein/fiber findings get suggestions — and fiber only for recipes whose stored `fiber` is non-null (the Edamam auto-analysis writes only calories/protein/carbs/fat).
- LLM JSON output needs defensive parsing: `extractJsonObject` (first `{` to last `}`) + `z.coerce.number()`; raw output is logged on parse failure.
- When the scorer rejects a freshly generated recipe for the slot, the UI still shows "Created {title}" — the recipe exists in the library either way.

## Phase 3 (not built)

Quiz/"guess the food" game, meal-plan-day vs day comparison, gamification/streaks, per-swap prose, consumption logging (plans are the intake proxy), week-over-week trends (persist `WeekAnalysis` snapshots when needed — it's plain JSON).

## Testing

`tests/unit/nutrients/*` (registry, extract, aggregate, insights — golden banana-vs-apple case, rda brackets/fallbacks, compare-url, encyclopedia + swaps data integrity, fdcRepo profile staleness) + i18n parity. All TDD'd. Run: `bun run test:unit`.
