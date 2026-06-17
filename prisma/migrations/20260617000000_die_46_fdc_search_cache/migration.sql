-- DIE-46: cache the USDA FDC ingredient *search* step (food detail is already
-- cached in "FdcCache"). Purely additive — a new table + index, no changes to
-- existing tables, so it applies to the shared database without a reset.
CREATE TABLE "FdcSearchCache" (
    "query" TEXT NOT NULL,
    "results" JSONB NOT NULL,
    "lastFetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FdcSearchCache_pkey" PRIMARY KEY ("query")
);

CREATE INDEX "FdcSearchCache_lastFetchedAt_idx" ON "FdcSearchCache"("lastFetchedAt");
