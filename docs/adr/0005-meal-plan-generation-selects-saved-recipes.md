# Meal-plan generation selects from saved recipes (index, not id)

**Status:** accepted

The chat tool `generateMealPlan` runs `generateMealPlanWorkflow`
(skeleton → fanout → persist). Its fanout step asked Claude Haiku to "Return
ONLY a recipe ID string (like "recipe-123")" with no tools and no access to the
user's recipes. The model complied — a real call returned `recipe-456` — and
`createMealPlan` rejected every such id at validation
(`mealPlanMealItemSchema.recipeId` is `z.string().uuid()`), so **every real run
failed** with `Invalid input: Invalid uuid` after spending one Sonnet call and
one Haiku call per slot. Unit tests mocked both the models and
`createMealPlan`, and their fanout fixture returned the same invalid shape, so
nothing caught it. This ADR records how the step now resolves recipes.

## Decisions

1. **The model picks an index; the server owns the id.** The tool loads a
   candidate pool once and passes it into the workflow. Each fanout call gets
   the pool as a numbered list and answers `{ index }` via structured output
   (`generateObject`). `pickCandidate` maps the index to a real recipe UUID;
   anything invalid (out of range, non-integer) fails **that slot** through the
   existing `generationFailed` / 25%-threshold path. A model answer can no
   longer reach the database as an id.

2. **Candidate pool = own recipes + favorited recipes that are still public.**
   Same visibility rule as the favorites tab in `getRecipes`. Capped at 150,
   newest first. Other users' public recipes (the Discover pool) are not
   included — no cross-user surprises, and quality stays tied to what the user
   curated.

3. **Empty pool fails fast.** No saved recipes → the tool returns
   "No saved recipes to plan from — import or create recipes first" before any
   model call (`NoCandidateRecipesError`, code `NO_RECIPES`, also thrown by the
   skeleton step as defense in depth). Generating brand-new recipes for empty
   slots is deliberately out of scope (see Follow-ups).

4. **Profile defaults are applied by the tool, not the chat agent.** The tool
   merges `UserProfile` into the request: explicit input > profile
   (`dailyCalories`, macro grams, `dietaryType`) > nothing. `allergies` always
   come from the profile. Allergens are pre-filtered deterministically on recipe
   title/tags, and restated as hard exclusions in both prompts (ingredient JSON
   is too free-form for reliable substring matching).

5. **`createMealPlan` checks recipe visibility.** Every explicit
   `days[].meals[].recipeId` must be the caller's own recipe or a public one.
   This closes a hole independent of the AI path: a UUID-shaped id for another
   user's private recipe was previously accepted.

6. **Schema alignment.** The skeleton's `mealType` is a per-run `z.enum` of the
   requested meal types, `planName` is 3–100 chars, and `mealsPerDay` is
   `min(2)` in both the tool and the workflow — all matching
   `mealPlanTemplateFormSchema`, so persist can't fail on shapes the model
   produced.

7. **Gate on the marketed feature.** `generateMealPlan.requiresFeature` is
   `aiMealPlan` (what billing sells as "AI meal plans"), not `aiChat`. Both are
   Pro-only today, so there is no behavioral change.

## Alternatives rejected

- **Give the fanout model a `searchRecipes` tool.** Two or more round trips per
  slot × up to 56 slots, non-deterministic, and the returned id still needs
  server-side validation. Index selection is one call per slot.
- **Let the model return an id and validate it afterwards.** Still lets the
  model hallucinate; validation would only turn a bad id into a failed slot.
  Indices make the valid answer space explicit.

## Follow-ups

- Generate recipes for slots the library can't fill (reuse the
  `generateGapRecipe` design in
  `docs/superpowers/specs/2026-06-11-nutrition-hub-v2-my-week-design.md`).
- Reduce repeats across the week (resolve per day with already-chosen recipes
  in the prompt) and cache the candidate block (`providerOptions` on a system
  message triggers an AI SDK prompt-injection warning; needs a clean pattern).
- e2e auth fixture so `e2e/chat-meal-plan.spec.ts` can drop `test.fixme`.
- Consider a profile summary in the general chat system prompt (today only
  `generateMealPlan` reads the profile).

## Tests

- `tests/integration/meal-plan-workflow-persist.test.ts` — tool → workflow →
  **real** `createMealPlan`/`serverAction`/zod schema; only next-auth,
  next/cache, Prisma and the models are faked. Fails against the old code with
  `Invalid input: Invalid uuid`.
- `tests/unit/meal-plan-create-visibility.test.ts`,
  `tests/unit/meal-plan/generation-{candidates,profile}.test.ts`.
