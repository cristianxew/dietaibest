# SOP — Rolling out the LLM nutrition engine (Phase G)

How to turn on the LLM-primary + RAG nutrition engine ([ADR 0003](../../docs/adr/0003-llm-primary-nutrition-canonicalization.md) / [ADR 0004](../../docs/adr/0004-llm-assisted-food-resolution.md)) in production. Everything is built and merged but **dormant behind `INGREDIENT_LLM_FALLBACK`**; this is the live switch.

> **One-line rollback:** set `INGREDIENT_LLM_FALLBACK` to anything other than `1` and redeploy. The flag-gated seams (`canonicalizeCached`, `getMacroEstimates`, `runRecipeStage2`, `getRecipeAnalysisCached`) early-return, and the pipeline reverts to the deterministic staple/rank/guard path. No code change, no data migration to undo.

## What the flag changes

Off (today): ingredient names match USDA on the raw parsed text; a miss is an honest `UNRECOGNIZED`. On: names are LLM-canonicalized, the LLM selects the USDA food + estimates portions (RAG), micronutrient retention applies, and the 22-nutrient profile is cached per recipe (`RecipeAnalysisCache`). **Vertex/Gemini becomes a hot-path dependency** — this is the one real ship risk (ADR 0003).

## Pre-flight (do BEFORE flipping)

1. **Confirm the Prisma tables exist in prod.** `RecipeAnalysisCache`, `IngredientNameCache`, `IngredientEstimateCache` must be migrated. Run `bunx prisma migrate status` against the prod `DATABASE_URL`; apply with `migrate deploy` if pending. (They were applied to the dev DB; prod is separate.)
2. **Verify Vertex auth on the VPS — the critical gate.** Auth is resolved by `buildGenAIVertexOptions` ([src/lib/chat/tools/genai-options.ts](../../src/lib/chat/tools/genai-options.ts)). On the Hostinger/Dokploy VPS, **use inline JSON, not a file path** — a Dokploy *File Mount* does not land inside a Compose-type container (the process gets ENOENT). Set in the docker-compose `environment:` block (per the Dokploy deployment note — env vars must be in the compose block, not only the Dokploy UI):
   - `GOOGLE_CLOUD_PROJECT_ID` (required — without it the canonicalizer throws at construction)
   - `GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON` = the full service-account JSON (inline; preferred channel)
   - `GOOGLE_VERTEX_LOCATION` (optional; defaults to `us-central1`)
   - The SA needs the **Vertex AI User** role and the Vertex AI API enabled on the project.
3. **Probe auth before the full flip.** Deploy with the auth vars set but `INGREDIENT_LLM_FALLBACK` still off, then exec into the container / use a one-off and canonicalize a foreign name (e.g. analyze a recipe containing `mięso z piersi kurczaka`). Expect it to resolve to chicken breast (check logs for `[ingredient-canonicalizer]` errors). If you see `"All promises were rejected"` or ADC metadata-server errors, auth is wrong — fix before flipping. **Do not flip the flag until a probe canonicalization succeeds.**

## Flip

4. Set `INGREDIENT_LLM_FALLBACK=1` in the docker-compose `environment:` block and redeploy.
5. **Smoke test in prod:** analyze a recipe with multilingual + count-unit ingredients (e.g. the `pl-d1-*` set from the eval). Confirm `status: OK` coverage, sensible kcal/macros, and that `RecipeAnalysisCache` rows are being written.

## Backfill (after the flag is on and healthy)

6. **Warm `IngredientNameCache`.** Cold-start cost is one LLM call per novel name; until warm, uncached names during a Vertex blip degrade to `UNRECOGNIZED` (honest, not garbage — acceptable, but warming avoids it). Either let it warm organically, or run a backfill that canonicalizes the distinct ingredient names across existing recipes (parse `Recipe.ingredients` → `parseIngredientLine` → `canonicalizeCached` in batches). Re-analysis of existing recipes is optional — stored `Recipe.calories` etc. are write-time snapshots; only re-analyzed recipes pick up the new engine.

## Monitor / rollback triggers

- Watch for a spike in `[ingredient-canonicalizer]` / `[recipe-analyzer]` error logs or a jump in `UNRECOGNIZED` coverage → Vertex auth or quota problem.
- Watch Vertex cost/quota (Stage 1 ≈ one call per novel name ever; Stage 2 ≈ one per unique recipe; both cached).
- **Roll back** (flag → not `1`, redeploy) if: canonicalization error rate is non-trivial, Vertex latency degrades the analysis path, or cost is unexpected. Cached results persist and remain valid after rollback.
