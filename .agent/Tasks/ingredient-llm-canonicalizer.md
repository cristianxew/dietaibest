# Ingredient LLM Name Canonicalizer (cached fallback)

**Status:** Design approved — pending implementation
**Date:** 2026-06-21
**Branch:** `feature/nutrition-calc-improvements`
**Related:** [.agent/System/nutrition_units.md](../System/nutrition_units.md) (the FDC pipeline + Capa 0 harness + the match-quality guard)

## Context / problem

The Capa 0 golden-recipe harness measured the FDC pipeline against real Polish
recipes and proved the dominant reliability failure is **ingredient-NAME
canonicalization**, not gram resolution. The static substring `SYNONYMS` table in
`src/lib/ingredients.ts` cannot cover open-ended multilingual vocabulary or
descriptive phrases — e.g. `mięso z piersi kurczaka` (chicken breast),
`komosa ryżowa` (quinoa), `sezam nasiona` (sesame) all fail to translate, so the
ingredient either drops to no-match or (before the guard) matched branded junk.

The recently shipped **match-quality guard** (`matchPlausible` in
`src/lib/fdc-match.ts`) stops the silent wrong-food class, but turns these into
honest *no-matches* — it doesn't make the recipes correct. We need real coverage.

## Goal

Add an **LLM name canonicalizer** that translates/normalizes an untranslatable
ingredient name to a generic English name suitable for USDA FDC matching, **as a
cached fallback behind the deterministic layer and in front of the guard** — so
the LLM solves coverage while the deterministic pipeline + guard still pick and
protect the food. Success is measured by the real-tier harness.

## Non-goals (out of scope)

- The LLM does **not** pick FDC food ids — it only normalizes the name; the
  deterministic search/rank/guard still choose the food.
- The LLM does **not** resolve grams/units — that stays in `gram-resolution.ts`.
- Expanding the static `SYNONYMS` table for the common case (complementary,
  separate work).

## Design decisions (locked)

| Decision | Choice | Why |
| --- | --- | --- |
| Model | **Gemini 2.5 Flash** (via existing Vertex `@google/genai`) | User choice; cheap, native structured output, already wired for recipe import. |
| Timing | **Synchronous fallback + cache** | Latency hits only the first time a novel name appears system-wide; simplest, no background-job machinery. |
| Output | Single canonical English name (nullable) | Simple; deterministic search + guard handle the rest. `null` = not a food. |
| Batching | One LLM call per recipe (only if there are unmatched names) | Cheap; amortized by cache. |
| Rollout | Feature flag `INGREDIENT_LLM_FALLBACK`, default **off** | Bound cost; measure before enabling; mirrors `FEATURE_MULTIMODAL_IMPORT`. |

## Components

### 1. `src/lib/ingredient-canonicalizer.ts` (new, single-purpose)

Reuses `buildGenAIVertexOptions(process.env)` + `GoogleGenAI` (the same Vertex
setup as `llm-gemma.ts`), model `gemini-2.5-flash`, with a `responseSchema`
(Zod → `zodToJsonSchema`).

```ts
// Batched: one generateContent call for all names.
canonicalizeNames(rawNames: string[]): Promise<Map<string, string | null>>
```

- **Prompt:** "For each ingredient name, return a generic English ingredient name
  suitable for the USDA FoodData Central database — singular, no brand, no
  preparation words (e.g. `mięso z piersi kurczaka` → `chicken breast`,
  `oliwa z oliwek` → `olive oil`). Return `null` for anything that is not a food
  ingredient (section headers, noise)."
- **Schema:** `{ items: { raw: string; canonical: string | null }[] }`.
- **Error handling:** on transport/parse/timeout failure, return an empty map
  (every name a miss) — the caller falls back to the deterministic no-match. The
  LLM is best-effort; a failure must never break recipe analysis.

### 2. `IngredientNameCache` (new Prisma model — mirrors `FdcSearchCache`)

```prisma
model IngredientNameCache {
  key           String   @id        // normalized raw name (lowercased, ws-collapsed)
  canonical     String?             // English canonical, or null = not a food
  lastFetchedAt DateTime @default(now())

  @@index([lastFetchedAt])
}
```

Key normalization reuses the same scheme as `normalizeSearchQuery`
(lowercase, whitespace-collapse). Mappings are stable → no active TTL; refresh
only if we ever need to (the `lastFetchedAt` index supports manual cleanup).

> Migration follows the shared-DB drift workflow: manual `migration.sql` +
> `prisma db execute --schema` + `migrate resolve --applied` (NOT `migrate dev`,
> which wants to reset the remote dev DB).

### 3. `src/lib/ingredient-name-repo.ts` (new sibling — keeps `fdcRepo` FDC-only)

```ts
canonicalizeCached(rawNames: string[]): Promise<Map<string, string | null>>
```

Reads `IngredientNameCache` for all keys; for misses, calls
`canonicalizeNames`; upserts results (including `null`s, so a confirmed
non-food is not re-queried); returns the merged map. Gated by
`INGREDIENT_LLM_FALLBACK` — when off, returns an all-empty map (no LLM, no cache
write).

### 4. Hook in `resolveIngredientMatches` (`src/actions/analyzeRecipe.ts`)

Two-pass, LLM strictly as fallback:

1. **Pass 1** — current deterministic resolution for every ingredient
   (parse → synonyms → staple → search → rank → guard).
2. Collect ingredients that ended **no-match / guard-rejected** (food null).
3. If any **and the flag is on** → one `canonicalizeCached(names)` call.
4. **Pass 2** — for each such ingredient with a non-null canonical name, re-run
   the existing match path using the **canonical** name (staple lookup,
   `searchFoodsCached`, `rankMatches`, `matchPlausible`, `resolveGramWeight`).
   Keep the result only if it now produces a plausible match.
5. Ingredients still unmatched stay honest no-matches.

The guard runs unchanged in pass 2 — a hallucinated canonical that still doesn't
match real USDA data resolves to a flagged no-match, never silent junk.

## Data flow

```
parse → applySynonyms → staple? → search → rank → guard ─ plausible? ─ yes → resolve grams
                                                            │ no
                                          collect unmatched ▼ (flag on)
                          canonicalizeCached(names)  →  cache hit? → use; miss → Gemini (batched) → upsert
                                          │
                          re-run search → rank → guard with canonical name → resolve grams / honest no-match
```

## Testing & measurement (definition of done)

- **Unit (in CI):** `canonicalizeNames` (mock the GoogleGenAI client, like
  `llm-gemma` tests) — batch shape, null handling, transport-failure → empty map.
  `canonicalizeCached` — cache hit/miss/upsert, flag-off short-circuit.
  `resolveIngredientMatches` two-pass — a name that fails pass 1 but a stubbed
  canonical makes pass 2 match; flag-off path unchanged.
- **Harness (the real bar):** with the flag on, run `bun run test:eval:nutrition:real`
  (`RUN_REAL_EVAL=1`) — the Polish Day-1 recipes (`pl-d1-*`) should move into the
  `real` tolerance. **No regression:** anchor tier + full `test:unit` (731) stay
  green with the flag both off and on.
- Promote the real tier into the CI gate only once it passes green.
- The canonicalizer unit tests must mock the LLM — no live calls in CI.

## Risks

- **Vertex auth on the VPS:** `llm-gemma.ts` warns that ADC fails on the
  self-hosted VPS; this depends on the same `GOOGLE_CLOUD_SERVICE_ACCOUNT_*`
  config that image-gen/import already use in prod. Deploy dependency, not new.
- **Latency on cold names:** one Gemini call on a recipe with never-seen names;
  bounded by cache + fallback-only. Acceptable; flag-gated.
- **Hallucinated canonical:** mitigated by the downstream guard (no silent wrong
  food) and measured by the harness.
- **Cost:** ~1 call per novel name ever (cache) on recipes that have unmatched
  names; flag-gated.

## Open questions

None blocking. (Locale is not part of the cache key — the raw name is already
language-specific; revisit only if collisions appear.)
