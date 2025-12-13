"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  StyledTabs as Tabs,
  StyledTabsContent as TabsContent,
  StyledTabsList as TabsList,
  StyledTabsTrigger as TabsTrigger,
} from "@/components/custom-ui/styled-tabs";
import type { Macro } from "@/lib/fdc";

interface MacrosSummaryProps {
  total: Macro;
  perServing: Macro;
  servings: number;
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
    <div className="flex flex-col items-center justify-center p-4 bg-card rounded-lg border">
      <div className="text-sm text-muted-foreground mb-1">{label}</div>
      <div className={`text-3xl font-bold ${color}`}>
        {value.toFixed(value >= 100 ? 0 : 1)}
      </div>
      <div className="text-xs text-muted-foreground mt-1">{unit}</div>
    </div>
  );
}

export function MacrosSummary({
  total,
  perServing,
  servings,
}: MacrosSummaryProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Nutrition Summary</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="per-serving" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="per-serving">Per Serving</TabsTrigger>
            <TabsTrigger value="total">Total Recipe</TabsTrigger>
          </TabsList>

          <TabsContent value="per-serving" className="mt-6">
            <div className="mb-4 text-sm text-muted-foreground text-center">
              Nutrition values per serving ({servings} serving
              {servings !== 1 ? "s" : ""} total)
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <MacroCard
                label="Calories"
                value={perServing.kcal}
                unit="kcal"
                color="text-orange-600 dark:text-orange-400"
              />
              <MacroCard
                label="Protein"
                value={perServing.protein}
                unit="g"
                color="text-blue-600 dark:text-blue-400"
              />
              <MacroCard
                label="Fat"
                value={perServing.fat}
                unit="g"
                color="text-yellow-600 dark:text-yellow-400"
              />
              <MacroCard
                label="Carbs"
                value={perServing.carbs}
                unit="g"
                color="text-green-600 dark:text-green-400"
              />
              <MacroCard
                label="Fiber"
                value={perServing.fiber}
                unit="g"
                color="text-purple-600 dark:text-purple-400"
              />
            </div>
          </TabsContent>

          <TabsContent value="total" className="mt-6">
            <div className="mb-4 text-sm text-muted-foreground text-center">
              Total nutrition for entire recipe
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <MacroCard
                label="Calories"
                value={total.kcal}
                unit="kcal"
                color="text-orange-600 dark:text-orange-400"
              />
              <MacroCard
                label="Protein"
                value={total.protein}
                unit="g"
                color="text-blue-600 dark:text-blue-400"
              />
              <MacroCard
                label="Fat"
                value={total.fat}
                unit="g"
                color="text-yellow-600 dark:text-yellow-400"
              />
              <MacroCard
                label="Carbs"
                value={total.carbs}
                unit="g"
                color="text-green-600 dark:text-green-400"
              />
              <MacroCard
                label="Fiber"
                value={total.fiber}
                unit="g"
                color="text-purple-600 dark:text-purple-400"
              />
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
