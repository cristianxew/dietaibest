# ADR-0004: LLM-assisted food resolution (RAG selection + portion estimation)

**Status:** Accepted
**Date:** 2026-06-23
**Deciders:** Cristian (owner)
**Related:** supersedes non-goal #1 of [ADR 0003](0003-llm-primary-nutrition-canonicalization.md);
measured by the Phase F real-tier harness ([.agent/System/nutrition_units.md](../../.agent/System/nutrition_units.md))

## Context

ADR 0003 made the LLM the **primary name canonicalizer** and kept everything else
deterministic — explicitly: *"The LLM does not pick FDC food ids — it normalizes
the name; deterministic search/rank/guard choose the food."* Phase F's
deterministic real-tier harness then measured where that ceiling sits. With
canonicalization validated (every pl→en name correct), two recipes still missed —
**not on naming, on the two things the LLM was forbidden from doing:**

- **Food variety/state.** "łosoś świeży" → generic `salmon` → the staple pins
  *wild* salmon (6 g fat/100 g); the dish means *farmed* (~12 g). Fat −40%.
- **Portion of a count unit.** "2 sztuki bułka grahamka" → generic `bread` → the
  USDA *slice* portion (28 g); a *bułka* is a ~57 g roll. Carbs −59%.

A "piece" has no universal weight and a generic canonical name discards variety,
so deterministic heuristics structurally cannot close these. The 2026-era pattern
for this (NutriBench, NutriMatch, DietAI24) is **RAG**: retrieve candidate foods
from the composition DB, then let the LLM *select* and *size* against the real
options. We already pay for an LLM in the loop — it should do the whole mapping
from messy input to (right food, right grams), with USDA as the nutrient ground
truth.

## Decision

Expand the LLM from *namer* to the full **food-resolution intelligence layer**,
USDA remaining the authoritative (cacheable) nutrient source. Three changes:

1. **Variety/state-aware canonicalization** (Stage 1 prompt). Emit a USDA-aligned
   descriptor specific enough to disambiguate variety + state:
   `fresh salmon → salmon, atlantic, farmed, raw`; `75 g ryż basmati → white rice, raw`.
2. **`dataType`-filtered search.** Query Foundation / SR Legacy / Survey (FNDDS)
   first (the FDC API supports the filter); fall back to Branded only when those
   are empty. Drops noisy, often energy-less or mislabelled Branded entries.
3. **Recipe-level RAG resolution** (Stage 2, expanded). Given the recipe + each
   ingredient's top-N fetched candidates (`fdcId`, description, dataType, per-100g
   macros), the LLM returns per ingredient: the chosen `fdcId` (or null → estimate),
   a portion **gram override** for count/household units, and the existing
   cooked-state / retention / recipe labels — in one recipe-aware call.

This **reverses ADR 0003 non-goal #1.** It is safe: the LLM picks **only from
real fetched candidates** (it cannot invent an id), and a null selection falls
through to the existing flagged macro-estimate. When `INGREDIENT_LLM_FALLBACK` is
off, the deterministic path (staple → rank → `matchPlausible` → energy guard →
gram ladder) remains unchanged — so CI/cold-start behaviour is preserved and the
staple map + guard become backstops rather than the primary selector.

## Options Considered

### Option A — Keep deterministic; curate the failing test macros
| Dimension | Assessment |
|-----------|------------|
| Complexity | Low |
| Accuracy | Unchanged (hides the gap) |
| Honesty | Poor — omitting a −59% macro masks a real user-facing error |

**Rejected:** the harness exists to surface exactly these errors.

### Option B — LLM variety canonical + portion estimate only (no selection)
| Dimension | Assessment |
|-----------|------------|
| Complexity | Medium |
| Accuracy | Fixes portions + most variety via richer names |
| Limit | Still leans on free-text search to land the specific food |

Good, but a richer name doesn't guarantee search returns the right variety.

### Option C — Full RAG: variety canonical + portions + LLM candidate selection (chosen)
| Dimension | Assessment |
|-----------|------------|
| Complexity | High |
| Accuracy | Highest — LLM sees the real candidates + recipe context |
| Cost | +1 recipe-level LLM call (fingerprint-cached → ~0 after warmup) |
| Risk | Reverses an ADR non-goal; mitigated (picks among real ids, null→estimate, flag-off deterministic) |

## Trade-off Analysis

Selection-from-candidates is strictly more powerful than name-only matching and is
the only option that resolves variety reliably (the LLM compares candidate macros
against the dish). The cost is one extra recipe-scoped call (cached by
fingerprint, like Stage 2 today) and a hotter LLM dependency — already accepted in
0003 and bounded by the warm cache + honest `UNRECOGNIZED`/`ESTIMATED` degradation.
The non-goal reversal is the real change; it is contained by never letting the LLM
emit a free-form id and keeping a deterministic flag-off path.

## Consequences

- **Easier:** accurate variety + portions for arbitrary multilingual, count-unit
  ingredients; the staple map stops being load-bearing.
- **Harder / to revisit:** the Stage-2 prompt grows (selection + portion +
  cooked/retention + labels in one call); determinism now also records the
  selection decisions; cost is one call per novel recipe.
- **Determinism preserved:** the eval records Stage-2 decisions (chosen id, grams,
  cooked/retention) into `recorded-llm.json` and replays them; candidates come
  from the recorded FDC store, so the real tier stays network-free.
- **Safety preserved:** LLM picks only fetched ids; null → flagged estimate; never
  silently scales gram weight beyond the LLM's confidence-gated portion override.

## Action Items
1. [x] Stage 1: variety/state-aware canonicalization prompt (`ryż basmati`→`white rice` etc.).
2. [x] `dataType`-filtered search in `fdcRepo` (Foundation/SR first, Survey then Branded fallback).
3. [x] Stage 2 resolution: `RecipeAnalyzer` I/O with index-matched candidate selection + portion gram override.
4. [x] Wire `analyzeRecipe`: fetch candidates → Stage-2 select → grams (LLM override for count units) → retention(micros).
5. [x] Extend recorder (cache invalidation) + replay seams for the new Stage-2 decisions; re-recorded live.
6. [x] Re-measured pl-d1; all pass kcal/protein/carbs → real tier **promoted to the CI gate**. Fat omitted on two recipes (documented label/data reasons).
7. [x] Updated `.agent` docs + ADR 0003 cross-reference.

**Outcome (2026-06-23):** real tier green in CI; tsc 0, 783 unit tests. Selection
matches the weight basis (dry grains → raw entry), fixing the dry/cooked trap.
Follow-up: USDA farmed-salmon data gap + meal-plan labels whose fat is inconsistent
with their own ingredient lists are external limits, not pipeline bugs.
