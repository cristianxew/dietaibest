-- Import dedup (cross-user copy semantics). canonicalUrl is the normalized
-- sourceUrl; NULL for manual recipes and image imports. Backfill for existing
-- source='url' rows runs via scripts/backfill-canonical-url.ts (TS-owned rules).
ALTER TABLE "Recipe" ADD COLUMN "canonicalUrl" TEXT;

-- Non-unique on purpose: many users may legitimately hold rows for the same URL.
CREATE INDEX "Recipe_canonicalUrl_idx" ON "Recipe"("canonicalUrl");
