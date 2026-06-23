# Nutrition engine: LLM-primary canonicalization, own USDA, honest output

**Status:** Redesign approved (LLM-primary) — supersedes the prior "cached
fallback, default off" design. **Phase A+B implemented** (2026-06-22): the
LLM-primary single-pass pipeline + honest data contract are live behind
`INGREDIENT_LLM_FALLBACK`; Stage 2, persistence (RecipeAnalysisCache), Edamam
retirement, the UI surfacing, and the flag flip are pending (see
"Implementation status" below).
**Date:** 2026-06-22
**Branch:** `feature/nutrition-calc-improvements`
**Related:** [ADR 0003](../../docs/adr/0003-llm-primary-nutrition-canonicalization.md) ·
[.agent/System/nutrition_units.md](../System/nutrition_units.md) (FDC pipeline +
harness + match guard)

> **History:** v1 of this doc specced the LLM as a *fallback* behind the static
> `SYNONYMS` table, default off. A grill-me design session (2026-06-22) found
> that the synonym table both (a) cannot cover open-ended multilingual vocab and
> (b) *pre-empts* the fallback by producing generic-but-wrong matches that pass
> the guard. The architecture was inverted to LLM-primary. See ADR 0003.

## Context / problem

Three findings (see ADR 0003 for detail):

1. **`SYNONYMS` (348 lines) is the wrong tool** — open-ended hand-maintained
   translation that over-collapses multi-word names (`"pasta miso"`→`"pasta"`),
   producing generic matches that pass the guard and block the LLM fallback. The
   losos-miso carbs gap (−60%) is this pre-emption, not a missing entry.
2. **The total silently absorbs per-ingredient failure** — a no-match → 0 g →
   folded into a confident total. The signal to be honest already exists
   (`confidence`, `fdcId: null`) but is discarded.
3. **Edamam's licence forbids caching micronutrients** — the product's core
   need. USDA FDC is public domain → cacheable. This is the migration driver.

## Goal

Own a reliable nutrition engine on USDA FDC, where LLM canonicalization is the
**primary** normalizer, the output is **honest** about per-ingredient
confidence, and the full nutrient profile is **cacheable** — matching Edamam's
*capability contract* without its data licence. Measured by the real-tier
golden-recipe harness.

## Non-goals (v1)

- The LLM does **not** pick FDC food ids — it normalizes the name and (on a true
  miss) estimates macros. Deterministic search/rank/guard still choose the food.
- No semantic/embedding search over USDA (revisit only if matching plateaus).
- Recipe classification beyond diet/health labels + cooked-weight (e.g.
  glycemic/inflammatory indices) is out of scope.

## Architecture — single pass, two cached LLM stages

```
Recipe (lines + servings)
  → parseIngredientLine            (qty / unit / name — NO synonyms)
  → ① LLM name stage               canonicalize + macro-estimate-on-miss
        cache: IngredientNameCache (by name, system-wide, ~0 after warmup)
  → staple-pin? → FDC search → rank → matchPlausible guard
  → resolveGramWeight              (qty × unit → grams)
  → ② LLM recipe stage             cooked/raw + retention + diet/health labels
        cache: RecipeAnalysisCache (by generateRecipeFingerprint)
  → Honest output contract:
        per item { 22-nutrient profile, grams, confidence, status, source }
        + recipe totals + per-serving + %DV + coverage ("12/13 resolved")
```

**Deleted/retired:** `SYNONYMS` map · two-pass retry + `rawName` · Edamam engine.
**Kept:** `STAPLE_FDC_IDS` (verified pins) · `matchPlausible` guard ·
`resolveGramWeight`. Shopping-list reuses the same cached canonical identity.

## Components

### ① LLM name stage — `ingredient-canonicalizer.ts` + `ingredient-name-repo.ts`
- Existing `IngredientCanonicalizer` (Gemini 2.5 Flash, Vertex, structured
  output). Extend the prompt/schema to also return per-100g macro **estimates**
  for foods absent from USDA, marked as estimates.
- `canonicalizeCached` becomes primary (no longer flag-short-circuited off by
  default once rolled out). Reads `IngredientNameCache`, batches misses to the
  LLM, upserts (including `null` = not a food). Keyed by normalized raw name.

### ② LLM recipe stage — new
- Input: the full recipe (title + ingredient lines + matched foods). Output:
  per-ingredient `{ cookedState: raw|cooked, retentionFactor }` + recipe
  `dietLabels`/`healthLabels`. Cached by `generateRecipeFingerprint`
  (`src/lib/edamam.ts:123`) in a new `RecipeAnalysisCache`.
- **Safety:** when `cookedState` confidence is low → default to raw-as-entered,
  set a flag; never silently scale grams.

### Output contract — `IngredientProfileResult` extension
- Add `status: "OK" | "ESTIMATED" | "UNRECOGNIZED" | "MISSING_QTY"` and
  `source: "fdc" | "llm_estimate" | "none"`. Recipe result gains a `coverage`
  summary. UI surfaces flagged/estimated items and the coverage line.

### Persistence (USDA is cacheable)
- Cache the full 22-nutrient `Profile` per recipe (the Edamam-forbidden asset).
- `IngredientNameCache` (exists). New `RecipeAnalysisCache` (fingerprint → stage-2
  output + cached profile). Migrations follow the shared-DB drift workflow
  (manual `migration.sql` + `db execute --schema` + `migrate resolve --applied`).

## Open implementation decisions (resolve during planning)

1. **Estimated macros in the total** — counted-but-flagged (complete total,
   marked soft) vs. excluded-and-listed. *Lean: counted + flagged.*
2. **Data model** — exact enum/provenance fields + the `RecipeAnalysisCache`
   schema + where the cached profile lives.
3. **Eval determinism** — extend the recorder to capture both LLM stages into
   fixtures; mock in CI; promote the real tier to a green gate once it passes.
4. **Prod Vertex auth** — verify ADC / service-account on the Dokploy VPS
   (the one real ship risk; LLM is now hot-path).
5. **Migration sequencing** — flip `INGREDIENT_LLM_FALLBACK` on, backfill
   `IngredientNameCache`, retire Edamam call sites
   (`analyzeRecipeNutritionAction`, `analyzeAndUpdateRecipe`,
   `/api/nutrition/analyze`) + Edamam entitlement gating, then delete
   `src/lib/edamam*.ts`.

## Implementation status

**Done — Phase A+B (data contract, 2026-06-22):**
- `parseIngredientLine` no longer calls `applySynonyms` — the parser returns the
  raw (state-stripped) name; the LLM owns canonicalization. `SYNONYMS` /
  `applySynonyms` are **retained but parser-detached**, used only by
  shopping-list dedup (`shopping-list.ts`, `ShoppingListPage.tsx`) until that
  path migrates to the cached canonical identity.
- `resolveIngredientMatches` rewritten to **single-pass canonicalize-first**:
  parse → `canonicalizeCached` (all names, up front) → search/rank/staple/guard →
  grams → `getMacroEstimates` on a true miss. The old two-pass retry is gone.
- Stage 1 estimate-on-miss: `IngredientCanonicalizer.estimateMacros` +
  `getMacroEstimates` (flag-gated, **request-scoped** — not yet persisted;
  Phase D adds the cache).
- Honest contract: `IngredientProfileResult` gains `status`
  (`OK | ESTIMATED | UNRECOGNIZED | MISSING_QTY`) + `source`
  (`fdc | llm_estimate | none`); `AnalyzeProfileResult` gains `coverage`.
  Estimated macros are counted-but-flagged (decision 1); a no-match is surfaced,
  never a silent confident zero.
- `resolveGramWeight(parsed, food | null)` weighs food-less ESTIMATED items via
  the density/registry ladder.
- Tests: `analyze-recipe-pipeline.test.ts` (OK/ESTIMATED/UNRECOGNIZED/coverage),
  extended `ingredient-canonicalizer`, `ingredient-name-repo`, `gram-resolution`,
  `parse-ingredient-line`. Full `test:unit` + anchor eval green; `tsc` clean.

**Pending:**
- **B-UI:** surface `status` (estimated/unrecognized badges) + the coverage line.
  Note: the `/nutrition` calculator consumes the 5-macro `AnalyzeResult` path
  (not the honest profile path) — needs the macro path extended OR the calculator
  migrated to `analyzeRecipeProfileAction`; plus next-intl keys (en/es/pl).
- **C (Stage 2):** recipe-fingerprint LLM stage (cooked/raw + retention +
  diet/health labels), raw-default-on-low-confidence.
- **D (persistence):** `RecipeAnalysisCache` + cached estimates + cached Profile
  (shared-DB migration via the drift workflow).
- **E (retire Edamam):** extract `generateRecipeFingerprint` out of `edamam.ts`,
  retire call sites, delete `edamam*.ts`.
- **F:** extend the recorder for both LLM stages; promote the real tier to a CI gate.
- **G (rollout):** verify Vertex auth on the VPS; flip `INGREDIENT_LLM_FALLBACK`;
  backfill `IngredientNameCache`.

## Testing & measurement (definition of done)

- **Unit (CI):** both LLM stages mock the GoogleGenAI client (no live calls).
  Single-pass `resolveIngredientMatches`: canonical name drives staple/search;
  no-match → `llm_estimate` → `ESTIMATED`; total no answer → `UNRECOGNIZED`,
  never silent 0 g. Cooked-weight low-confidence → defaults to raw + flag.
- **Harness (the real bar):** `RUN_REAL_EVAL=1 bun run test:eval:nutrition:real`
  — the Polish Day-1 recipes (`pl-d1-*`) move into the `real` tolerance with the
  honest coverage signal. No regression: anchor tier + full `test:unit` green.
- Promote the real tier into the CI gate once green.

## Risks

- **Vertex auth on the VPS** (hot-path now) — biggest ship risk; mitigated by
  warm cache + honest `UNRECOGNIZED` degradation, but cold-start needs it solid.
- **Hallucinated canonical / macro estimate** — guard rejects wrong foods;
  estimates are flagged `ESTIMATED`/low-confidence and measured by the harness.
- **Cooked-weight misjudgment** — mitigated by raw-default + flag on low
  confidence.
- **Cost** — Stage 1 ~1 call per novel name ever (cached); Stage 2 once per
  unique recipe (fingerprint-cached). Amortizes low.
