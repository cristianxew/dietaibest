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
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, TestTube2, AlertCircle, Sparkles } from "lucide-react";
import { NutritionFactsDisplay } from "../NutritionFactsDisplay";

interface RecipeFormNutritionProps {
  form: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  nutritionLoading: boolean;
  nutritionData: any | null; // eslint-disable-line @typescript-eslint/no-explicit-any
  onAnalyzeNutritionOnly: (preferUSDA: boolean) => void;
}

export function RecipeFormNutrition({
  form,
  nutritionLoading,
  nutritionData,
  onAnalyzeNutritionOnly,
}: RecipeFormNutritionProps) {
  return (
    <div className="space-y-6">
      {/* Manual Nutrition Entry Section */}
      <Card>
        <CardHeader>
          <p className="text-sm text-muted-foreground">
            Enter nutritional values per serving manually, or use automatic
            analysis buttons below
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="calories"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Calories</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
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
            <FormField
              control={form.control}
              name="sugar"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sugar (g)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="8"
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
              name="sodium"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Sodium (mg)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="300"
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

          {/* Automatic Analysis Buttons */}
          <div className="flex flex-col gap-3 pt-4 border-t">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">
                Automatic Analysis Options
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Analyze ingredients to automatically calculate nutrition values
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Button
                type="button"
                variant="default"
                onClick={() => onAnalyzeNutritionOnly(false)}
                disabled={nutritionLoading}
                className="h-auto py-4 flex flex-col items-start gap-1"
              >
                <div className="flex items-center gap-2 w-full">
                  {nutritionLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <TestTube2 className="h-5 w-5" />
                  )}
                  <span className="font-semibold">Automatic Analysis</span>
                </div>
                <span className="text-xs opacity-90 text-left">
                  Automatic analysis of ingredients
                </span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Analysis Results Display */}
      {nutritionData && !nutritionLoading && (
        <div className="space-y-6">
          {/* Success Message & Summary */}
          <Alert className="border-green-200 bg-green-50">
            <Sparkles className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">
              Analysis Complete!
            </AlertTitle>
            <AlertDescription className="text-green-700">
              Successfully analyzed {nutritionData.matchedIngredients} of{" "}
              {nutritionData.totalIngredients} ingredients with{" "}
              {nutritionData.confidence}% confidence.
              {nutritionData.sources && (
                <span>
                  {" "}
                  Sources:{" "}
                  {nutritionData.sources.local > 0 &&
                    `${nutritionData.sources.local} local`}
                  {nutritionData.sources.usda > 0 &&
                    `, ${nutritionData.sources.usda} USDA`}
                  {nutritionData.sources.cached > 0 &&
                    `, ${nutritionData.sources.cached} cached`}
                  .
                </span>
              )}
            </AlertDescription>
          </Alert>

          {/* Warnings if any */}
          {nutritionData.warnings.length > 0 && (
            <Alert variant="default">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Analysis Warnings</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside space-y-1 mt-2">
                  {nutritionData.warnings.map(
                    (warning: string, idx: number) => (
                      <li key={idx}>{warning}</li>
                    )
                  )}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Nutrition Facts Display */}
          {nutritionData.nutrition && (
            <NutritionFactsDisplay
              nutrients={nutritionData.nutrition.perServing}
              servings={nutritionData.nutrition.servings}
              confidence={nutritionData.confidence}
              showAllNutrients={true}
              sources={nutritionData.sources}
            />
          )}
        </div>
      )}
    </div>
  );
}
