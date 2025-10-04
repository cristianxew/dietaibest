"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Calculator, Info } from "lucide-react";
import { toast } from "sonner";
import {
  analyzeRecipeAction,
  type AnalyzeResult,
} from "@/actions/analyzeRecipe";
import { NutritionResults } from "./NutritionResults";
import { Alert, AlertDescription } from "@/components/ui/alert";

const EXAMPLE_RECIPE = `1 cup cooked rice
150 g chicken breast
1 tbsp olive oil
1 cup chopped onion
2 tsp garlic
1/4 cup soy sauce`;

export function NutritionCalculator() {
  const [ingredientsText, setIngredientsText] = useState("");
  const [servings, setServings] = useState(2);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<AnalyzeResult | null>(null);

  const handleAnalyze = async () => {
    if (!ingredientsText.trim()) {
      toast.error("Please enter at least one ingredient");
      return;
    }

    if (servings <= 0) {
      toast.error("Servings must be a positive number");
      return;
    }

    setIsAnalyzing(true);
    setResults(null);

    try {
      const ingredientLines = ingredientsText
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      const result = await analyzeRecipeAction({
        ingredients: ingredientLines,
        servings,
      });

      if (result.success) {
        setResults(result);
        toast.success(
          `Analysis complete! Processed ${result.items.length} ingredients.`
        );
      } else {
        toast.error(result.error || "Analysis failed");
      }
    } catch (error) {
      console.error("Analysis error:", error);
      toast.error("An unexpected error occurred during analysis");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleLoadExample = () => {
    setIngredientsText(EXAMPLE_RECIPE);
    setServings(2);
    toast.info("Example recipe loaded");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Recipe Ingredients</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Enter one ingredient per line with quantity and unit (e.g.,
              &quot;1 cup rice&quot;, &quot;150 g chicken&quot;, &quot;2 tbsp
              olive oil&quot;).
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="ingredients">Ingredients</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleLoadExample}
              >
                Load Example
              </Button>
            </div>
            <Textarea
              id="ingredients"
              placeholder={EXAMPLE_RECIPE}
              value={ingredientsText}
              onChange={(e) => setIngredientsText(e.target.value)}
              rows={10}
              className="font-mono text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="servings">Number of Servings</Label>
            <Input
              id="servings"
              type="number"
              min={1}
              max={100}
              value={servings}
              onChange={(e) => setServings(parseInt(e.target.value) || 1)}
              className="max-w-[200px]"
            />
          </div>

          <Button
            onClick={handleAnalyze}
            disabled={isAnalyzing || !ingredientsText.trim()}
            className="w-full sm:w-auto"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Calculator className="mr-2 h-4 w-4" />
                Calculate Nutrition
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {results && <NutritionResults results={results} servings={servings} />}
    </div>
  );
}
