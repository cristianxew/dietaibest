# Gemini 2.5 → Gemini 3.5 migration (Vertex)

**Date:** 2026-09-29
**Status:** Code defaults switched. Prod rollout needs the env changes below.

## Why

Google Cloud notice ("Review Gemini 2.5 model retirement schedules on Gemini
Enterprise Agent Platform", reminder of 2026-09-15). It lists project
`dietaibest` as using **Gemini 2.5 Flash**:

| Date | What happens |
|---|---|
| 2026-10-20 | Public retirement. Active projects keep working. **New or inactive projects are blocked.** A project is inactive if it made no call to the model between 2026-07-22 and 2026-10-20. |
| 2027-03-31 | Gemini 2.5 Flash / 2.5 Pro stop serving (all data-residency zones except KR/BR/FR). |
| 2027-01-28 | Gemini 2.5 Flash Lite stops serving (we don't use it). |

Google's recommended targets for 2.5 Flash: 3.8 / 3.7 / 3.5 Flash, 3.5 Flash
Lite, 3.1 Flash Lite. We skipped 3.1 Flash Lite because it already has a
shutdown date (2027-05-07).

## What changed

Every Gemini caller hardcoded `gemini-2.5-flash`. The defaults are now split by
task:

| Module | Job | Model | Why |
|---|---|---|---|
| `src/lib/chat/llm-gemma.ts` | Recipe import (photo / PDF / URL markdown → JSON) | `gemini-3.5-flash-lite` | Single-shot structured extraction. Same price as 2.5 Flash ($0.30 / $2.50 per 1M in/out). |
| `src/lib/ingredient-canonicalizer.ts` | Ingredient name → USDA term, macro estimates | `gemini-3.5-flash-lite` | Light normalization task. |
| `src/lib/recipe-analyzer.ts` | Nutrition Stage 2: USDA food pick + grams + cooked state | `gemini-3.5-flash` | Needs the most reasoning, and nutrition accuracy depends on it. About $1.50 / $9.00 per 1M. |

Not touched:
- `generateRecipeImage.ts` uses Imagen (`imagen-3.0-generate-002`). It's not in
  this retirement notice.
- `browser-use.ts` lists Browser-Use Cloud's own LLM options, which run on their
  account, not our GCP project.
- The chat agent and meal-plan workflows run on Anthropic.

### Gemini 3 behavior notes

- **Thought signatures**: not needed. Every call is a single-turn
  `generateContent` with no function calling or model turns in history.
- **Temperature**: none of the callers set one. Google recommends keeping the
  default 1.0 on Gemini 3, so leave it that way.
- **Thinking**: not configured, so each model's default applies (Flash-Lite:
  minimal, Flash: high). If the analyzer is too slow or too expensive, add
  `config.thinkingConfig.thinkingLevel = "low"` (or `"medium"`) in
  `recipe-analyzer.ts`. Don't combine it with `thinkingBudget`.

## Rollout checklist (prod / Dokploy)

1. **Remove `GEMMA_MODEL`** from the Dokploy env. Don't set it to a new value:
   it overrides the default of **all three** modules, so any value flattens the
   split (e.g. `gemini-3.5-flash-lite` would also downgrade the analyzer).
2. Check `GOOGLE_VERTEX_LOCATION` (default `us-central1`). If calls fail with a
   model-not-found / 404 error, the 3.5 models aren't served there. Set
   `GOOGLE_VERTEX_LOCATION=global`.
3. Smoke-test after deploy:
   - Import one recipe from a URL and one from a photo.
   - Run nutrition analysis on a recipe that isn't cached yet.
   - Watch the logs for `[llm-gemma]`, `[ingredient-canonicalizer]` and
     `[recipe-analyzer]` errors (the last two fail soft, so errors only show in
     logs and as an `UNRECOGNIZED` spike).
4. Optional quality gates:
   - `tests/eval/gemma-image-import.ts` (image import bar: ≥80% ingredients,
     ≥70% quantities).
   - The nutrition golden-recipe live recorder (`tests/eval/nutrition/`).
5. Recipe analyses cached under 2.5 Flash (`RecipeAnalysisCache`,
   `IngredientNameCache`) stay valid. They are only recomputed when the input
   changes, so no backfill is needed.
