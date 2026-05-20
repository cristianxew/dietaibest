import { MealPlannerApp } from '@/components/meal-planner-preview/MealPlannerApp';
import '@/components/meal-planner-preview/meal-planner.css';

export const metadata = {
  title: 'DietAI · Planificador de Comidas (Preview)',
};

export default function MealPlannerPreviewPage() {
  return <MealPlannerApp />;
}
