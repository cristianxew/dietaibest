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
                color="text-brand-700 dark:text-brand-600"
              />
              <MacroCard
                label="Protein"
                value={perServing.protein}
                unit="g"
                color="text-slate-600 dark:text-slate-400"
              />
              <MacroCard
                label="Fat"
                value={perServing.fat}
                unit="g"
                color="text-sage-700 dark:text-sage-600"
              />
              <MacroCard
                label="Carbs"
                value={perServing.carbs}
                unit="g"
                color="text-gold-700 dark:text-gold-400"
              />
              <MacroCard
                label="Fiber"
                value={perServing.fiber}
                unit="g"
                color="text-foreground"
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
                color="text-brand-700 dark:text-brand-600"
              />
              <MacroCard
                label="Protein"
                value={total.protein}
                unit="g"
                color="text-slate-600 dark:text-slate-400"
              />
              <MacroCard
                label="Fat"
                value={total.fat}
                unit="g"
                color="text-sage-700 dark:text-sage-600"
              />
              <MacroCard
                label="Carbs"
                value={total.carbs}
                unit="g"
                color="text-gold-700 dark:text-gold-400"
              />
              <MacroCard
                label="Fiber"
                value={total.fiber}
                unit="g"
                color="text-foreground"
              />
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
