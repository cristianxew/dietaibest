"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface NutrientData {
  nutrient: {
    id: string;
    name: string;
    nutrientCategory: string;
  };
  value: number;
  unit: string;
  percentDailyValue?: number;
  confidence: number;
}

interface NutritionFactsDisplayProps {
  nutrients: NutrientData[];
  servings: number;
  confidence?: number;
  className?: string;
  showAllNutrients?: boolean;
}

export function NutritionFactsDisplay({
  nutrients,
  servings,
  confidence = 0,
  className,
  showAllNutrients = false,
}: NutritionFactsDisplayProps) {
  // Group nutrients by category
  const groupedNutrients = nutrients.reduce((acc, nutrient) => {
    const category = nutrient.nutrient.nutrientCategory;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(nutrient);
    return acc;
  }, {} as Record<string, NutrientData[]>);

  // Find key macronutrients
  const findNutrient = (name: string) =>
    nutrients.find((n) => n.nutrient.name.toLowerCase() === name.toLowerCase());

  const calories = findNutrient("calories") || findNutrient("energy");
  const protein = findNutrient("protein");
  const carbs =
    findNutrient("total carbohydrates") || findNutrient("carbohydrates");
  const fat = findNutrient("total fat") || findNutrient("fat");
  const fiber = findNutrient("dietary fiber") || findNutrient("fiber");
  const sugar = findNutrient("sugars") || findNutrient("sugar");
  const sodium = findNutrient("sodium");

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 80) return "default";
    if (confidence >= 60) return "secondary";
    return "destructive";
  };

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold">Nutrition Facts</CardTitle>
          {confidence > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant={getConfidenceBadge(confidence)}>
                    {confidence.toFixed(0)}% confidence
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Analysis confidence based on ingredient matching</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          Per serving · {servings} {servings === 1 ? "serving" : "servings"}{" "}
          total
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Main Calories Display */}
        {calories && (
          <div className="border-b pb-4">
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-bold">
                {calories.value.toFixed(0)}
              </span>
              <span className="text-sm text-muted-foreground">calories</span>
            </div>
          </div>
        )}

        {/* Primary Macronutrients */}
        <div className="space-y-3">
          <h4 className="font-semibold text-sm">Macronutrients</h4>
          {protein && <NutrientRow nutrient={protein} isMain />}
          {carbs && <NutrientRow nutrient={carbs} isMain />}
          {fat && <NutrientRow nutrient={fat} isMain />}
        </div>

        {/* Key Nutrients */}
        {(fiber || sugar || sodium) && (
          <div className="space-y-3 border-t pt-4">
            <h4 className="font-semibold text-sm">Key Nutrients</h4>
            {fiber && <NutrientRow nutrient={fiber} />}
            {sugar && <NutrientRow nutrient={sugar} />}
            {sodium && <NutrientRow nutrient={sodium} />}
          </div>
        )}

        {/* All Other Nutrients (optional) */}
        {showAllNutrients && (
          <>
            {Object.entries(groupedNutrients).map(
              ([category, categoryNutrients]) => {
                // Skip categories we've already shown
                if (category === "Macronutrients" || category === "Energy") {
                  return null;
                }

                // Filter out nutrients we've already displayed
                const remainingNutrients = categoryNutrients.filter(
                  (n) =>
                    n !== calories &&
                    n !== protein &&
                    n !== carbs &&
                    n !== fat &&
                    n !== fiber &&
                    n !== sugar &&
                    n !== sodium
                );

                if (remainingNutrients.length === 0) return null;

                return (
                  <div key={category} className="space-y-3 border-t pt-4">
                    <h4 className="font-semibold text-sm">{category}</h4>
                    {remainingNutrients.map((nutrient) => (
                      <NutrientRow
                        key={nutrient.nutrient.id}
                        nutrient={nutrient}
                        compact
                      />
                    ))}
                  </div>
                );
              }
            )}
          </>
        )}

        {/* Daily Values Note */}
        <div className="border-t pt-3 text-xs text-muted-foreground">
          * Percent Daily Values are based on a 2,000 calorie diet. Your daily
          values may be higher or lower depending on your calorie needs.
        </div>
      </CardContent>
    </Card>
  );
}

interface NutrientRowProps {
  nutrient: NutrientData;
  isMain?: boolean;
  compact?: boolean;
}

function NutrientRow({
  nutrient,
  isMain = false,
  compact = false,
}: NutrientRowProps) {
  const hasLowConfidence = nutrient.confidence < 60;

  return (
    <div
      className={cn(
        "flex items-center justify-between",
        compact && "text-sm",
        hasLowConfidence && "opacity-60"
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn("font-medium", isMain && "font-semibold")}>
          {nutrient.nutrient.name}
        </span>
        {hasLowConfidence && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <AlertCircle className="h-3 w-3 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Low confidence - ingredient may not be accurately matched</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <div className="flex items-center gap-4">
        <span className="text-muted-foreground">
          {nutrient.value < 1 && nutrient.value > 0
            ? nutrient.value.toFixed(2)
            : nutrient.value.toFixed(1)}{" "}
          {nutrient.unit}
        </span>
        {nutrient.percentDailyValue !== undefined &&
          nutrient.percentDailyValue > 0 && (
            <div className="flex items-center gap-2 min-w-[100px]">
              <Progress
                value={Math.min(nutrient.percentDailyValue, 100)}
                className="h-2 flex-1"
              />
              <span className="text-xs text-muted-foreground min-w-[40px] text-right">
                {nutrient.percentDailyValue.toFixed(0)}%
              </span>
            </div>
          )}
      </div>
    </div>
  );
}
