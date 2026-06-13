-- Add extended nutrition (micronutrient) columns to Recipe.
-- All nullable and additive — existing rows and older code are unaffected.
ALTER TABLE "Recipe"
  ADD COLUMN "sugar" DOUBLE PRECISION,
  ADD COLUMN "sodium" DOUBLE PRECISION,
  ADD COLUMN "cholesterol" DOUBLE PRECISION,
  ADD COLUMN "saturatedFat" DOUBLE PRECISION,
  ADD COLUMN "transFat" DOUBLE PRECISION,
  ADD COLUMN "vitaminA" DOUBLE PRECISION,
  ADD COLUMN "vitaminC" DOUBLE PRECISION,
  ADD COLUMN "vitaminD" DOUBLE PRECISION,
  ADD COLUMN "vitaminE" DOUBLE PRECISION,
  ADD COLUMN "vitaminK" DOUBLE PRECISION,
  ADD COLUMN "vitaminB12" DOUBLE PRECISION,
  ADD COLUMN "folate" DOUBLE PRECISION,
  ADD COLUMN "iron" DOUBLE PRECISION,
  ADD COLUMN "calcium" DOUBLE PRECISION,
  ADD COLUMN "magnesium" DOUBLE PRECISION,
  ADD COLUMN "potassium" DOUBLE PRECISION,
  ADD COLUMN "zinc" DOUBLE PRECISION;
