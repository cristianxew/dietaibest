-- AlterTable: MealPlanMeal partial-failure fields (DIE-37)
-- Make recipeId nullable so AI-generated slots can exist before a recipe is created
ALTER TABLE "MealPlanMeal" ALTER COLUMN "recipeId" DROP NOT NULL;

-- Add generation failure tracking columns
ALTER TABLE "MealPlanMeal" ADD COLUMN "generationFailed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MealPlanMeal" ADD COLUMN "generationError" TEXT;
