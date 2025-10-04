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
import { Loader2, Calculator, AlertCircle, Info } from "lucide-react";
import { RecipeNutritionDisplay } from "@/components/recipes/RecipeNutritionDisplay";
import type { AnalyzeResult } from "@/actions/analyzeRecipe";

interface RecipeFormNutritionProps {
  form: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  nutritionLoading: boolean;
  nutritionData: AnalyzeResult | null;
  onAnalyzeNutrition: () => void;
}

export function RecipeFormNutrition({
  form,
  nutritionLoading,
  nutritionData,
  onAnalyzeNutrition,
}: RecipeFormNutritionProps) {
  const servings = form.watch("servings") || 1;
  const ingredients = form.watch("ingredients") || [];
  const hasIngredients = ingredients.some(
    (ing: { name: string }) => ing.name && ing.name.trim() !== ""
  );

  return (
    <div className="space-y-6">
      {/* Manual Nutrition Entry Section */}
      <Card>
        <CardHeader>
          <CardTitle>Nutrition Information</CardTitle>
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
                  <FormLabel>Protein (g)</FormLabel>
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
                  <FormLabel>Carbohydrates (g)</FormLabel>
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
                  <FormLabel>Fat (g)</FormLabel>
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
          <CardTitle>Automatic Nutrition Analysis</CardTitle>
          <p className="text-sm text-muted-foreground">
            Powered by USDA FoodData Central
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertTitle>How it works</AlertTitle>
            <AlertDescription>
              Our calculator analyzes your ingredients using the USDA database
              to provide accurate nutrition information. Results will
              automatically populate the fields above.
            </AlertDescription>
          </Alert>

          <Button
            type="button"
            onClick={onAnalyzeNutrition}
            disabled={!hasIngredients || nutritionLoading}
            className="w-full"
          >
            {nutritionLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing Nutrition...
              </>
            ) : (
              <>
                <Calculator className="mr-2 h-4 w-4" />
                Calculate Nutrition from Ingredients
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
              <RecipeNutritionDisplay
                result={nutritionData}
                servings={servings}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
