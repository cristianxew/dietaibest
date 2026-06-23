-- Retire Edamam (ADR 0003 E). The nutrition engine is USDA FoodData Central only;
-- the Edamam analysis path and its caches are no longer written or read. Drop both
-- cache tables (their foreign keys are dropped with them).
DROP TABLE IF EXISTS "EdamamUserMacroCache";
DROP TABLE IF EXISTS "EdamamRecipeCache";
