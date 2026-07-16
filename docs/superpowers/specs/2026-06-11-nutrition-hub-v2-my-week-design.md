# Nutrition Hub v2 — "Fix My Week" Design

**Date:** 2026-06-11
**Status:** Approved design, pending implementation plan
**Branch context:** builds on `feat/nutrition-learning-hub` (hub v1)

## Problem

Hub v1 is technically sound but operates on hypothetical data: curated food pairs, single foods, one meal at a time. The app already stores the user's real life — scheduled meal plans (`MealPlanSchedule` → `MealPlanDay` → `MealPlanMeal`), FDC-matched recipe ingredients (`RecipeIngredient.fdcId` + `gramWeight`), and a rich profile (`allergies`, `dietaryGoal`, `dietaryType`, macro targets, age/sex) — and the hub uses almost none of it. v2 answers the question users actually have: **"Is what I'm going to eat this week any good for ME, and what's the one thing I should change?"**

North star (user-approved): **Fix my week** — analyze the scheduled week against personal targets, surface ranked findings with culprit attribution, and close the loop with **one-tap plan edits**. Candidate fixes come from the **user's own recipe library first, AI-generated recipe as fallback** (cold start).

## Non-goals (v2)

- Consumption logging / adherence tracking ("I ate this") — plans are the intake proxy.
- Trends across weeks, streaks, week-over-week deltas (the serializable `WeekAnalysis` keeps this cheap to add later via a snapshot table).
- Family-member analysis — account owner only.
- Chat-agent tools for week analysis (the engine is designed so wrapping it later is trivial).
- Edamam anywhere in hub code (unchanged v1 policy).

## Architecture

```
MealPlanSchedule (active) ──┐
MealPlanDay + MealPlanMeal ─┤
RecipeIngredient (fdcId) ───┼─→ resolveScheduleWindow() ─→ aggregateRecipeNutrients (v1, reused)
UserProfile ────────────────┤            │
RdaProfile (v1, reused) ────┘            ▼
                              week-analysis.ts (pure) ─→ WeekAnalysis { days, findings, coverage }
                                         │
                                         ▼
                              swap-scorer.ts (pure) ─→ SwapSuggestion[] (deltas + tradeoffs)
                                         │
                                         ▼
                              applySwap() ─→ UPDATE MealPlanMeal.recipeId ─→ revalidate planner
```

- New pure modules live in `src/lib/nutrients/` beside the v1 engines; v1 `aggregate.ts`, `rda.ts`, `registry.ts`, `extract.ts` are reused untouched.
- One new server-action file: `src/actions/nutrition-week.ts` (uses the `serverAction` runtime wrapper).
- **No schema changes, no migration.** `WeekAnalysis` is computed on demand; it is a plain serializable object so a future snapshot table or agent tool wraps it without redesign.

### `resolveScheduleWindow(schedules, today)` — pure, TDD'd in isolation

Maps the next 7 calendar days to template `dayNumber`s via `MealPlanSchedule.startDate` + template duration. Timezone and boundary behavior (schedule start/end, overlapping schedules, days past duration) are exactly where naive date math fails silently, so this is its own unit-tested function. Days with no schedule coverage are reported as `unplanned`, never silently averaged.

## Engines

### `week-analysis.ts` (pure)

Input: resolved week (per meal: per-serving `NutrientVector` × `MealPlanMeal.servings`, plus per-meal coverage) + `RdaProfile`.

Output:

```ts
interface WeekAnalysis {
  generatedAt: string;
  days: DayAnalysis[];            // date, planned meals, day totals, fill % per nutrient, coverage
  weekTotals: NutrientVector;
  avgPerPlannedDay: NutrientVector;
  findings: Finding[];            // ranked, top 3 are the headline
  coverage: { fullMeals: number; partialMeals: number; macrosOnlyMeals: number; unplannedDays: number };
  personalized: boolean;          // from RdaProfile
}

interface Finding {
  id: string;
  kind: "deficit" | "excess";
  nutrient: NutrientKey;
  daysAffected: number;           // "sodium over on 5 of 5 planned days"
  weekGapAmount: number;          // total week shortfall/overage in the nutrient's unit
  topContributors: MealContribution[];
  severity: number;               // relative gap × days affected × direction weight
}

interface MealContribution {
  mealId: string;
  recipeId: string;
  recipeTitle: string;
  dayDate: string;
  mealType: string;
  share: number;                  // excess: fraction of overage contributed
}
```

- **Excess attribution:** contribution share of the nutrient per meal ("Tuesday's Carbonara contributes 38% of your sodium overage").
- **Deficit attribution:** there is no culprit; `topContributors` lists the best *replacement opportunities* — meals with the lowest density of the target nutrient (largest headroom for a swap).
- Sparse-vector rule carries over from v1: missing key = unknown, never zero. Unknowns never count toward gaps or attributions.
- Findings sentences are built in the UI from ICU messages (same pattern as v1 insights); the engine emits structured data only.

### `swap-scorer.ts` (pure, multi-objective)

`scoreSwaps(finding, candidates, context)` → ranked `SwapSuggestion[]`.

- **Primary score:** fraction of the finding's `weekGapAmount` the swap closes.
- **Penalty:** worsening any other active finding, or pushing a limit nutrient (sodium, satFat, sugar, cholesterol) toward its ceiling. A swap that fixes fiber with a sodium bomb must rank below a balanced one.
- **Hard filters:** same `mealType`; allergen tokens from `UserProfile.allergies` matched against ingredient `nameNorm` (best-effort narrowing, NOT a safety guarantee — disclaimer stays); replacement kcal within ±25% of the replaced meal (a nutrition fix must not blow up the plan's calorie structure).
- **Honest output:** each suggestion carries quantified week-level deltas for affected nutrients AND `tradeoffs[]` — nutrients that get worse. The UI shows tradeoffs; trust is the product.

```ts
interface SwapSuggestion {
  mealId: string;                 // meal being replaced
  candidateRecipeId: string;
  candidateTitle: string;
  deltas: Partial<Record<NutrientKey, number>>;  // week-level change
  gapClosure: number;             // 0..1+ of the finding's gap
  tradeoffs: NutrientKey[];       // worsened nutrients
  score: number;
}
```

## Server actions (`src/actions/nutrition-week.ts`)

| Action | Behavior |
|---|---|
| `getMyWeekAnalysis()` | Resolve window from active schedules → batch-load recipes' vectors through `getFoodsCached(extended)` → run engine. Stateless, on-demand. |
| `getSwapSuggestions({ mealId })` | Recompute analysis, score the user's library — recipes with FDC-matched ingredients, recent + favorites first, capped pool (~50). |
| `applySwap({ mealId, newRecipeId })` | Ownership-checked **in-place UPDATE of `MealPlanMeal.recipeId`** (preserves slot, `sortOrder`, `servings` — safer than remove+add). Returns previous `recipeId` for real undo. Revalidates planner + my-week paths. |
| `generateGapRecipe({ mealId, targetNutrients })` | AI fallback, only when the library has no candidate. Single Mastra step reusing existing workflow plumbing (`src/mastra/workflows/`) and the same entitlement gate as `generateMealPlan`. Persists the `Recipe` (owned by the user), runs FDC ingredient matching, and returns it with its **verified** profile for review — the user applies it through the same Apply/Undo flow; nothing is auto-applied. |

**AI honesty rule:** the generated recipe runs through the existing FDC ingredient-matching pipeline *before* any numbers are shown. AI proposes, USDA verifies — LLM-claimed nutrition is never displayed. If the verified profile doesn't close the gap, the truthful numbers are shown anyway.

## UX

- **`/nutrition/my-week`** (new route, protected):
  1. **Week strip** — 7 day chips, traffic-light status (sage / gold / coral), coverage dots, unplanned days visibly empty.
  2. **Top 3 Finding cards** — headline ICU sentence, culprit meals named, inline top-2 swap suggestions with deltas + tradeoffs, **Apply** → optimistic update + toast with **Undo**. Empty candidate pool → "Generate a recipe that fixes this" (entitlement-gated).
  3. **Full detail** — collapsible per-day nutrient heatmap, em-dash for unknowns.
- **Hub landing rework** — My Week becomes the hero card with a live one-line verdict ("protein on track · fiber 38% short · sodium over 3 days"); Featured Face-Off moves to secondary position.
- **Planner entry point** — one slim banner: "Nutrition check: 2 things to fix this week" → my-week. A link, not an embed.
- **Ask Dietai** — finding cards seed chat prompts (composer-seed only, `dietai:open-chat`, system prompt untouched per ADR-0001).
- `ProfileNudge` when `personalized === false`. `EducationalDisclaimer` on the route. All strings en/es/pl via next-intl.

## Edge cases & data honesty

- **No active schedule** → empty state + CTA to schedule a plan. No hypothetical analysis.
- **Unplanned days** → denominators say "5 of 5 *planned* days"; unplanned days never count as zero intake.
- **Coverage gating:** if >50% of the week's meals are `macrosOnly`, micro-findings are demoted entirely; the page leads with an "Improve your data" card listing recipes that need ingredient matching (deep-link to recipe editor). Macro findings (kcal/protein/carbs/fat/fiber from stored `Recipe` values) still work. Never headline a micronutrient verdict on majority-blind data.
- **Allergen filter** is token matching, presented as narrowing — not safety.
- Medical-claim wording rules from v1 apply (function statements only).

## Testing

Strict TDD (red-green) on every pure module:

- `resolveScheduleWindow` — timezone boundaries, schedule start/end edges, overlaps, unplanned gaps.
- `week-analysis` — golden week fixture (7 days, known vectors) → expected findings ranking, attribution shares, coverage math, sparse-vector handling.
- `swap-scorer` — gap closure ranking, tradeoff penalty ordering, allergen filter, kcal band, mealType filter, empty pool.
- Action-level: ownership checks on `applySwap`, coverage gating in `getMyWeekAnalysis` (mocked prisma).
- i18n parity test extension for new namespaces.
- Optional e2e happy path: my-week renders findings → apply swap → undo.

## Phasing (each independently shippable)

1. **Engines + read-only My Week page** — the mirror; already valuable.
2. **Swap suggestions + `applySwap` + undo** — the loop closes.
3. **AI gap-recipe fallback** — cold start solved.
4. **Hub landing rework + planner banner + polish.**
