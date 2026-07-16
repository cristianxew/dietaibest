-- LLM per-100g macro estimates for foods USDA does not carry (ADR 0003).
-- Keyed by the normalized canonical name; one estimate serves every raw spelling.
CREATE TABLE "IngredientEstimateCache" (
    "name" TEXT NOT NULL,
    "kcal" DOUBLE PRECISION NOT NULL,
    "protein" DOUBLE PRECISION NOT NULL,
    "fat" DOUBLE PRECISION NOT NULL,
    "carbs" DOUBLE PRECISION NOT NULL,
    "fiber" DOUBLE PRECISION NOT NULL,
    "lastFetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IngredientEstimateCache_pkey" PRIMARY KEY ("name")
);
CREATE INDEX "IngredientEstimateCache_lastFetchedAt_idx" ON "IngredientEstimateCache"("lastFetchedAt");
