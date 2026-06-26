# Handoff — Nutrition pipeline bugs

Focus for the next session: **the two bugs still open** (#2, #3) from the FDC nutrition
architecture review. Bug #1 is already fixed. Branch: `feature/nutrition-calc-improvements`.

## Context (don't re-derive)
- Full session record + design rationale: engram `topic_key: architecture/nutrition-resolve-compute-seam` (two observations — PR1, and PR2–4). Search engram before starting.
- Domain language: [CONTEXT.md](CONTEXT.md) → "Resolve / Compute seam", "IngredientResolution".
- Pipeline doc: [.agent/System/nutrition_units.md](.agent/System/nutrition_units.md) (Orchestration + UI sections updated this session).
- Decisions: [docs/adr/0003-llm-primary-nutrition-canonicalization.md](docs/adr/0003-llm-primary-nutrition-canonicalization.md), [docs/adr/0004-llm-assisted-food-resolution.md](docs/adr/0004-llm-assisted-food-resolution.md).
- Pipeline now: `analyzeRecipe.ts` (thin action) → [resolve-ingredients.ts](src/lib/nutrition/resolve-ingredients.ts) (decide) → [compute.ts](src/lib/nutrition/compute.ts) (numbers). Seams mocked in tests at module level.

## Already FIXED this session (reference only, do not redo)
- **Bug #1 — canonicalization null-collapse.** A transient Vertex failure / cache miss used to be returned as `null`, which the resolver read as "not a food" → ingredient zeroed as UNRECOGNIZED. Fixed in [src/lib/ingredient-name-repo.ts](src/lib/ingredient-name-repo.ts) `canonicalizeCached` (final loop now omits unresolved names; three-state: string / `null`=not-food / absent=unresolved→match raw name). Tests: [tests/unit/ingredient-name-repo.test.ts](tests/unit/ingredient-name-repo.test.ts).

## OPEN bug #2 — chat `getNutrition` drops the recipe title (clear fix)
- **Where:** [src/lib/chat/tools/getNutrition.ts:155](src/lib/chat/tools/getNutrition.ts) — calls `analyzeRecipeProfileAction({ ingredients, servings })`, no `title`.
- **Impact:** (a) the fingerprint is built from `title ?? ""` ([analyzeRecipe.ts](src/actions/analyzeRecipe.ts), `generateRecipeFingerprint`), so the SAME recipe analyzed via chat vs. the recipe form gets two different cache keys → no cache reuse; (b) Stage-2's prompt gets `"(untitled)"`, weakening variety + cooked/raw judgment that `title` was designed to feed ([recipe-analyzer.ts](src/lib/recipe-analyzer.ts) SYSTEM_INSTRUCTION uses the title).
- **First step:** read `getNutrition.ts` to find what recipe/name context the tool actually has available to pass as `title` (it may have a recipe object or a free-text name). Then thread it through. If no title is available, that's a finding worth surfacing, not a forced guess.
- **Risk:** low. Verify the existing [tests/unit/chat/getNutrition.test.ts](tests/unit/chat/getNutrition.test.ts) still passes and add one asserting `title` is forwarded.

## OPEN bug #3 — Stage-2 `chosenFdcId: null` discards the deterministic backstop (TRADEOFF — do NOT silently patch)
- **Where:** [src/lib/nutrition/resolve-ingredients.ts](src/lib/nutrition/resolve-ingredients.ts), the selection step (`it.finalFood = s2.chosenFdcId != null ? candidates.find(...) : null`). When Stage 2 runs but the LLM returns `chosenFdcId: null`, `finalFood` becomes null → the ingredient drops to an LLM macro **estimate**, even when `resolveBatch` already found a verified staple/guarded match in `it.batch.food`.
- **The tension:** ADR 0004 calls the staple map + guard "backstops", but in code they're discarded, not fallen back to. The naive fix is `finalFood = chosen ?? it.batch.food`. BUT that can **reintroduce the cooked-rice trap ADR 0004 fixed**: for dry staples (rice/pasta/quinoa) the deterministic `batch.food` may be a *cooked* USDA entry, which is exactly what Stage-2 selection was added to avoid. So `chosen ?? batch.food` is NOT unconditionally safe.
- **This needs a decision, not a code change first.** Grill the user on it: when should the deterministic pick be trusted as a fallback vs. when must a null selection fall through to estimate? Possible shape: fall back to `batch.food` ONLY when it's a staple pin (trusted) or non-dry-weight ingredient. Record the outcome as an ADR addendum either way.

## How to work here
- **Strict TDD is active** + there is a **green eval CI gate**. Write/adjust the test first.
- Verify after each change:
  - `bunx tsc --noEmit`
  - `bun run vitest run tests/unit` (currently 790 pass / 89 files)
  - `bun run test:eval:nutrition` (29 pass / 2 skip — the gate; must stay green)
- Use `bun`, never `npm` (project rule). The `/nutrition` calculator UI is auth-gated and hits the live USDA API, so verify UI via render tests, not a click-through.

## Suggested skills for next session
- `tdd` — strict TDD is enabled; red-green-refactor each fix.
- `grill-with-docs` — for bug #3, to resolve the ADR-0004 tradeoff and update CONTEXT.md / record an ADR before touching code.
- `engineering:debug` — optional, if reproducing #2's fingerprint-split needs a structured repro.
