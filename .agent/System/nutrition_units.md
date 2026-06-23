# Nutrition Unit Handling (FDC pipeline)

**Last Updated:** 2026-06-22

How DietAI turns a written ingredient line into grams, and from grams into a
nutrition profile via USDA FoodData Central (FDC). This is the source of truth
for anything touching ingredient **units**.

---

## TL;DR

- **One unit vocabulary.** [`src/lib/unit-registry.ts`](../../src/lib/unit-registry.ts)
  is the single source of truth. Everything (parsing, gram resolution, shopping
  list, the recipe-form dropdown) derives from it. Do **not** add a second alias
  table or conversion map anywhere else.
- **Calculation is FDC-only.** Edamam has been **removed** (ADR 0003 E) — the
  client, service, caches, and the metered `edamamAnalysesPerMonth` entitlement
  are all gone. Nutrition analysis is free + ungated. Do not reintroduce Edamam.
- **Confidence is internal-only.** The pipeline computes a per-ingredient
  confidence + note for our debugging/logs. It is **never shown to the user**.

---

## The Unit Registry — `src/lib/unit-registry.ts`

A single `UNIT_DEFINITIONS` table. Each entry:

| field | meaning |
| ----- | ------- |
| `canonical` | the key the whole system uses (e.g. `tbsp`) |
| `kind` | `weight` \| `volume` \| `count` |
| `toBase` | grams (weight), millilitres (volume), or `null` (count) |
| `aliases` | every en/es/pl spelling that normalizes here (`cucharada`, `łyżka`, `tbs`…) |
| `selectable` | whether the recipe-form dropdown offers it |

Public API:

- `normalizeUnit(raw)` → canonical form (handles case, trailing period, spacing, multi-word like `fl oz`). Unknown units pass through cleaned.
- `getUnitKind(raw)` → `weight` \| `volume` \| `count` \| `other`.
- `getUnitDefinition(raw)` → full definition or `null`.
- `toBaseAmount(amount, raw)` → `{ amount, base: "g" | "ml" }` or `null` for count/unknown.
- `SELECTABLE_UNITS` → ordered canonical list rendered by the dropdown.

What the registry deliberately does **not** know: ingredient-specific density
(e.g. "1 cup flour = 120 g"). That lives in `DENSITY_FALLBACK_G_PER_UNIT` in
[`src/lib/ingredients.ts`](../../src/lib/ingredients.ts) — a separate concern.

> History: before the registry there were **three** divergent vocabularies
> (`ingredients.ts`, `gram-resolution.ts`, `shopping-item-transformer.ts`) that
> disagreed on `stick`, `bar`, `fl oz`, and every es/pl spelling. All three now
> derive from the registry.

## Parsing — `parseIngredientLine` (`src/lib/ingredients.ts`)

Turns a free-text line into `{ qty, unit, name }`. Notable behaviors:

- **Attached quantity+unit** is split when the letters form a known unit:
  `"200ml milk"` → `200 ml milk`, `"1tbsp oil"` → `1 tbsp oil`. Guarded by the
  registry so `"7up"` / `"100% juice"` are left alone.
- **Multi-word units** are recognized in pattern 1: `"1 fl oz vanilla"` →
  unit `fl oz`, name `vanilla`.
- **Only a KNOWN unit fills the unit slot.** The word after the quantity is
  taken as the unit only if the registry recognizes it; otherwise the line is
  `"<qty> <name…>"`. Without this, `"1 chicken breast"` parsed as unit
  `chicken` / name `breast` and the gram ladder fell to "assume 1 = 1 g" — a
  whole chicken breast scored as **1 g**. Same class: `"1 bell pepper"`,
  `"1 sweet potato"`, `"3 large eggs"` (size word in the unit slot).
- **Units may carry diacritics.** The unit slot matches `\p{L}+` (any Unicode
  letter), not `[a-zA-Z]`, so Polish units parse: `łyżka` (tbsp), `łyżeczka`
  (tsp), `ząbki` (cloves). With `[a-zA-Z]` they silently collapsed to `piece`.
- Names are not singularized; the density table and staple map handle plurals
  via a singular fallback (`chickpeas` → `chickpea`, `cherries` → `cherry`).
- **The parser no longer translates names** (ADR 0003). It returns the raw,
  state-stripped name; the **LLM canonicalizer is the single normalizer** (see
  "LLM-primary canonicalization" below). The `SYNONYMS` map / `applySynonyms`
  still exist but are **detached from the parser** — used only by shopping-list
  dedup (`shopping-list.ts`, `ShoppingListPage.tsx`) until that path migrates to
  the cached canonical identity. They are still word-boundary + longest-first
  matched (covered by
  [`apply-synonyms.test.ts`](../../tests/unit/apply-synonyms.test.ts)); the
  retired in-parser use is why `cebolla` / `sos sojowy` now parse raw.
- **State-word strip caveat:** `ground` is a state word, so `ground turkey`/
  `ground beef` normalize to `turkey`/`beef` and resolve to the base cut — there
  is no reachable dedicated ground-meat staple key.

## Gram resolution ladder — `src/lib/gram-resolution.ts`

`resolveGramWeight(parsed, food)` tries strategies most-accurate first and
returns `{ grams, confidence, note }`. Confidence/note are for **internal**
diagnostics only.

| # | strategy | confidence |
| - | -------- | ---------- |
| 1 | Direct grams (`g`/`gram`) | 1.0 |
| 2 | USDA structured food portion | 0.9 |
| 3 | Branded per-serving weight (piece/serving/package) | 0.85 |
| 4 | Density fallback table — exact / whole-word | 0.7 / 0.6 |
| 5 | **Count-unit default weight** (`can`≈400g, `bunch`≈150g…) | 0.4 |
| 6 | Generic registry conversion (weight→g; volume→ml as water) | 0.5 |
| 7 | Last resort: assume the quantity is grams | 0.3 |

Step 5 (`COUNT_UNIT_DEFAULT_GRAMS`) exists so unresolved count units
(`1 can chickpeas`) get a sensible weight instead of the old "1 unit = 1 g"
that silently zeroed canned/packaged ingredients.

## Orchestration — `src/actions/analyzeRecipe.ts`

`analyzeRecipeProfileAction` (full 22-nutrient profile) and `analyzeRecipeAction`
(5 macros) run: parse → FDC search (cached) → **rank candidates** → fetch foods
(cached) → pick first candidate that resolves → `resolveGramWeight` → scale
per-100g → aggregate → divide by servings. Backs recipe persistence, the
`/nutrition` calculator, and the chat `getNutrition` tool.

**Match selection** runs three layers, best-first:
1. **Curated staple map** ([`src/lib/fdc-staples.ts`](../../src/lib/fdc-staples.ts)):
   ~150 common foods, each a hand-picked, API-verified canonical fdcId
   (`egg` → 171287 whole egg, `onion` → 170000, `milk` → 171265 whole milk,
   `chili flakes` → 170932 cayenne spice…), pinned as the first candidate.
   Free-text search mis-ranks staples badly ("onion" → "onion rings", "banana" →
   "banana pepper", "milk" → a yogurt, "chilli flakes" → "Cereal, wheat flakes"),
   so for staples we don't trust search. Keys are normalized parser names;
   `stapleFdcId` strips plurals (`-s`, `-es`, `-ies`→`y`). Deliberately excluded:
   cup-measured grains with a dry/cooked ambiguity (rice, pasta, oats, quinoa,
   couscous), and bare `red pepper` (collides with red bell pepper — only the
   unambiguous *flake* forms map to cayenne).
2. **Ranking** ([`src/lib/fdc-match.ts`](../../src/lib/fdc-match.ts)):
   `rankMatches` orders search hits by USDA data-type priority
   (Foundation > Survey > SR Legacy > Branded), then a name-relevance score that
   penalizes narrowing qualifiers the query didn't ask for (`white`, `yolk`,
   `benedict`, `casserole`…).
3. **Fetch fallback**: keep the top 5 candidates and use the first whose detail
   fetch succeeds — USDA's `/foods` endpoint answers `{}` for some ids that
   search returns (e.g. 747997), so the top hit can be unfetchable; falling
   through keeps the ingredient from dropping to 0 g.

To add/verify staple ids, query the live FDC API (`/foods/search` then `/foods`
to confirm the id resolves and carries energy). The official API is
`https://api.nal.usda.gov/fdc/v1` (guide: <https://fdc.nal.usda.gov/api-guide>).

**Energy extraction gotcha:** Foundation foods report Energy under the Atwater
numbers **#957 (General)** / **#958 (Specific)**, usually omitting **#208**.
`extractMacrosFromFood` / `extractProfileFromFood` resolve calories as
`208 → 957 → 958` (all kcal). Reading only 208 silently zeroed calories on
Foundation matches — the biggest source of wrong recipe nutrition.

> Stale data: stored `Recipe.calories` etc. are written at persist time. Fixes
> to extraction/matching only affect **new** analyses; existing recipes keep
> their old values until re-analyzed.

## LLM-primary canonicalization & honest output (ADR 0003)

`analyzeRecipeProfileAction` is **LLM-primary, single-pass**. Before matching, it
canonicalizes **every** ingredient name once via
[`canonicalizeCached`](../../src/lib/ingredient-name-repo.ts) (Gemini 2.5 Flash
on Vertex, [`ingredient-canonicalizer.ts`](../../src/lib/ingredient-canonicalizer.ts)),
then runs the deterministic staple/search/rank/guard layers on the canonical
name. This replaced the old two-pass retry + the in-parser `SYNONYMS` table,
which over-collapsed multi-word names (`pasta miso` → `pasta`) into
generic-but-wrong matches that passed the guard and pre-empted the LLM.

- **Flag-gated, cached.** Gated by `INGREDIENT_LLM_FALLBACK`. Off → empty map, no
  LLM/DB call, the pipeline matches on raw names and a miss degrades to an honest
  `UNRECOGNIZED` (the anchor eval relies on this early-return to stay network-free
  in CI). On → one batched call per novel name ever; cached in
  `IngredientNameCache` system-wide, so it amortizes to ~0 after warmup.
- **Coverage chain:** USDA FDC → LLM **macro estimate** (`getMacroEstimates` /
  `estimateMacros`, per-100g, **cached in `IngredientEstimateCache`** by canonical
  name) → honest gap. The estimate is weighed by `resolveGramWeight(parsed, null)`
  (food-less density/registry ladder).
- **Honest per-ingredient contract** on `IngredientProfileResult`:
  - `status`: `OK` (USDA match) · `ESTIMATED` (LLM macros, counted but flagged,
    micros 0) · `UNRECOGNIZED` (not a food, or no match + no estimate — surfaced,
    **never a silent confident zero**) · `MISSING_QTY` (reserved).
  - `source`: `fdc | llm_estimate | none`.
  - `AnalyzeProfileResult.coverage` = `{ total, resolved, estimated, unrecognized }`
    — the "12/13 resolved" signal.
- **Status/source ARE user-facing** (the whole point: honest output); the
  `confidence`/`portionNote` fields remain internal-only.
- Tests: [`analyze-recipe-pipeline.test.ts`](../../tests/unit/analyze-recipe-pipeline.test.ts)
  mocks the seams (`fdcRepo`, `ingredient-name-repo`, `recipe-analysis-repo`) and
  asserts each status transition + coverage + Stage 2.

### Stage 2 — recipe LLM + analysis cache (ADR 0003 C + D)

After matching, a second, recipe-scoped LLM stage runs once per recipe:
[`RecipeAnalyzer`](../../src/lib/recipe-analyzer.ts) (Gemini on Vertex) returns,
per ingredient, a cooked/raw judgment + a nutrient-`retentionFactor`, plus
recipe-level `dietLabels`/`healthLabels`. It is reached through the flag-gated
wrapper [`recipe-analysis-repo.ts`](../../src/lib/recipe-analysis-repo.ts)
(`runRecipeStage2`), which — like the Stage-1 wrappers — **early-returns before any
LLM/Prisma call when `INGREDIENT_LLM_FALLBACK` is off** (this is what keeps the
anchor eval network-free).

- **Cooked-weight safety:** `retentionFactor` (clamped to [0,1]) scales the
  per-ingredient nutrition of **OK/USDA items only**, applied via *effective grams*
  (`grams × retentionFactor`) so the **reported grams stay raw-as-entered** — we
  never silently scale the weight. Confidence < 0.6 → forced raw + retention 1.0 +
  `cookedFlagged`. LLM-estimated items are already "as prepared", so retention is
  not double-applied to them. (Raw↔cooked gram conversion is intentionally
  deferred — see the task doc's deferral decision.)
- **Analysis cache (`RecipeAnalysisCache`):** keyed by
  [`generateRecipeFingerprint`](../../src/lib/recipe-fingerprint.ts) (title +
  ingredient lines). USDA is public domain, so — unlike Edamam — the full
  22-nutrient profile is persisted. A hit in `analyzeRecipeProfileAction`
  short-circuits the whole pipeline (no USDA fetch, no LLM stages); `perServing`
  is recomputed from the servings-independent cached `total`, so servings is not
  part of the key. Only successful analyses are cached; writes are best-effort.

## UI

- **Recipe create/edit** (`RecipeFormIngredients.tsx`, used by both the page form
  and the modal via `Step1Ingredients`): the unit field is
  [`UnitCombobox`](../../src/components/recipes/UnitCombobox.tsx) — a datalist
  seeded with `SELECTABLE_UNITS`. Predefined values to prevent typos, free text
  still allowed (normalized server-side).
- **`/nutrition` calculator** (`NutritionResults.tsx`): shows macros + a
  per-ingredient table. **No confidence score** is displayed; only a plain
  "some ingredients could not be matched" notice when a match truly fails.

## Reliability harness (Capa 0) — `tests/eval/nutrition/`

The permanent **golden-recipe regression net** for the whole pipeline. It runs
the real analysis (`analyzeRecipeProfileAction`) against a committed FDC fixture
store — no network, deterministic — and asserts per-serving macros within
tolerance plus structural invariants. **Runs in CI on every PR** (job
`Nutrition Eval`, `bun run test:eval:nutrition`). This is the missing feedback
loop that previously let nutrition bugs whack-a-mole.

| piece | file | role |
| ----- | ---- | ---- |
| assertions | `lib/assert-macros.ts` | `compareMacros` (per-macro tier tolerance) + `checkInvariants` (NaN/negative, perServing×servings=total, kcal density ≤ 9.5/g, matched-but-0g). Pure, unit-tested. |
| replay seam | `lib/replay.ts` | fixture-backed `searchFoodsCached`/`getFoodsCached` lookups (the only USDA seam in `resolveIngredientMatches`). |
| golden set | `fixtures/recipes.ts` | `GoldenRecipe[]` — each has `tier`, ingredient lines, servings, trusted per-serving macros. |
| anchor store | `fixtures/anchor-foods.ts` | hand-built USDA payloads; anchor recipes' expected macros are computed by hand from these (closed-form check). |
| recorded store | `fixtures/fdc/recorded-store.json` | real USDA payloads (slimmed to the profile nutrients) for real-tier recipes, captured by the recorder. |
| anchor runner | `golden-recipes.test.ts` | anchor tier; mocks `@/lib/fdcRepo`, serves `anchor-foods`, asserts. **In CI.** |
| real runner | `golden-recipes-real.test.ts` | real tier over the recorded store. **Opt-in** (`bun run test:eval:nutrition:real`, `RUN_REAL_EVAL=1`) — a measurement baseline, not yet a CI gate (see findings). |
| recorder | `record-fixtures.test.ts` | **opt-in, live** (`bun run eval:nutrition:record`, needs `FDC_API_KEY`). Skipped in CI. Captures + slims + minifies the recorded store. |

**Two tiers** (tolerances in `assert-macros.ts` `TOLERANCES`):
- `anchor` — truth = hand-verified FDC computation; tight (`kcal ±10%`). In CI.
- `real` — truth = published label; loose + invariant floors (`kcal ±25%`). Opt-in.

**Adding a recipe:** append to `goldenRecipes`. Anchor → add its foods to
`anchor-foods.ts` and compute expected by hand. Real → run the recorder to
capture live payloads, then read the trusted macros off the source label.

### Current real-tier measurement (Polish meal plan, 2026-06-19)

The first real recipes (Polish, `pl-d1-*`) are far out of tolerance. The harness
pinpointed the dominant cause: **ingredient-NAME canonicalization (pl→en), not
gram resolution.** Concretely:
- `mięso z piersi kurczaka` (chicken breast — the main protein) matched a branded
  **"Clif Z bar"** at confidence 1.0 → protein −74%. An untranslated name falls
  through to free-text search, which ranks branded junk first; the staple map
  only covers English keys.
- `komosa ryżowa`→quinoa, `sezam nasiona`→sesame, `imbir`→ginger were missed
  (0 hits or matched **cinnamon**); `sos sojowy`→generic "sauce",
  `pasta miso`→noodles. Unit `plastra` (slice) is unparsed.
- **Key insight: `confidence` measures gram-resolution certainty, NOT match
  correctness.** A perfectly-confident ingredient can be the wrong food, and the
  kcal-density invariant won't catch a plausible-looking wrong match (a candy bar
  has a normal kcal/g).

**Fix shipped — match-quality guard (`matchPlausible` in `fdc-match.ts`).** The
analyzer now rejects a NON-staple candidate that shares no content token (≥3
chars, substring-tolerant) with the query name, walking to the next plausible
candidate or resolving to a flagged no-match. Staples bypass it (trusted).
Effect on the measurement: `mięso z piersi kurczaka` no longer matches "Clif Z
bar" (confidence 1.0) — it resolves to a flagged no-match (0g). The recipe now
fails *honestly* (protein visibly missing) instead of lying with a plausible
total. It does NOT make the recipes pass — that needs the synonyms below. The
guard's limit: an incidental substring overlap still slips (`imbir mielony` →
"CINNAMON MIELONY"), which the synonym fix resolves.

> **Superseded (ADR 0003):** the original roadmap here called for *expanding*
> `SYNONYMS` (komosa ryżowa→quinoa, etc.). That approach was rejected — a
> hand-maintained multilingual table is open-ended and over-collapses multi-word
> names. The fix shipped instead is **LLM-primary canonicalization** (see the
> section above): the parser stopped translating and the Gemini canonicalizer
> normalizes pl→en up front. To make the `pl-d1-*` real-tier recipes pass
> deterministically the recorder must capture the LLM stages into fixtures
> (Phase F); only then is the real tier promoted to a CI gate.

The same `checkInvariants` is intended to become the runtime sanity gate (Capa 1).

## Rules for future work

1. Need a new unit / spelling? Add it to `UNIT_DEFINITIONS` — nowhere else.
2. Never surface confidence/portion notes in user-facing UI; keep them for logs.
3. Keep nutrition calculation on FDC. Don't reintroduce Edamam on the hot path.
4. Ingredient-specific weights go in `DENSITY_FALLBACK_G_PER_UNIT`, not the registry.
