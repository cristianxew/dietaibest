"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import type { AnalyzeResult } from "@/actions/analyzeRecipe";

interface RecipeNutritionDisplayProps {
  result: AnalyzeResult;
  servings: number;
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  if (confidence >= 0.8) {
    return (
      <Badge variant="default" className="bg-green-600 hover:bg-green-700">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        High Confidence
      </Badge>
    );
  } else if (confidence >= 0.5) {
    return (
      <Badge variant="secondary" className="bg-yellow-600 hover:bg-yellow-700">
        <AlertCircle className="mr-1 h-3 w-3" />
        Medium Confidence
      </Badge>
    );
  } else if (confidence > 0) {
    return (
      <Badge variant="destructive">
        <AlertCircle className="mr-1 h-3 w-3" />
        Low Confidence
      </Badge>
    );
  } else {
    return (
      <Badge variant="outline" className="border-red-500 text-red-500">
        <XCircle className="mr-1 h-3 w-3" />
        No Match
      </Badge>
    );
  }
}

function MacroCard({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: number;
  unit: string;
  color: string;
}) {
  return (
    <div className="text-center">
      <div className="text-sm text-muted-foreground mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>
        {value.toFixed(value >= 100 ? 0 : 1)}
      </div>
      <div className="text-xs text-muted-foreground">{unit}</div>
    </div>
  );
}

export function RecipeNutritionDisplay({
  result,
  servings,
}: RecipeNutritionDisplayProps) {
  const hasFailedItems = result.items.some((item) => item.confidence === 0);
  const hasLowConfidence = result.items.some(
    (item) => item.confidence > 0 && item.confidence < 0.5
  );

  // Calculate average confidence
  const avgConfidence =
    result.items.reduce((sum, item) => sum + item.confidence, 0) /
    result.items.length;

  return (
    <div className="space-y-4">
      {/* Warnings */}
      {hasFailedItems && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Some ingredients could not be matched with USDA data. Their values
            are shown as zero.
          </AlertDescription>
        </Alert>
      )}

      {hasLowConfidence && !hasFailedItems && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Some ingredients have low confidence scores. Check the details
            below.
          </AlertDescription>
        </Alert>
      )}

      {/* Per Serving Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Per Serving</CardTitle>
            <div className="text-sm text-muted-foreground">
              {servings} {servings === 1 ? "serving" : "servings"} total
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-4">
            <MacroCard
              label="Calories"
              value={result.perServing.kcal}
              unit="kcal"
              color="text-orange-600 dark:text-orange-400"
            />
            <MacroCard
              label="Protein"
              value={result.perServing.protein}
              unit="g"
              color="text-blue-600 dark:text-blue-400"
            />
            <MacroCard
              label="Fat"
              value={result.perServing.fat}
              unit="g"
              color="text-yellow-600 dark:text-yellow-400"
            />
            <MacroCard
              label="Carbs"
              value={result.perServing.carbs}
              unit="g"
              color="text-green-600 dark:text-green-400"
            />
            <MacroCard
              label="Fiber"
              value={result.perServing.fiber}
              unit="g"
              color="text-purple-600 dark:text-purple-400"
            />
          </div>
        </CardContent>
      </Card>

      {/* Ingredient Details */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Ingredient Matches</CardTitle>
            <ConfidenceBadge confidence={avgConfidence} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {result.items.map((item, idx) => (
              <div
                key={idx}
                className="flex items-start justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div className="flex-1 space-y-1">
                  <div className="font-medium">{item.original}</div>
                  {item.description && (
                    <div className="text-sm text-muted-foreground">
                      Matched: {item.description}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground italic">
                    {item.portionNote}
                  </div>
                  {item.gramsTotal > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {item.gramsTotal.toFixed(1)}g •{" "}
                      {item.macros.kcal.toFixed(0)} kcal
                    </div>
                  )}
                </div>
                <div className="ml-4">
                  <ConfidenceBadge confidence={item.confidence} />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Total Recipe */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Total Recipe</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-4">
            <MacroCard
              label="Calories"
              value={result.total.kcal}
              unit="kcal"
              color="text-orange-600 dark:text-orange-400"
            />
            <MacroCard
              label="Protein"
              value={result.total.protein}
              unit="g"
              color="text-blue-600 dark:text-blue-400"
            />
            <MacroCard
              label="Fat"
              value={result.total.fat}
              unit="g"
              color="text-yellow-600 dark:text-yellow-400"
            />
            <MacroCard
              label="Carbs"
              value={result.total.carbs}
              unit="g"
              color="text-green-600 dark:text-green-400"
            />
            <MacroCard
              label="Fiber"
              value={result.total.fiber}
              unit="g"
              color="text-purple-600 dark:text-purple-400"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
