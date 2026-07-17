/**
 * Backfill Script: Recipe.canonicalUrl for pre-dedup imports
 *
 * Computes canonicalizeRecipeUrl(sourceUrl) for every URL-imported recipe that
 * predates the import-dedup feature. Idempotent — only touches rows where
 * canonicalUrl is still NULL, so it can be re-run safely. Until it runs,
 * legacy imports simply don't participate in dedup (no breakage).
 *
 * Canonicalization rules live in src/lib/ingest/canonicalize-url.ts (single
 * source of truth) — that's why this is a TS script and not migration SQL.
 *
 * Usage: bun run scripts/backfill-canonical-url.ts
 */

import { PrismaClient } from "@/generated/prisma";
import { canonicalizeRecipeUrl } from "@/lib/ingest/canonicalize-url";

const prisma = new PrismaClient();

const BATCH_SIZE = 500;

async function backfillCanonicalUrls() {
  console.log("🚀 Backfilling Recipe.canonicalUrl...");

  let updated = 0;
  let skipped = 0;

  try {
    // Cursor pagination over the not-yet-backfilled slice. Each pass re-queries
    // from the start because updated rows drop out of the filter.
    for (;;) {
      const batch = await prisma.recipe.findMany({
        where: {
          source: "url",
          sourceUrl: { not: null },
          canonicalUrl: null,
        },
        select: { id: true, sourceUrl: true },
        orderBy: { createdAt: "asc" },
        take: BATCH_SIZE,
        skip: skipped,
      });
      if (batch.length === 0) break;

      for (const recipe of batch) {
        const canonicalUrl = canonicalizeRecipeUrl(recipe.sourceUrl ?? "");
        if (!canonicalUrl) {
          // Unparseable sourceUrl (shouldn't happen for source="url") — leave
          // NULL and step over it so the loop can't spin on the same row.
          console.warn(`  ⚠️  ${recipe.id}: sourceUrl not canonicalizable, skipping`);
          skipped += 1;
          continue;
        }
        await prisma.recipe.update({
          where: { id: recipe.id },
          data: { canonicalUrl },
        });
        updated += 1;
      }
      console.log(`  … ${updated} updated so far`);
    }

    console.log(`✅ Done: ${updated} recipes backfilled, ${skipped} skipped.`);
  } finally {
    await prisma.$disconnect();
  }
}

backfillCanonicalUrls().catch((error) => {
  console.error("❌ Backfill failed:", error);
  process.exit(1);
});
