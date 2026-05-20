import { Suspense } from "react";
import { MealPlanner } from "@/components/meal-planner-preview/MealPlanner";

export const metadata = { title: "DietAI · Planificador de Comidas (Preview)" };

export default function MealPlannerPreviewPage() {
  return (
    <Suspense>
      <MealPlanner />
    </Suspense>
  );
}
