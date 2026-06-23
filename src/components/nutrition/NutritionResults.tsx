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
import { XCircle, Sparkles } from "lucide-react";
import type { AnalyzeResult, IngredientResult } from "@/actions/analyzeRecipe";
import { MacrosSummary } from "./MacrosSummary";

interface NutritionResultsProps {
  results: AnalyzeResult;
  servings: number;
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

/**
 * Honest per-ingredient provenance (ADR 0003): a USDA match shows its data-type
 * badge; an LLM estimate is flagged amber; an unrecognized item is flagged red.
 */
function SourceCell({ item }: { item: IngredientResult }) {
  if (item.status === "ESTIMATED") {
    return (
      <Badge
        variant="secondary"
        className="bg-amber-500 hover:bg-amber-600 text-white"
      >
        <Sparkles className="mr-1 h-3 w-3" />
        Estimated
      </Badge>
    );
  }
  if (item.status === "UNRECOGNIZED" || item.status === "MISSING_QTY") {
    return (
      <Badge variant="destructive">
        <XCircle className="mr-1 h-3 w-3" />
        Not found
      </Badge>
    );
  }
  return <DataTypeBadge dataType={item.dataType} />;
}

export function NutritionResults({ results, servings }: NutritionResultsProps) {
  // `confidence` stays in the data for internal debugging/logging and is never
  // surfaced. The honest, user-facing signal is `coverage` + per-item `status`.
  const { total, resolved, estimated, unrecognized } = results.coverage;

  return (
    <div className="space-y-6">
      {/* Honest coverage signal (ADR 0003) */}
      {estimated > 0 && (
        <Alert>
          <Sparkles className="h-4 w-4" />
          <AlertTitle>
            {estimated} ingredient{estimated === 1 ? "" : "s"} use estimated
            values
          </AlertTitle>
          <AlertDescription>
            These weren&apos;t in the USDA database, so their macros are AI
            estimates and less precise. They are counted in the totals and
            flagged below.
          </AlertDescription>
        </Alert>
      )}

      {unrecognized > 0 && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertTitle>
            {unrecognized} ingredient{unrecognized === 1 ? "" : "s"} could not be
            matched
          </AlertTitle>
          <AlertDescription>
            No USDA match and no estimate was possible. These are excluded from
            the totals — try a more specific name.
          </AlertDescription>
        </Alert>
      )}

      <p className="text-sm text-muted-foreground">
        Coverage: {resolved}/{total} matched to USDA
        {estimated > 0 ? ` · ${estimated} estimated` : ""}
        {unrecognized > 0 ? ` · ${unrecognized} unmatched` : ""}
      </p>

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
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Grams</TableHead>
                  <TableHead className="text-right">Calories</TableHead>
                  <TableHead className="text-right">Protein (g)</TableHead>
                  <TableHead className="text-right">Fat (g)</TableHead>
                  <TableHead className="text-right">Carbs (g)</TableHead>
                  <TableHead className="text-right">Fiber (g)</TableHead>
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
                      </div>
                    </TableCell>
                    <TableCell>
                      <SourceCell item={item} />
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
