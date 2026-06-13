-- Public author identity: optional display name, falls back to email prefix at render
ALTER TABLE "User" ADD COLUMN "displayName" TEXT;

-- Recipe had no indexes at all; every query filters by owner, public listing
-- filters isPublic and orders by createdAt desc
CREATE INDEX "Recipe_userId_idx" ON "Recipe"("userId");
CREATE INDEX "Recipe_isPublic_createdAt_idx" ON "Recipe"("isPublic", "createdAt");

-- Serves the Discover tab listing (isPublic filter + createdAt ordering)
CREATE INDEX "MealPlanTemplate_isPublic_createdAt_idx" ON "MealPlanTemplate"("isPublic", "createdAt");
