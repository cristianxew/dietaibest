-- Cached LLM-primary recipe analysis (ADR 0003, Stage 2 + the cacheable USDA asset).
-- Keyed by the recipe fingerprint (title + ingredient lines). USDA FoodData Central
-- is public domain, so the full 22-nutrient per-serving Profile may be persisted.
CREATE TABLE "RecipeAnalysisCache" (
    "fingerprint" TEXT NOT NULL,
    "servings" INTEGER NOT NULL,
    "profileJson" JSONB NOT NULL,
    "stage2Json" JSONB NOT NULL,
    "coverageJson" JSONB NOT NULL,
    "lastAnalyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecipeAnalysisCache_pkey" PRIMARY KEY ("fingerprint")
);
CREATE INDEX "RecipeAnalysisCache_lastAnalyzedAt_idx" ON "RecipeAnalysisCache"("lastAnalyzedAt");
