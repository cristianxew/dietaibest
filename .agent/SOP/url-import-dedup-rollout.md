# SOP — Deploying URL-import dedup (`Recipe.canonicalUrl`)

Deployment note for [PR #38](https://github.com/cristianxew/dietaibest/pull/38) (`14a2ea5`) — cross-user dedup of recipe URL imports. See [Recipe Import System](../System/recipe_import_system.md#url-import-dedup-cross-user-copy-semantics) for the behavior.

> **No feature flag.** Unlike the nutrition engine rollout, this ships on. The only "off" is a revert. Read *Rollback* before deploying.

## What ships

A new nullable `Recipe.canonicalUrl` column + non-unique index. New imports write it; the dedup lookup reads it. **Nothing else in the app reads or writes the column**, so an un-backfilled or entirely NULL column degrades to exactly today's behavior (no dedup) — not to breakage. That property is what makes this safe to ship in one step.

## 1. Migration — automatic, nothing to run

`scripts/docker-entrypoint.sh` runs `prisma migrate deploy` on every container start, so `20260713000000_recipe_canonical_url` applies itself on deploy. Just watch the deploy logs for `[2/3] Running database migrations...` and confirm no error.

To check beforehand: `docker exec -it DietAI-app prisma migrate status --schema=./prisma/schema.prisma` — the new migration should be the only pending one. If others are pending, understand them first; `migrate deploy` applies everything pending, in order.

**Index lock caveat.** The migration does a plain `CREATE INDEX` (not `CONCURRENTLY`), which takes a write lock on `Recipe` for the build. At this app's table size that's milliseconds — ignore it. Only if `Recipe` has grown to millions of rows is this worth avoiding, and note the workaround is *not* to hand-create the index first (the migration would then fail on the duplicate name) — it's to edit the migration to `CREATE INDEX CONCURRENTLY` **and** mark it non-transactional before deploying.

## 2. Backfill — manual, and NOT from the app container

Existing URL imports have `canonicalUrl = NULL` and therefore don't participate in dedup until backfilled. This step is **optional for correctness, required to activate dedup on existing recipes.**

The runner image cannot run it: it's `node:22-alpine` (no bun) and the Dockerfile copies only `scripts/docker-entrypoint.sh`, not the rest of `scripts/`. The canonicalization rules live in TypeScript on purpose (single source of truth), so there is no faithful SQL equivalent either.

Run it from a checkout with bun, pointed at prod:

```bash
DATABASE_URL="<prod DATABASE_URL>" DIRECT_URL="<prod DIRECT_URL>" \
  bun run scripts/backfill-canonical-url.ts
```

Idempotent (only touches `canonicalUrl IS NULL`), keyset-paginated on `id`, safe to re-run and safe to interrupt. It prints `updated` / `skipped` counts; a skip means the stored `sourceUrl` isn't canonicalizable, which is expected for a handful of legacy rows and harmless — they simply keep NULL.

Verify:

```sql
SELECT count(*) FILTER (WHERE "canonicalUrl" IS NOT NULL) AS backfilled,
       count(*) FILTER (WHERE "canonicalUrl" IS NULL)     AS remaining
FROM "Recipe" WHERE source = 'url';
```

## 3. Smoke test

1. Import a recipe URL. Re-import the **same** URL with `?utm_source=x` appended → "already imported" toast + redirect to the existing recipe; **no** Supadata/Gemma call in the logs.
2. Make that recipe public. From a second account, import the same URL → preview appears instantly (no extraction logs); save → the log line is `[Recipe] copied nutrition from <id>`, not `[Recipe] FDC-analyzed`.
3. Keep a recipe **private** and import its URL from another account → must fall through to a normal extraction. This is the privacy boundary; if a private recipe's content ever shows up as a preview, roll back.
4. Edit an ingredient in a dedup preview before saving → `[Recipe] FDC-analyzed` (copy correctly declined).
5. Import a photo/PDF → unaffected, `canonicalUrl` stays NULL.

## Monitoring

- `[Recipe] copied nutrition from` — dedup copy path firing (expected, this is the win).
- `[Recipe] Dedup nutrition copy failed:` — copy threw and fell back to fresh analysis. Best-effort by contract, so a save never fails from this; a *sustained* rate means something is off with the source rows.
- A drop in Supadata/Gemma call volume on repeat URLs is the intended cost saving.

## Rollback

There is no flag. In order of preference:

1. **Revert the app** (redeploy the previous image). The column stays; nothing reads it; behavior returns to pre-dedup. **This is the rollback** — do not drop the column, it is inert.
2. **Neutralize data without a deploy** (if dedup is matching things it shouldn't but you can't redeploy yet): `UPDATE "Recipe" SET "canonicalUrl" = NULL;` — every lookup misses, dedup goes dormant, imports extract normally. Re-run the backfill to restore.
3. Dropping the column/index is only for a permanent removal, and requires reverting the schema first or `migrate deploy` will re-add it on the next start.

Recipes created via the copy path are ordinary rows owned by their importer — a rollback leaves them valid and editable. Nothing to clean up.
