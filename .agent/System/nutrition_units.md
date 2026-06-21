# Nutrition Unit Handling (FDC pipeline)

**Last Updated:** 2026-06-19

How DietAI turns a written ingredient line into grams, and from grams into a
nutrition profile via USDA FoodData Central (FDC). This is the source of truth
for anything touching ingredient **units**.

---

## TL;DR

- **One unit vocabulary.** [`src/lib/unit-registry.ts`](../../src/lib/unit-registry.ts)
  is the single source of truth. Everything (parsing, gram resolution, shopping
  list, the recipe-form dropdown) derives from it. Do **not** add a second alias
  table or conversion map anywhere else.
- **Calculation is FDC-only.** Edamam code still exists but is **not** on any
  active calculation path. Do not wire new nutrition features to Edamam.
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
- **Synonyms match on Unicode word boundaries, longest-first** (`applySynonyms`).
  The old `name.includes(synonym)` treated short keys as substrings, so the
  `"sal" → "salt"` synonym silently turned **`salmon` / `salsa` / `salad` into
  `"salt"`** — zeroing a very common protein. Matching is now bounded
  (`(^|[^\p{L}])syn([^\p{L}]|$)`) and tries the longest synonym first, so
  `aceite de oliva` → `olive oil` (not `oil`). Covered by
  [`apply-synonyms.test.ts`](../../tests/unit/apply-synonyms.test.ts).
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

This re-frames the roadmap: Polish name canonicalization (Capa 3 — expand
`SYNONYMS`: komosa ryżowa→quinoa, sezam→sesame, imbir→ginger, mięso z piersi
kurczaka→chicken breast, unit `plastra`→slice) is the biggest remaining lever,
ahead of gram-resolution consolidation (Capa 2).

The same `checkInvariants` is intended to become the runtime sanity gate (Capa 1).

## Rules for future work

1. Need a new unit / spelling? Add it to `UNIT_DEFINITIONS` — nowhere else.
2. Never surface confidence/portion notes in user-facing UI; keep them for logs.
3. Keep nutrition calculation on FDC. Don't reintroduce Edamam on the hot path.
4. Ingredient-specific weights go in `DENSITY_FALLBACK_G_PER_UNIT`, not the registry.
