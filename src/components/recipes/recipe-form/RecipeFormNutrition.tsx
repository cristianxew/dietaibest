"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, Calculator, AlertCircle, Info, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Profile } from "@/lib/fdc";

interface RecipeFormNutritionProps {
  form: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  nutritionLoading: boolean;
  nutritionData: Profile | null;
  onAnalyzeNutrition: () => void;
}

export function RecipeFormNutrition({
  form,
  nutritionLoading,
  nutritionData,
  onAnalyzeNutrition,
}: RecipeFormNutritionProps) {
  const t = useTranslations("nutrition");
  const tRecipes = useTranslations("recipes");

  // const servings = form.watch("servings") || 1;
  const ingredients = form.watch("ingredients") || [];
  const hasIngredients = ingredients.some(
    (ing: { name: string }) => ing.name && ing.name.trim() !== ""
  );

  return (
    <div className="space-y-6">
      {/* Manual Nutrition Entry Section */}
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter nutritional values per serving manually, or use automatic
            analysis below
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="calories"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Calories (kcal)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="250"
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value
                            ? parseFloat(e.target.value)
                            : undefined
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="protein"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tRecipes("protein")} (g)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="20"
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value
                            ? parseFloat(e.target.value)
                            : undefined
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="carbs"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tRecipes("carbs")} (g)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="30"
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value
                            ? parseFloat(e.target.value)
                            : undefined
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="fat"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{tRecipes("fat")} (g)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="10"
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value
                            ? parseFloat(e.target.value)
                            : undefined
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="fiber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fiber (g)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="5"
                      value={field.value ?? ""}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value
                            ? parseFloat(e.target.value)
                            : undefined
                        )
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </CardContent>
      </Card>

      {/* Automatic Analysis Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Automatic Nutrition Analysis
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Powered by USDA FoodData Central
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>How it works</AlertTitle>
            <AlertDescription>
              We match each ingredient to USDA FoodData Central and compute the
              full per-serving profile — macros plus 17 micronutrients. Results
              automatically populate the fields above.
            </AlertDescription>
          </Alert>

          <Button
            type="button"
            onClick={onAnalyzeNutrition}
            disabled={!hasIngredients || nutritionLoading}
            className="w-full"
            size="lg"
          >
            {nutritionLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing Nutrition...
              </>
            ) : (
              <>
                <Calculator className="mr-2 h-4 w-4" />
                Analyze Nutrition
              </>
            )}
          </Button>

          {!hasIngredients && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>No ingredients</AlertTitle>
              <AlertDescription>
                Add ingredients in the previous tab to analyze nutrition.
              </AlertDescription>
            </Alert>
          )}

          {/* Analysis Results */}
          {nutritionData && (
            <div className="space-y-4 pt-4 border-t">
              {/* Macros Summary */}
              <div>
                <h3 className="font-semibold mb-3">
                  Nutritional Information (per serving)
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground">Calories</p>
                    <p className="text-2xl font-bold">
                      {Math.round(nutritionData.calories)}
                    </p>
                    <p className="text-xs text-muted-foreground">kcal</p>
                  </div>
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground">
                      {tRecipes("protein")}
                    </p>
                    <p className="text-2xl font-bold">
                      {Math.round(nutritionData.protein * 10) / 10}
                    </p>
                    <p className="text-xs text-muted-foreground">g</p>
                  </div>
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground">
                      {tRecipes("carbs")}
                    </p>
                    <p className="text-2xl font-bold">
                      {Math.round(nutritionData.carbs * 10) / 10}
                    </p>
                    <p className="text-xs text-muted-foreground">g</p>
                  </div>
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground">
                      {tRecipes("fat")}
                    </p>
                    <p className="text-2xl font-bold">
                      {Math.round(nutritionData.fat * 10) / 10}
                    </p>
                    <p className="text-xs text-muted-foreground">g</p>
                  </div>
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground">Fiber</p>
                    <p className="text-2xl font-bold">
                      {Math.round(nutritionData.fiber * 10) / 10}
                    </p>
                    <p className="text-xs text-muted-foreground">g</p>
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                ✓ Full macro + micronutrient profile saved with the recipe.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
