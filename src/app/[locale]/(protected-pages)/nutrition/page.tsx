import { NutritionCalculator } from "@/components/nutrition/NutritionCalculator";

export default function NutritionPage() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">
          Nutrition Calculator
        </h1>
        <p className="text-muted-foreground mt-2">
          Analyze recipe ingredients and calculate accurate nutrition
          information powered by USDA FoodData Central.
        </p>
      </div>
      <NutritionCalculator />
    </div>
  );
}
