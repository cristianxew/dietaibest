import { NutritionCalculator } from "@/components/nutrition/NutritionCalculator";

export default function NutritionPage() {
  return (
    <div className="min-h-screen relative">
      {/* Decorative Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-100/30 dark:bg-brand-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -left-20 w-72 h-72 bg-gold-100/20 dark:bg-gold-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative p-6 lg:p-8 space-y-8">
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
    </div>
  );
}
