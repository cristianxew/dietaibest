"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { RecipeFormData, recipeFormSchema } from "@/types/recipe";
import { createRecipe, updateRecipe, getCategories } from "@/actions/recipe";
import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, TestTube2 } from "lucide-react";
import type { RecipeCategory } from "@/generated/prisma";
import { getMockRecipeData } from "@/lib/recipe-mocks";
import {
  RecipeFormBasics,
  RecipeFormIngredients,
  RecipeFormInstructions,
  RecipeFormNutrition,
  useRecipeFormHandlers,
} from "./recipe-form";
import { useNutritionAnalysis } from "@/hooks/use-nutrition-analysis";

interface RecipeFormProps {
  recipe?: RecipeFormData;
  mode: "create" | "edit";
  recipeId?: string;
}

export function RecipeForm({ recipe, mode, recipeId }: RecipeFormProps) {
  const router = useRouter();
  const locale = useLocale();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categories, setCategories] = useState<RecipeCategory[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  const form = useForm({
    resolver: zodResolver(recipeFormSchema),
    defaultValues: recipe || {
      title: "",
      description: "",
      imageUrl: "",
      prepTime: undefined,
      cookTime: undefined,
      servings: 1,
      difficulty: undefined,
      ingredients: [{ name: "", amount: 1, unit: "" }],
      instructions: [""],
      tags: [],
      categoryIds: [],
      isPublic: false,
      calories: undefined,
      protein: undefined,
      carbs: undefined,
      fat: undefined,
      fiber: undefined,
      sugar: undefined,
      sodium: undefined,
    },
  });

  const {
    fields: ingredientFields,
    append: appendIngredient,
    remove: removeIngredient,
  } = useFieldArray({
    control: form.control,
    name: "ingredients",
  });

  const {
    fields: instructionFields,
    append: appendInstruction,
    remove: removeInstruction,
  } = useFieldArray({
    control: form.control,
    name: "instructions" as never,
  });

  // Watch ingredients and servings for nutrition analysis
  const watchedIngredients = form.watch("ingredients");
  const watchedServings = form.watch("servings");

  // Use nutrition analysis hook without automatic triggering
  const {
    analyze: analyzeNutrition,
    isLoading: nutritionLoading,
    data: nutritionData,
  } = useNutritionAnalysis({
    servings: watchedServings || 1,
    onSuccess: (result) => {
      // Only update form with nutrition values if we get nutrition data
      if (result.nutrition?.summary) {
        const { summary } = result.nutrition;

        // Update form with summarized nutrition values
        form.setValue("calories", summary.calories);
        form.setValue("protein", summary.protein);
        form.setValue("carbs", summary.carbs);
        form.setValue("fat", summary.fat);
        form.setValue("fiber", summary.fiber);
        form.setValue("sugar", summary.sugar);
        form.setValue("sodium", summary.sodium);

        // Show source information
        if (result.sources) {
          const { local, usda, cached } = result.sources;
          const sourceInfo = [];
          if (local > 0) sourceInfo.push(`${local} local`);
          if (usda > 0) sourceInfo.push(`${usda} USDA`);
          if (cached > 0) sourceInfo.push(`${cached} cached`);

          toast.success(
            `Nutrition analysis complete! (Sources: ${sourceInfo.join(", ")})`
          );
        } else {
          toast.success("Nutrition analysis complete!");
        }
      }
    },
  });

  // Recipe form handlers hook
  const { handleAddTag, handleRemoveTag, handleAnalyzeNutrition } =
    useRecipeFormHandlers({
      form: form,
      watchedIngredients,
      analyzeNutrition,
    });

  // Load categories
  useEffect(() => {
    async function loadCategories() {
      const { data, error } = await getCategories();
      if (data) {
        setCategories(data);
      } else if (error) {
        toast.error("Failed to load categories");
      }
      setLoadingCategories(false);
    }
    loadCategories();
  }, []);

  // Populate form when recipe data is provided (for imports or edits)
  useEffect(() => {
    if (recipe) {
      console.log("Populating form with recipe data:", recipe);
      form.reset(recipe);
      toast.success(
        "Recipe data imported successfully! Review and edit as needed."
      );
    }
  }, [recipe, form]);

  const onSubmit = async (data: RecipeFormData) => {
    setIsSubmitting(true);

    try {
      if (mode === "create") {
        const { data: createdRecipe, error } = await createRecipe(data);
        if (error) {
          toast.error(error);
        } else if (createdRecipe) {
          toast.success("Recipe created successfully!");
          router.push(`/${locale}/recipes/${createdRecipe.id}`);
        }
      } else if (mode === "edit" && recipeId) {
        const { data: updatedRecipe, error } = await updateRecipe(
          recipeId,
          data
        );
        if (error) {
          toast.error(error);
        } else if (updatedRecipe) {
          toast.success("Recipe updated successfully!");
          router.push(`/${locale}/recipes/${updatedRecipe.id}`);
        }
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFillMockData = () => {
    const mockData = getMockRecipeData();
    form.reset(mockData);
    toast.info("Form filled with mock data and a valid category!");
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <Tabs defaultValue="basics" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basics">Basic Info</TabsTrigger>
            <TabsTrigger value="ingredients">Ingredients & Steps</TabsTrigger>
            <TabsTrigger value="nutrition">
              Nutrition{" "}
              {nutritionLoading && (
                <Loader2 className="ml-1 h-3 w-3 animate-spin" />
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="basics" className="space-y-6">
            <RecipeFormBasics
              form={form}
              categories={categories}
              loadingCategories={loadingCategories}
              onAddTag={handleAddTag}
              onRemoveTag={handleRemoveTag}
            />
          </TabsContent>

          <TabsContent value="ingredients" className="space-y-6">
            <RecipeFormIngredients
              form={form}
              ingredientFields={{
                fields: ingredientFields,
                append: appendIngredient,
                remove: removeIngredient,
              }}
            />

            <RecipeFormInstructions
              form={form}
              instructionFields={{
                fields: instructionFields,
                append: appendInstruction,
                remove: removeInstruction,
              }}
            />
          </TabsContent>

          <TabsContent value="nutrition" className="space-y-6">
            <RecipeFormNutrition
              form={form}
              nutritionLoading={nutritionLoading}
              nutritionData={nutritionData}
              onAnalyzeNutritionOnly={handleAnalyzeNutrition}
            />
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-4">
          {process.env.NODE_ENV === "development" && (
            <Button
              type="button"
              variant="outline"
              onClick={handleFillMockData}
            >
              <TestTube2 className="mr-2 h-4 w-4" />
              Fill with Mock Data
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/${locale}/recipes`)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "create" ? "Create Recipe" : "Update Recipe"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
