# LLM-primary ingredient canonicalization; own the nutrition engine on USDA FDC

**Status:** accepted — **Phase A+B implemented** (LLM-primary single-pass +
honest data contract, behind `INGREDIENT_LLM_FALLBACK`); Stage 2, persistence,
Edamam retirement, UI surfacing, and the rollout flag-flip remain. Open items
tracked in
[.agent/Tasks/ingredient-llm-canonicalizer.md](../../.agent/Tasks/ingredient-llm-canonicalizer.md)

The recipe nutrition pipeline reached a reliability ceiling that name-fallback
patches could not break through. Three findings forced an architectural rethink:

1. **The `SYNONYMS` table (348 lines) is the wrong tool.** It hand-maintains
   multilingual translation (English variants + Spanish + Polish), which is
   open-ended — every gap is a silently-wrong number. Worse, it *over-collapses*
   multi-word names (`"pasta miso"` → `"pasta"`, `"sos sojowy"` → `"sauce"`),
   which then match a generic USDA food, pass the `matchPlausible` guard, and
   **pre-empt** the LLM fallback (which only fires on `food === null`). The
   measured losos-miso carbs gap (−60%) is caused by this pre-emption, not by a
   missing table entry.
2. **The output silently absorbs per-ingredient failure.** A no-match drops to
   0 g and is folded into a confident-looking total. The per-ingredient
   `confidence` / `fdcId: null` signal already exists in `IngredientProfileResult`
   but is discarded.
3. **Edamam cannot be the answer.** Its licence forbids persisting
   (caching) micronutrient values — the core capability the product needs. USDA
   FoodData Central is public domain and freely cacheable. The migration off
   Edamam (already begun for the recipe-form path) is the strategic driver.

This ADR supersedes the prior "LLM as cached *fallback*, default off" design.

## Decisions

1. **LLM canonicalization is the PRIMARY normalizer, single-pass.** Every
   ingredient name is canonicalized to a generic English USDA term up front
   (`parse → canonicalize → staple-pin? → search → rank → guard → grams`). The
   two-pass retry, the `rawName` field, and `applySynonyms` are removed. The
   in-flight `rawName` fix on this branch is reverted as superseded.

2. **Retire the `SYNONYMS` map; one cached canonical identity.** Normalization
   lives once in `IngredientNameCache` (keyed by normalized raw name,
   system-wide, language-specific). Both nutrition **and** shopping-list dedup
   (`shopping-list.ts`, `ShoppingListPage.tsx`) read the same canonical identity
   — a single source of truth. `STAPLE_FDC_IDS` (hand-*verified* fdcId pins,
   keyed on English canonical names) is **kept** — it composes with LLM output
   and is the reliable common-case layer. The `matchPlausible` guard is kept.

3. **Retire Edamam; own the engine on USDA FDC.** Replicate Edamam's API
   *contract* (already typed in `src/lib/edamam.ts`) — not its data. USDA FDC is
   public domain, so the full 22-nutrient profile can be cached, which Edamam's
   licence forbids. This unblocks persistent micronutrient totals.

4. **Honest per-ingredient output contract.** Adopt Edamam's per-ingredient
   status (`OK | ESTIMATED | UNRECOGNIZED | MISSING_QTY`) plus a `source`
   provenance (`fdc | llm_estimate | none`) and a recipe-level coverage signal
   ("12/13 resolved"). **Never silently zero a no-match** — surface it. This is
   how Edamam's *reliability* is matched without Edamam's *data*.

5. **Coverage chain: FDC → LLM-estimated macros (flagged) → honest gap.** When
   no USDA food matches, the LLM estimates per-100g macros as a last resort,
   marked `ESTIMATED` / low-confidence. No Edamam in the chain.

6. **Two LLM stages, split by cache scope.**
   - **Stage 1 — food (name-scoped, `IngredientNameCache`, system-wide):**
     canonicalize + macro-estimate-on-miss. Batched once per recipe for uncached
     names; amortizes to ~0 calls after warmup.
   - **Stage 2 — recipe (scoped by `generateRecipeFingerprint`):** cooked/raw
     weight + retention factor per ingredient + diet/health labels. One call per
     unique recipe.
   - **Cooked-weight safety:** the guard does not protect gram weight, and a
     wrong cooked/raw call can 2–3× the grams. When the LLM is not confident,
     **default to raw-as-entered and flag it.**

## Consequences

- **Vertex/Gemini becomes a hot-path dependency.** Production Vertex auth on the
  self-hosted Dokploy/Hostinger VPS (already flagged as shaky for ADC) is the one
  real ship risk. Runtime failure mode is acceptable: cached names resolve;
  uncached names during an outage surface as `UNRECOGNIZED` (honest), never
  garbage. Cold-start prod requires solid auth.
- **Persistent micronutrient caching becomes legal/possible** — the strategic
  goal. New Prisma surface: cache the 22-nutrient `Profile`, and add a
  `RecipeAnalysisCache` keyed on the recipe fingerprint for Stage 2 output.
- **Shopping-list dedup improves** (LLM-quality merging, warm cache) but gains a
  dependency on `IngredientNameCache`.
- **Edamam call sites are retired:** `analyzeRecipeNutritionAction`,
  `analyzeAndUpdateRecipe`, `/api/nutrition/analyze`, and the Edamam entitlement
  gating. `src/lib/edamam*.ts` is removed once no caller remains.
- **Determinism** is preserved by the existing pattern: unit tests mock the
  canonicalizer; the eval recorder captures both LLM stages into fixtures; the
  real-tier harness is promoted to a CI gate once it passes green.
- **`.agent/Tasks/ingredient-llm-canonicalizer.md` is rewritten** to this design
  (it previously described the LLM as a default-off fallback).
