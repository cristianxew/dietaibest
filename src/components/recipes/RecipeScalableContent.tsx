import type { Prisma } from "@/generated/prisma";
import { IngredientsList } from "./IngredientsList";

interface RecipeScalableContentProps {
  ingredients: Prisma.JsonValue;
  multiplier: number;
  servings?: number;
  children?: React.ReactNode;
}

export function RecipeScalableContent({
  ingredients,
  multiplier,
  servings,
  children,
}: RecipeScalableContentProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.3fr] gap-8 lg:gap-10 items-start mt-8">
      {/* Left Column: Ingredients */}
      <div className="bg-card border border-border/60 rounded-2xl p-6 md:p-8 shadow-sm">
        <div className="flex items-center justify-between mb-5 pb-4 border-b border-border/40">
          <h2 className="text-2xl font-display font-bold text-foreground">Ingredients</h2>
          {servings !== undefined && (
            <span className="text-sm font-semibold text-brand-500">+{servings} servings</span>
          )}
        </div>
        <IngredientsList ingredients={ingredients} multiplier={multiplier} />
      </div>

      {/* Right Column */}
      <div className="space-y-8">
        {children}
      </div>
    </div>
  );
}
