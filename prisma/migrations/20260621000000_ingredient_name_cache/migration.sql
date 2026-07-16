CREATE TABLE "IngredientNameCache" (
    "key" TEXT NOT NULL,
    "canonical" TEXT,
    "lastFetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IngredientNameCache_pkey" PRIMARY KEY ("key")
);
CREATE INDEX "IngredientNameCache_lastFetchedAt_idx" ON "IngredientNameCache"("lastFetchedAt");
