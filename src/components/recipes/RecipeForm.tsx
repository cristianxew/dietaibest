"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { RecipeFormData, recipeFormSchema } from "@/types/recipe";
import { createRecipe, updateRecipe, getCategories } from "@/actions/recipe";
import { useNutritionAnalysis } from "@/hooks/use-nutrition-analysis";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Loader2,
  TestTube2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import type { RecipeCategory } from "@/generated/prisma";
import { getMockRecipeData } from "@/lib/recipe-mocks";
import { NutritionFactsDisplay } from "./NutritionFactsDisplay";
import { DietBadges } from "./DietBadges";
import { AllergenWarnings } from "./AllergenWarnings";
// import { RecipeEnhancer, QuickQualityIndicator } from "./RecipeEnhancer";

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
  const [manualNutritionMode, setManualNutritionMode] = useState(true); // Changed default to true

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
    error: nutritionError,
  } = useNutritionAnalysis({
    servings: watchedServings || 1,
    onSuccess: (result) => {
      // Only update form with nutrition values if we get nutrition data
      if (result.nutrition) {
        const nutrients = result.nutrition.perServing;

        // Find and set main macronutrients
        const findNutrientValue = (name: string) => {
          const nutrient = nutrients.find((n) =>
            n.nutrient.name.toLowerCase().includes(name.toLowerCase())
          );
          return nutrient ? nutrient.value : undefined;
        };

        form.setValue(
          "calories",
          findNutrientValue("calories") || findNutrientValue("energy")
        );
        form.setValue("protein", findNutrientValue("protein"));
        form.setValue("carbs", findNutrientValue("carbohydrate"));
        form.setValue("fat", findNutrientValue("fat"));
        form.setValue("fiber", findNutrientValue("fiber"));
        form.setValue("sugar", findNutrientValue("sugar"));
        form.setValue("sodium", findNutrientValue("sodium"));

        toast.success("Nutrition analysis complete!");
      }
    },
  });

  // Manual analysis trigger functions
  const handleAnalyzeNutritionOnly = () => {
    if (watchedIngredients && Array.isArray(watchedIngredients)) {
      const validIngredients = watchedIngredients.filter(
        (ing) =>
          ing && typeof ing === "object" && ing.name && ing.amount && ing.unit
      );

      if (validIngredients.length > 0) {
        analyzeNutrition(validIngredients, {
          includeNutrition: true,
          includeDiets: false,
          includeAllergens: false,
        });
      } else {
        toast.error("Please add some ingredients before analyzing nutrition");
      }
    }
  };

  const handleAnalyzeWithDietCompatibility = () => {
    if (watchedIngredients && Array.isArray(watchedIngredients)) {
      const validIngredients = watchedIngredients.filter(
        (ing) =>
          ing && typeof ing === "object" && ing.name && ing.amount && ing.unit
      );

      if (validIngredients.length > 0) {
        analyzeNutrition(validIngredients, {
          includeNutrition: true,
          includeDiets: true,
          includeAllergens: true,
        });
      } else {
        toast.error("Please add some ingredients before analyzing");
      }
    }
  };

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
      // If imported recipe has nutrition data, switch to manual mode to preserve it
      if (recipe.calories || recipe.protein || recipe.carbs || recipe.fat) {
        setManualNutritionMode(true);
      }
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

  const handleAddTag = (tag: string) => {
    const currentTags = form.getValues("tags") || [];
    if (tag && !currentTags.includes(tag)) {
      form.setValue("tags", [...currentTags, tag]);
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const currentTags = form.getValues("tags");
    form.setValue(
      "tags",
      currentTags?.filter((tag) => tag !== tagToRemove)
    );
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
            {/* <TabsTrigger value="ai-assistant">AI Assistant</TabsTrigger> */}
          </TabsList>

          <TabsContent value="basics" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Recipe Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recipe Title</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter recipe title" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Real-time quality indicator */}
                {/* <QuickQualityIndicator
                  recipe={{
                    ...form.getValues(),
                    servings: form.getValues().servings || 1,
                    tags: form.getValues().tags || [],
                    categoryIds: form.getValues().categoryIds || [],
                    isPublic: form.getValues().isPublic || false,
                  }}
                /> */}

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Brief description of the recipe"
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Optional: A short description of your recipe
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="imageUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Image URL</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://example.com/image.jpg"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Optional: URL to an image of the dish
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="prepTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prep Time (minutes)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="15"
                            value={field.value ?? ""}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value
                                  ? parseInt(e.target.value)
                                  : undefined
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cookTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cook Time (minutes)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="30"
                            value={field.value ?? ""}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value
                                  ? parseInt(e.target.value)
                                  : undefined
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="servings"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Servings</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            value={field.value}
                            onChange={(e) =>
                              field.onChange(parseInt(e.target.value) || 1)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="difficulty"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Difficulty</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select difficulty" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="easy">Easy</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="hard">Hard</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-4">
                  <FormLabel>Categories</FormLabel>
                  {loadingCategories ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading categories...
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {categories.map((category) => (
                        <FormField
                          key={category.id}
                          control={form.control}
                          name="categoryIds"
                          render={({ field }) => {
                            const isChecked = field.value?.includes(
                              category.id
                            );
                            return (
                              <FormItem className="flex items-center space-x-2">
                                <FormControl>
                                  <Checkbox
                                    checked={isChecked}
                                    onCheckedChange={(checked) => {
                                      const current = field.value || [];
                                      if (checked) {
                                        field.onChange([
                                          ...current,
                                          category.id,
                                        ]);
                                      } else {
                                        field.onChange(
                                          current.filter(
                                            (id: string) => id !== category.id
                                          )
                                        );
                                      }
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className="text-sm font-normal cursor-pointer">
                                  {category.name}
                                </FormLabel>
                              </FormItem>
                            );
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Label htmlFor="tag-input">Tags</Label>
                    <div className="flex-1 flex gap-2">
                      <Input
                        id="tag-input"
                        placeholder="Add a tag and press Enter"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            const input = e.target as HTMLInputElement;
                            handleAddTag(input.value.trim());
                            input.value = "";
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(form.watch("tags") || []).map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() => handleRemoveTag(tag)}
                      >
                        {tag}
                        <Trash2 className="h-3 w-3 ml-1" />
                      </Badge>
                    ))}
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="isPublic"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center space-x-2">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="text-sm font-normal">
                        Make this recipe public
                      </FormLabel>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ingredients" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Ingredients</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {ingredientFields.map((field, index) => (
                  <div key={field.id} className="flex gap-2">
                    <FormField
                      control={form.control}
                      name={`ingredients.${index}.amount`}
                      render={({ field }) => (
                        <FormItem className="w-24">
                          <FormControl>
                            <Input
                              type="number"
                              step="0.1"
                              placeholder="1"
                              value={field.value}
                              onChange={(e) =>
                                field.onChange(parseFloat(e.target.value) || 0)
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`ingredients.${index}.unit`}
                      render={({ field }) => (
                        <FormItem className="w-32">
                          <FormControl>
                            <Input placeholder="cup" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`ingredients.${index}.name`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input placeholder="Ingredient name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removeIngredient(index)}
                      disabled={ingredientFields.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    appendIngredient({ name: "", amount: 1, unit: "" })
                  }
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Ingredient
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Instructions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {instructionFields.map((field, index) => (
                  <div key={field.id} className="flex gap-2">
                    <div className="flex-shrink-0 w-8 h-8 bg-primary/10 text-primary rounded-full flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </div>
                    <FormField
                      control={form.control}
                      name={`instructions.${index}`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Textarea
                              placeholder="Describe this step..."
                              className="min-h-[80px]"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => removeInstruction(index)}
                      disabled={instructionFields.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => appendInstruction("")}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Step
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="nutrition" className="space-y-6">
            {/* Manual Nutrition Entry Section - Now shown by default */}
            {manualNutritionMode && (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Manual Nutritional Information</CardTitle>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setManualNutritionMode(false)}
                      >
                        Switch to Automatic Analysis
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Enter nutritional values per serving manually, or use
                    automatic analysis buttons below
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="calories"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Calories</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="250"
                              value={field.value ?? ""}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value
                                    ? parseFloat(e.target.value)
                                    : undefined
                                )
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="protein"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Protein (g)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.1"
                              placeholder="20"
                              value={field.value ?? ""}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value
                                    ? parseFloat(e.target.value)
                                    : undefined
                                )
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="carbs"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Carbohydrates (g)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.1"
                              placeholder="30"
                              value={field.value ?? ""}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value
                                    ? parseFloat(e.target.value)
                                    : undefined
                                )
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="fat"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fat (g)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.1"
                              placeholder="10"
                              value={field.value ?? ""}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value
                                    ? parseFloat(e.target.value)
                                    : undefined
                                )
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="fiber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fiber (g)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.1"
                              placeholder="5"
                              value={field.value ?? ""}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value
                                    ? parseFloat(e.target.value)
                                    : undefined
                                )
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="sugar"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sugar (g)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.1"
                              placeholder="8"
                              value={field.value ?? ""}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value
                                    ? parseFloat(e.target.value)
                                    : undefined
                                )
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="sodium"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Sodium (mg)</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              placeholder="300"
                              value={field.value ?? ""}
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value
                                    ? parseFloat(e.target.value)
                                    : undefined
                                )
                              }
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Automatic Analysis Buttons */}
                  <div className="flex flex-col gap-3 pt-4 border-t">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">
                        Automatic Analysis Options
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleAnalyzeNutritionOnly}
                        disabled={nutritionLoading}
                        className="flex-1"
                      >
                        {nutritionLoading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <TestTube2 className="mr-2 h-4 w-4" />
                        )}
                        Analyze Nutrition Only
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleAnalyzeWithDietCompatibility}
                        disabled={nutritionLoading}
                        className="flex-1"
                      >
                        {nutritionLoading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="mr-2 h-4 w-4" />
                        )}
                        Full Analysis + Diet Info
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Automatic analysis will update the nutrition fields above
                      based on your ingredients.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Automatic Nutrition Analysis Section */}
            {!manualNutritionMode && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold">
                      Automatic Nutrition Analysis
                    </h3>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setManualNutritionMode(true)}
                  >
                    Switch to Manual Entry
                  </Button>
                </div>

                <div className="flex gap-2 mb-4">
                  <Button
                    type="button"
                    onClick={handleAnalyzeNutritionOnly}
                    disabled={nutritionLoading}
                  >
                    {nutritionLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <TestTube2 className="mr-2 h-4 w-4" />
                    )}
                    Analyze Nutrition Only
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAnalyzeWithDietCompatibility}
                    disabled={nutritionLoading}
                  >
                    {nutritionLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    Full Analysis + Diet Info
                  </Button>
                </div>

                {nutritionError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {nutritionError}. You can switch to manual entry mode.
                    </AlertDescription>
                  </Alert>
                )}

                {nutritionLoading && (
                  <div className="space-y-4">
                    <Skeleton className="h-[400px] w-full" />
                    <div className="flex gap-4">
                      <Skeleton className="h-[200px] w-full" />
                      <Skeleton className="h-[200px] w-full" />
                    </div>
                  </div>
                )}

                {!nutritionLoading &&
                  !nutritionData &&
                  watchedIngredients.length > 0 && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Click one of the analysis buttons above to analyze the
                        nutrition based on your ingredients.
                      </AlertDescription>
                    </Alert>
                  )}
              </>
            )}

            {/* Analysis Results Display - shown in both modes */}
            {nutritionData && !nutritionLoading && (
              <div className="space-y-6">
                {/* Nutrition Facts Display */}
                {nutritionData.nutrition && (
                  <NutritionFactsDisplay
                    nutrients={nutritionData.nutrition.perServing}
                    servings={nutritionData.nutrition.servings}
                    confidence={nutritionData.confidence}
                    showAllNutrients={false}
                  />
                )}

                {/* Diet Compatibility */}
                {nutritionData.dietCompatibility && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">
                        Diet Compatibility
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <DietBadges
                        classifications={
                          nutritionData.dietCompatibility.classifications
                        }
                        primaryDiets={
                          nutritionData.dietCompatibility.primaryDiets
                        }
                        partialDiets={
                          nutritionData.dietCompatibility.partialDiets
                        }
                        showAll={false}
                      />
                    </CardContent>
                  </Card>
                )}

                {/* Allergen Warnings */}
                {nutritionData.allergens && (
                  <AllergenWarnings
                    allergens={nutritionData.allergens.detectedAllergens}
                    riskLevel={nutritionData.allergens.riskLevel}
                    recommendedLabels={
                      nutritionData.allergens.recommendedLabels
                    }
                    compact={false}
                  />
                )}

                {/* Analysis Metadata */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Analysis Details</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm space-y-1">
                      <p>
                        Matched {nutritionData.matchedIngredients} of{" "}
                        {nutritionData.totalIngredients} ingredients
                      </p>
                      <p>Overall confidence: {nutritionData.confidence}%</p>
                      {nutritionData.warnings.length > 0 && (
                        <div className="mt-2">
                          <p className="font-medium">Warnings:</p>
                          <ul className="list-disc list-inside text-muted-foreground">
                            {nutritionData.warnings.map((warning, idx) => (
                              <li key={idx}>{warning}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* <TabsContent value="ai-assistant" className="space-y-6">
            <RecipeEnhancer
              recipe={{
                ...form.getValues(),
                servings: form.getValues().servings || 1,
                tags: form.getValues().tags || [],
                categoryIds: form.getValues().categoryIds || [],
                isPublic: form.getValues().isPublic || false,
              }}
              onEnhancementApplied={(enhancedRecipe) => {
                form.reset(enhancedRecipe);
                toast.success(
                  "AI enhancements applied! Review the updated form."
                );
              }}
              autoAnalyze={true}
            />
          </TabsContent> */}
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
