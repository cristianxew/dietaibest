# CONTEXT — Domain Language

Single-context project. This file is the shared vocabulary; decisions live in
`docs/adr/`. Read this before making architectural suggestions or writing specs.

---

## Bounded context: Nutrition Analysis (USDA FDC pipeline)

Turns written ingredient lines into a nutrition profile, grounded in USDA
FoodData Central (FDC) as the authoritative, cacheable nutrient source, with the
LLM (Gemini on Vertex) as the food-resolution intelligence layer. Decisions:
[ADR 0003](docs/adr/0003-llm-primary-nutrition-canonicalization.md) (LLM-primary
canonicalization, Edamam retired) and
[ADR 0004](docs/adr/0004-llm-assisted-food-resolution.md) (RAG selection +
portion estimation). System doc: [.agent/System/nutrition_units.md](.agent/System/nutrition_units.md).

### Key concepts

- **Stage 1 — Canonicalization.** One batched LLM call that turns each raw,
  multilingual ingredient **name** into a generic, variety-aware English USDA
  term (`łosoś świeży → salmon`). Cached system-wide in `IngredientNameCache`.
  The canonical signal is three-valued in intent: a **name**, **not-a-food**
  (genuine null), or **unresolved** (LLM miss / outage) — see ADR 0003.
- **Stage 2 — RAG resolution.** One recipe-scoped LLM call that, given each
  ingredient's fetched USDA **candidates**, selects the best `chosenFdcId`,
  estimates **portion grams** for count/household units, and judges
  **cooked/raw + retentionFactor**. Cached by recipe **fingerprint**.
- **Gram-resolution ladder.** Deterministic, most-accurate-first strategies that
  turn (qty, unit, food) into grams + an internal-only confidence + note.
- **Coverage chain.** FDC match → LLM macro **estimate** (flagged) → honest gap.
  Never silently zero a no-match.
- **Honest status.** Per-ingredient outcome surfaced to the user:
  `OK` (USDA match) · `ESTIMATED` (LLM macros, flagged) · `UNRECOGNIZED`
  (not a food, or no match + no estimate) · `MISSING_QTY` (reserved). Paired with
  a **source** provenance: `fdc | llm_estimate | none`.
- **Staple pin.** A hand-verified `fdcId` for a common food, pinned ahead of
  search to dodge free-text mis-ranking. Trusted: bypasses the match guard.
- **Staple backstop.** When Stage-2 abstains from selecting a food *by failure*
  (a missing or low-confidence answer, not a confident "none is a reasonable
  match"), the curated **staple pin** is recovered instead of dropping to an LLM
  estimate. Engages only for staple pins — never a plain search match — so it
  cannot reopen the cooked/raw weight-basis ambiguity. A *confident* abstention is
  left sovereign. See [ADR 0004](docs/adr/0004-llm-assisted-food-resolution.md)
  addendum.

### Architecture vocabulary (being introduced — refactor in progress)

- **Resolve / Compute seam.** The boundary between *deciding* what each ingredient
  is and *computing* its nutrition.
  - **Resolve** — parse → canonicalize → search → fetch → Stage 2 → select →
    estimate → grams → status. Decides, per ingredient: which food, how many
    grams, what retention, what honest status. A pure module; its interface is
    the test surface.
  - **Compute** — turns the resolved records into numbers: scale to grams, apply
    retention to micronutrients only, aggregate. The full `Profile` is computed
    once; the 5-macro `Macro` is a projection of it.
- **IngredientResolution.** The per-ingredient **resolution record** that flows
  through the batch stages of Resolve and ends as a discriminated union on
  `status`. One record per ingredient replaces the prior set of index-aligned
  parallel arrays — alignment now happens once, explicitly, at each stage
  boundary.
