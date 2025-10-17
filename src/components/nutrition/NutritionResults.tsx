"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, AlertCircle, XCircle } from "lucide-react";
import type { AnalyzeResult } from "@/actions/analyzeRecipe";
import { MacrosSummary } from "./MacrosSummary";

interface NutritionResultsProps {
  results: AnalyzeResult;
  servings: number;
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  if (confidence >= 0.8) {
    return (
      <Badge variant="default" className="bg-green-600 hover:bg-green-700">
        <CheckCircle2 className="mr-1 h-3 w-3" />
        High
      </Badge>
    );
  } else if (confidence >= 0.5) {
    return (
      <Badge variant="secondary" className="bg-yellow-600 hover:bg-yellow-700">
        <AlertCircle className="mr-1 h-3 w-3" />
        Medium
      </Badge>
    );
  } else if (confidence > 0) {
    return (
      <Badge variant="destructive">
        <AlertCircle className="mr-1 h-3 w-3" />
        Low
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

function DataTypeBadge({ dataType }: { dataType: string | null }) {
  if (!dataType) return null;

  const getColor = (type: string) => {
    switch (type) {
      case "Foundation":
        return "bg-purple-600 hover:bg-purple-700";
      case "Survey (FNDDS)":
        return "bg-blue-600 hover:bg-blue-700";
      case "SR Legacy":
        return "bg-indigo-600 hover:bg-indigo-700";
      case "Branded":
        return "bg-orange-600 hover:bg-orange-700";
      default:
        return "";
    }
  };

  return (
    <Badge variant="secondary" className={getColor(dataType)}>
      {dataType}
    </Badge>
  );
}

export function NutritionResults({ results, servings }: NutritionResultsProps) {
  const hasFailedItems = results.items.some((item) => item.confidence === 0);
  const hasLowConfidence = results.items.some(
    (item) => item.confidence > 0 && item.confidence < 0.5
  );

  return (
    <div className="space-y-6">
      {/* Warnings */}
      {hasFailedItems && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>Some ingredients could not be matched</AlertTitle>
          <AlertDescription>
            No USDA data was found for some ingredients. Their nutritional
            values are shown as zero. Try rephrasing or using more specific
            names.
          </AlertDescription>
        </Alert>
      )}

      {hasLowConfidence && !hasFailedItems && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Low confidence warnings</AlertTitle>
          <AlertDescription>
            Some ingredients have low confidence scores. Check the portion notes
            to understand how measurements were estimated.
          </AlertDescription>
        </Alert>
      )}

      {/* Macros Summary */}
      <MacrosSummary
        total={results.total}
        perServing={results.perServing}
        servings={servings}
      />

      {/* Per-Ingredient Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Ingredient Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Ingredient</TableHead>
                  <TableHead>USDA Match</TableHead>
                  <TableHead className="text-right">Grams</TableHead>
                  <TableHead className="text-right">Calories</TableHead>
                  <TableHead className="text-right">Protein (g)</TableHead>
                  <TableHead className="text-right">Fat (g)</TableHead>
                  <TableHead className="text-right">Carbs (g)</TableHead>
                  <TableHead className="text-right">Fiber (g)</TableHead>
                  <TableHead>Confidence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.items.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">{item.original}</div>
                        {item.description && (
                          <div className="text-xs text-muted-foreground">
                            {item.description}
                          </div>
                        )}
                        <div className="text-xs text-muted-foreground italic">
                          {item.portionNote}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <DataTypeBadge dataType={item.dataType} />
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {item.gramsTotal > 0 ? item.gramsTotal.toFixed(1) : "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {item.macros.kcal > 0 ? item.macros.kcal.toFixed(0) : "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {item.macros.protein > 0
                        ? item.macros.protein.toFixed(1)
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {item.macros.fat > 0 ? item.macros.fat.toFixed(1) : "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {item.macros.carbs > 0
                        ? item.macros.carbs.toFixed(1)
                        : "-"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {item.macros.fiber > 0
                        ? item.macros.fiber.toFixed(1)
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <ConfidenceBadge confidence={item.confidence} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
