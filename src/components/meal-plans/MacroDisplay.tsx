"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import type { MacroSummary, MacroTarget } from "@/types/meal-plan";
import {
  compareMacros,
  formatMacroValue,
  getProgressPercentage,
  getMacroProgressColor,
  getMacroStatusColor,
  getMacroStatusLabel,
} from "@/lib/meal-plan-macros";
import { Target } from "lucide-react";
import { cn } from "@/lib/utils";

interface MacroDisplayProps {
  macros: MacroSummary;
  targets?: MacroTarget;
  title?: string;
  compact?: boolean;
  className?: string;
}

export function MacroDisplay({
  macros,
  targets,
  title = "Macro Summary",
  compact = false,
  className,
}: MacroDisplayProps) {
  const comparisons = compareMacros(macros, targets);

  // Determine overall status (most conservative)
  const hasOver = Object.values(comparisons).some((c) => c.status === "over");
  const hasUnder = Object.values(comparisons).some((c) => c.status === "under");
  const overallStatus = hasOver
    ? "over"
    : hasUnder
    ? "under"
    : "on-track";

  if (compact) {
    return (
      <div className={cn("space-y-2", className)}>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Macros</span>
          <Badge
            variant="outline"
            className={cn(
              "text-xs",
              getMacroStatusColor(overallStatus)
            )}
          >
            {getMacroStatusLabel(overallStatus)}
          </Badge>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <p className="text-xs text-muted-foreground">Calories</p>
            <p className="text-sm font-medium">{Math.round(macros.calories)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Protein</p>
            <p className="text-sm font-medium">{Math.round(macros.protein)}g</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Carbs</p>
            <p className="text-sm font-medium">{Math.round(macros.carbs)}g</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Fat</p>
            <p className="text-sm font-medium">{Math.round(macros.fat)}g</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Target className="w-5 h-5" />
            {title}
          </CardTitle>
          <Badge
            variant="outline"
            className={cn(
              getMacroStatusColor(overallStatus)
            )}
          >
            {getMacroStatusLabel(overallStatus)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Calories */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Calories</span>
            <span className="text-sm">
              {formatMacroValue(macros.calories, "calories")}
              {comparisons.calories.target && (
                <span className="text-muted-foreground">
                  {" "}
                  / {formatMacroValue(comparisons.calories.target, "calories")}
                </span>
              )}
            </span>
          </div>
          <Progress
            value={getProgressPercentage(
              macros.calories,
              comparisons.calories.target
            )}
            className="h-2"
            indicatorClassName={getMacroProgressColor(
              comparisons.calories.status
            )}
          />
          {comparisons.calories.percentage !== undefined && (
            <p className="text-xs text-muted-foreground text-right">
              {comparisons.calories.percentage}% of target
            </p>
          )}
        </div>

        {/* Protein */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Protein</span>
            <span className="text-sm">
              {formatMacroValue(macros.protein, "macros")}
              {comparisons.protein.target && (
                <span className="text-muted-foreground">
                  {" "}
                  / {formatMacroValue(comparisons.protein.target, "macros")}
                </span>
              )}
            </span>
          </div>
          <Progress
            value={getProgressPercentage(
              macros.protein,
              comparisons.protein.target
            )}
            className="h-2"
            indicatorClassName={getMacroProgressColor(
              comparisons.protein.status
            )}
          />
          {comparisons.protein.percentage !== undefined && (
            <p className="text-xs text-muted-foreground text-right">
              {comparisons.protein.percentage}% of target
            </p>
          )}
        </div>

        {/* Carbs */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Carbs</span>
            <span className="text-sm">
              {formatMacroValue(macros.carbs, "macros")}
              {comparisons.carbs.target && (
                <span className="text-muted-foreground">
                  {" "}
                  / {formatMacroValue(comparisons.carbs.target, "macros")}
                </span>
              )}
            </span>
          </div>
          <Progress
            value={getProgressPercentage(macros.carbs, comparisons.carbs.target)}
            className="h-2"
            indicatorClassName={getMacroProgressColor(comparisons.carbs.status)}
          />
          {comparisons.carbs.percentage !== undefined && (
            <p className="text-xs text-muted-foreground text-right">
              {comparisons.carbs.percentage}% of target
            </p>
          )}
        </div>

        {/* Fat */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Fat</span>
            <span className="text-sm">
              {formatMacroValue(macros.fat, "macros")}
              {comparisons.fat.target && (
                <span className="text-muted-foreground">
                  {" "}
                  / {formatMacroValue(comparisons.fat.target, "macros")}
                </span>
              )}
            </span>
          </div>
          <Progress
            value={getProgressPercentage(macros.fat, comparisons.fat.target)}
            className="h-2"
            indicatorClassName={getMacroProgressColor(comparisons.fat.status)}
          />
          {comparisons.fat.percentage !== undefined && (
            <p className="text-xs text-muted-foreground text-right">
              {comparisons.fat.percentage}% of target
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
