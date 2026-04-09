"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { Prisma } from "@/generated/prisma";
import { PortionsSelector } from "./PortionsSelector";
import { IngredientsList } from "./IngredientsList";
import { MacroDisplay } from "./MacroDisplay";

interface RecipeScalableContentProps {
  baseServings: number;
  ingredients: Prisma.JsonValue;
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  fiber?: number | null;
  children?: React.ReactNode;
}

export function RecipeScalableContent({
  baseServings,
  ingredients,
  calories,
  protein,
  carbs,
  fat,
  fiber,
  children,
}: RecipeScalableContentProps) {
  const [selectedPortions, setSelectedPortions] = useState(baseServings);
  const t = useTranslations("recipes");

  const multiplier = selectedPortions / baseServings;

  return (
    <div className="space-y-12">
      {/* Row 1: Portions Selector + Nutrition side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        <PortionsSelector
          value={selectedPortions}
          onChange={setSelectedPortions}
        />
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">
            {t("portions.nutritionLabel")}
          </h3>
          <MacroDisplay
            calories={calories}
            protein={protein}
            carbs={carbs}
            fat={fat}
            fiber={fiber}
          />
        </div>
      </div>

      {/* Row 2: Ingredients + Instructions (children) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
        {/* Ingredients */}
        <section className="space-y-6">
          <h2 className="text-3xl font-display font-bold flex items-center gap-3">
            <div className="h-8 w-1 bg-brand-500 rounded-full" />
            {t("ingredients")}
          </h2>
          <IngredientsList ingredients={ingredients} multiplier={multiplier} />
        </section>

        {children}
      </div>
    </div>
  );
}
