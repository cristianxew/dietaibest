"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { findKeyMacros, type NutrientData } from "@/utils/nutrientFinder";

// Re-export for backwards compatibility
export type { NutrientData };

interface NutritionFactsDisplayProps {
  nutrients: NutrientData[];
  servings: number;
  confidence?: number;
  className?: string;
  showAllNutrients?: boolean;
  sources?: {
    local: number;
    usda: number;
    cached: number;
  };
}

export function NutritionFactsDisplay({
  nutrients,
  servings,
  confidence = 0,
  className,
  showAllNutrients: showAllNutrientsProp = false,
  sources,
}: NutritionFactsDisplayProps) {
  const [showAllNutrients, setShowAllNutrients] =
    useState(showAllNutrientsProp);

  console.log("NutritionFactsDisplay - Nutrients:", nutrients);

  // Debug: Log all nutrients to console
  console.log("NutritionFactsDisplay - All nutrients:", nutrients);

  // Group nutrients by category
  const groupedNutrients = nutrients.reduce((acc, nutrient) => {
    const category = nutrient.nutrient.nutrientCategory;
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(nutrient);
    return acc;
  }, {} as Record<string, NutrientData[]>);

  console.log("Grouped nutrients by category:", groupedNutrients);

  // Find key macronutrients using centralized utility
  const { calories, protein, carbs, fat, fiber, sugar, sodium } = findKeyMacros(
    nutrients,
    true
  );

  console.log("Found key nutrients:", {
    calories,
    protein,
    carbs,
    fat,
    fiber,
    sugar,
    sodium,
  });

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
          <div className="flex items-center gap-2">
            {sources && (sources.usda > 0 || sources.local > 0) && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="text-xs">
                      {sources.usda > 0 && sources.local > 0
                        ? "Mixed Sources"
                        : sources.usda > 0
                        ? "USDA Data"
                        : "Local Data"}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-sm space-y-1">
                      {sources.local > 0 && (
                        <p>Local database: {sources.local} ingredients</p>
                      )}
                      {sources.usda > 0 && (
                        <p>USDA database: {sources.usda} ingredients</p>
                      )}
                      {sources.cached > 0 && (
                        <p>Cached: {sources.cached} ingredients</p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
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
        </div>
        <p className="text-sm text-muted-foreground">
          Per serving · {servings} {servings === 1 ? "serving" : "servings"}{" "}
          total
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Main Calories Display with Macro Breakdown */}
        {calories && (
          <div className="border-b pb-4 space-y-4">
            <div className="flex items-baseline justify-between">
              <span className="text-4xl font-bold">
                {calories.value.toFixed(0)}
              </span>
              <span className="text-sm text-muted-foreground">calories</span>
            </div>

            {/* Visual Macro Breakdown Bar */}
            {protein && carbs && fat && (
              <div className="space-y-3">
                <div className="h-4 w-full bg-gray-100 rounded-full overflow-hidden flex">
                  {(() => {
                    const proteinCal = protein.value * 4;
                    const carbsCal = carbs.value * 4;
                    const fatCal = fat.value * 9;
                    const total = proteinCal + carbsCal + fatCal;

                    if (total === 0) return null;

                    const proteinPercent = (proteinCal / total) * 100;
                    const carbsPercent = (carbsCal / total) * 100;
                    const fatPercent = (fatCal / total) * 100;

                    return (
                      <>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className="bg-red-500 h-full transition-all"
                                style={{ width: `${proteinPercent}%` }}
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Protein: {proteinPercent.toFixed(1)}%</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className="bg-amber-500 h-full transition-all"
                                style={{ width: `${carbsPercent}%` }}
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Carbs: {carbsPercent.toFixed(1)}%</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div
                                className="bg-blue-500 h-full transition-all"
                                style={{ width: `${fatPercent}%` }}
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Fat: {fatPercent.toFixed(1)}%</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </>
                    );
                  })()}
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded-sm" />
                    <span className="text-muted-foreground">
                      Protein {protein.value.toFixed(1)}g
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-amber-500 rounded-sm" />
                    <span className="text-muted-foreground">
                      Carbs {carbs.value.toFixed(1)}g
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-sm" />
                    <span className="text-muted-foreground">
                      Fat {fat.value.toFixed(1)}g
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Primary Macronutrients */}
        {protein || carbs || fat ? (
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">Macronutrients</h4>
            {protein && <NutrientRow nutrient={protein} isMain />}
            {carbs && <NutrientRow nutrient={carbs} isMain />}
            {fat && <NutrientRow nutrient={fat} isMain />}
          </div>
        ) : (
          // Fallback: Show all nutrients from Macronutrients category if main ones not found
          groupedNutrients["Macronutrients"] && (
            <div className="space-y-3">
              <h4 className="font-semibold text-sm">Macronutrients</h4>
              {groupedNutrients["Macronutrients"].map(
                (nutrient: NutrientData) => (
                  <NutrientRow
                    key={nutrient.nutrient.id}
                    nutrient={nutrient}
                    isMain
                  />
                )
              )}
            </div>
          )
        )}

        {/* Key Nutrients */}
        {fiber || sugar || sodium ? (
          <div className="space-y-3 border-t pt-4">
            <h4 className="font-semibold text-sm">Key Nutrients</h4>
            {fiber && <NutrientRow nutrient={fiber} />}
            {sugar && <NutrientRow nutrient={sugar} />}
            {sodium && <NutrientRow nutrient={sodium} />}
          </div>
        ) : (
          // Fallback: Show all available nutrients as key nutrients
          nutrients.length > 0 &&
          !protein &&
          !carbs &&
          !fat && (
            <div className="space-y-3 border-t pt-4">
              <h4 className="font-semibold text-sm">Available Nutrients</h4>
              {nutrients.slice(0, 10).map((nutrient) => (
                <NutrientRow key={nutrient.nutrient.id} nutrient={nutrient} />
              ))}
            </div>
          )
        )}

        {/* All Other Nutrients (optional) */}
        {showAllNutrients && (
          <>
            {(
              Object.entries(groupedNutrients) as [string, NutrientData[]][]
            ).map(([category, categoryNutrients]) => {
              // Skip categories we've already shown
              if (category === "Macronutrients" || category === "Energy") {
                return null;
              }

              // Filter out nutrients we've already displayed
              const remainingNutrients = categoryNutrients.filter(
                (n: NutrientData) =>
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
                  {remainingNutrients.map((nutrient: NutrientData) => (
                    <NutrientRow
                      key={nutrient.nutrient.id}
                      nutrient={nutrient}
                      compact
                    />
                  ))}
                </div>
              );
            })}
          </>
        )}

        {/* Toggle Button for All Nutrients */}
        {nutrients.length > 7 && (
          <div className="border-t pt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAllNutrients(!showAllNutrients)}
              className="w-full"
            >
              {showAllNutrients
                ? `Hide Additional Nutrients`
                : `Show All ${nutrients.length} Nutrients`}
            </Button>
          </div>
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
