"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Calculator, Info, Plus, Trash2, List } from "lucide-react";
import { toast } from "sonner";
import {
  analyzeRecipeProfileAction,
  type AnalyzeProfileResult,
} from "@/actions/analyzeRecipe";
import { NutritionResults } from "./NutritionResults";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { IngredientAutocomplete } from "@/components/recipes/IngredientAutocomplete";
import {
  StyledTabs as Tabs,
  StyledTabsContent as TabsContent,
  StyledTabsList as TabsList,
  StyledTabsTrigger as TabsTrigger,
} from "@/components/custom-ui/styled-tabs";

const EXAMPLE_RECIPE = `1 cup cooked rice
150 g chicken breast
1 tbsp olive oil
1 cup chopped onion
2 tsp garlic
1/4 cup soy sauce`;

interface StructuredIngredient {
  id: string;
  amount: string;
  unit: string;
  name: string;
}

export function NutritionCalculator() {
  const t = useTranslations("nutrition.calculator");
  const [inputMode, setInputMode] = useState<"text" | "structured">(
    "structured"
  );
  const [ingredientsText, setIngredientsText] = useState("");
  const [structuredIngredients, setStructuredIngredients] = useState<
    StructuredIngredient[]
  >([{ id: "1", amount: "", unit: "", name: "" }]);
  const [servings, setServings] = useState(2);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState<AnalyzeProfileResult | null>(null);

  const addIngredient = () => {
    const newId = (structuredIngredients.length + 1).toString();
    setStructuredIngredients([
      ...structuredIngredients,
      { id: newId, amount: "", unit: "", name: "" },
    ]);
  };

  const removeIngredient = (id: string) => {
    if (structuredIngredients.length === 1) return;
    setStructuredIngredients(
      structuredIngredients.filter((ing) => ing.id !== id)
    );
  };

  const updateIngredient = (
    id: string,
    field: keyof StructuredIngredient,
    value: string
  ) => {
    setStructuredIngredients(
      structuredIngredients.map((ing) =>
        ing.id === id ? { ...ing, [field]: value } : ing
      )
    );
  };

  const handleAnalyze = async () => {
    let ingredientLines: string[] = [];

    // Get ingredients based on input mode
    if (inputMode === "text") {
      if (!ingredientsText.trim()) {
        toast.error(t("errors.enterIngredient"));
        return;
      }
      ingredientLines = ingredientsText
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
    } else {
      // Structured mode - build ingredient lines from structured data
      const validIngredients = structuredIngredients.filter((ing) =>
        ing.name.trim()
      );

      if (validIngredients.length === 0) {
        toast.error(t("errors.addIngredient"));
        return;
      }

      ingredientLines = validIngredients.map((ing) => {
        const parts = [];
        if (ing.amount) parts.push(ing.amount);
        if (ing.unit) parts.push(ing.unit);
        parts.push(ing.name);
        return parts.join(" ");
      });
    }

    if (servings <= 0) {
      toast.error(t("errors.servingsPositive"));
      return;
    }

    setIsAnalyzing(true);
    setResults(null);

    try {
      const result = await analyzeRecipeProfileAction({
        ingredients: ingredientLines,
        servings,
      });

      if (result.success) {
        setResults(result);
        toast.success(t("success.analysisComplete", { count: result.items.length }));
      } else {
        toast.error(result.error || t("errors.analysisFailed"));
      }
    } catch (error) {
      console.error("Analysis error:", error);
      toast.error(t("errors.unexpected"));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleLoadExample = () => {
    setIngredientsText(EXAMPLE_RECIPE);
    setServings(2);
    toast.info(t("exampleLoaded"));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("cardTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs
            value={inputMode}
            onValueChange={(value) =>
              setInputMode(value as "text" | "structured")
            }
          >
            <TabsList className="mb-4">
              <TabsTrigger value="structured">
                <List className="mr-2 h-4 w-4" />
                {t("structuredTab")}
              </TabsTrigger>
              <TabsTrigger value="text">
                <Info className="mr-2 h-4 w-4" />
                {t("textTab")}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="structured" className="space-y-4 mt-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>{t("structuredHint")}</AlertDescription>
              </Alert>

              <div className="space-y-3">
                {structuredIngredients.map((ingredient) => (
                  <div key={ingredient.id} className="flex gap-2">
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="1"
                      value={ingredient.amount}
                      onChange={(e) =>
                        updateIngredient(
                          ingredient.id,
                          "amount",
                          e.target.value
                        )
                      }
                      className="w-20"
                    />
                    <Input
                      placeholder="cup"
                      value={ingredient.unit}
                      onChange={(e) =>
                        updateIngredient(ingredient.id, "unit", e.target.value)
                      }
                      className="w-28"
                    />
                    <IngredientAutocomplete
                      value={ingredient.name}
                      onChange={(value) =>
                        updateIngredient(ingredient.id, "name", value)
                      }
                      placeholder={t("searchPlaceholder")}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removeIngredient(ingredient.id)}
                      disabled={structuredIngredients.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={addIngredient}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t("addIngredient")}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="text" className="space-y-4 mt-4">
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>{t("textHint")}</AlertDescription>
              </Alert>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="ingredients">{t("ingredientsLabel")}</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleLoadExample}
                  >
                    {t("loadExample")}
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
            </TabsContent>
          </Tabs>

          <div className="space-y-2">
            <Label htmlFor="servings">{t("servingsLabel")}</Label>
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
            disabled={isAnalyzing}
            className="w-full sm:w-auto"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("analyzing")}
              </>
            ) : (
              <>
                <Calculator className="mr-2 h-4 w-4" />
                {t("calculate")}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {results && <NutritionResults results={results} servings={servings} />}
    </div>
  );
}
