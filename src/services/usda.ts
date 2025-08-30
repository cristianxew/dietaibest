import { IngredientNutrient, Nutrient } from "@/generated/prisma";

const USDA_API_BASE_URL = "https://api.nal.usda.gov/fdc/v1";

/**
 * Fetches nutrient data for an ingredient from the USDA FoodData Central API.
 * Returns an array compatible with IngredientNutrient & Nutrient shapes.
 */
export async function fetchUSDAIngredientNutrition(
  ingredientId: string,
  ingredientName: string
): Promise<(IngredientNutrient & { nutrient: Nutrient })[]> {
  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey) {
    console.warn("USDA_API_KEY not configured");
    return [];
  }

  try {
    const searchUrl = new URL(`${USDA_API_BASE_URL}/foods/search`);
    searchUrl.searchParams.set("api_key", apiKey);
    searchUrl.searchParams.set("query", ingredientName);
    searchUrl.searchParams.set("pageSize", "1");

    const searchRes = await fetch(searchUrl.toString());
    if (!searchRes.ok) {
      console.warn("USDA search failed", searchRes.status);
      return [];
    }
    const searchData = await searchRes.json();
    const food = searchData?.foods?.[0];
    if (!food) {
      return [];
    }

    const detailUrl = new URL(`${USDA_API_BASE_URL}/food/${food.fdcId}`);
    detailUrl.searchParams.set("api_key", apiKey);
    const detailRes = await fetch(detailUrl.toString());
    if (!detailRes.ok) {
      console.warn("USDA detail fetch failed", detailRes.status);
      return [];
    }
    const detailData = await detailRes.json();
    const nutrients = detailData.foodNutrients || [];

    return nutrients.map((n: any, index: number) => {
      const rawNutrientId =
        n.nutrient?.id ?? n.nutrientId ?? n.nutrientNumber ?? null;
      const nameFallback = n.nutrient?.name ?? n.nutrientName ?? "unknown";
      const safeNutrientIdBase =
        rawNutrientId !== null && rawNutrientId !== undefined
          ? String(rawNutrientId)
          : `usda:${String(nameFallback).toLowerCase().replace(/\s+/g, "_")}`;
      const safeNutrientId =
        safeNutrientIdBase.trim() !== ""
          ? safeNutrientIdBase
          : `usda:${String(nameFallback)
              .toLowerCase()
              .replace(/\s+/g, "_") || "unknown"}`;

      const ingredientNutrientId = `usda:${ingredientId}:${safeNutrientId}`;

      return {
        id: ingredientNutrientId,
        ingredientId,
        nutrientId: safeNutrientId,
        value: n.amount ?? n.value ?? 0,
        confidence: 0.8,
        nutrient: {
          id: safeNutrientId,
          name: nameFallback ?? "Unknown",
          unit: (n.nutrient?.unitName ?? n.unitName ?? "").toLowerCase(),
          nutrientCategory: n.nutrient?.nutrientCategory || "USDA",
          dailyValue: null,
          displayOrder: 0,
        },
      } as IngredientNutrient & { nutrient: Nutrient };
    });
  } catch (error) {
    console.warn("USDA nutrition lookup error", error);
    return [];
  }
}
