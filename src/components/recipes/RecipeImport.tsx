"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowRight,
  Link2,
  Image,
  FileText,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { ImageUpload } from "./ImageUpload";
import { PDFUpload } from "./PDFUpload";
import { ProgressTracker } from "./ProgressTracker";

// URL validation schema
const urlSchema = z.object({
  url: z
    .string()
    .url("Please enter a valid URL")
    .refine((url) => {
      try {
        const urlObj = new URL(url);
        return urlObj.protocol === "http:" || urlObj.protocol === "https:";
      } catch {
        return false;
      }
    }, "URL must start with http:// or https://"),
});

type UrlFormData = z.infer<typeof urlSchema>;

interface ImportedRecipeData {
  title: string;
  description?: string;
  ingredients: Array<{
    name: string;
    amount: number;
    unit: string;
  }>;
  instructions: string[];
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  difficulty?: string;
  cuisine?: string;
  tags?: string[];
  nutritionalInfo?: {
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
  };
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

interface RecipeImportProps {
  onImportComplete?: (recipeData: ImportedRecipeData) => void;
  onSkipImport?: () => void;
}

export function RecipeImport({
  onImportComplete,
  onSkipImport,
}: RecipeImportProps) {
  const t = useTranslations("recipes");
  const [importStatus, setImportStatus] = useState<
    "idle" | "processing" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [activeTab, setActiveTab] = useState("url");
  const [isLoading, setIsLoading] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);

  const form = useForm<UrlFormData>({
    resolver: zodResolver(urlSchema),
    defaultValues: {
      url: "",
    },
  });

  // Handle URL import (existing functionality)
  const handleUrlSubmit = async (data: UrlFormData) => {
    if (!data.url.trim()) {
      toast.error("URL Required, Please enter a URL to import a recipe.");
      return;
    }
    setIsLoading(true);
    setImportStatus("processing");
    setErrorMessage("");
    setCurrentTaskId(null);

    try {
      // Call the backend API endpoint to import the recipe
      const response = await fetch("/api/recipes/import/url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: data.url }),
      });

      const result = await response.json();

      if (!response.ok) {
        setImportStatus("error");
        const errorMsg =
          result.error ||
          "Unable to extract recipe from this URL. The website might not be supported or the page doesn't contain a valid recipe.";
        setErrorMessage(errorMsg);
        toast.error(errorMsg);
        setCurrentTaskId(null);
        setIsLoading(false);
        return;
      }
      console.log("result", result);

      if (result.taskId) {
        setImportStatus("processing");
        setCurrentTaskId(result.taskId);
        // ProgressTracker will now take over
      } else if (result.success && result.data) {
        // Handle immediate success (e.g., from cache or fallback)
        handleImportSuccess(result.data, result.warnings);
      } else {
        throw new Error("Invalid response from server");
      }
    } catch (error) {
      const errorMsg =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred. Please try again.";
      setImportStatus("error");
      setErrorMessage(errorMsg);
      toast.error(errorMsg);
      setCurrentTaskId(null);
    } finally {
      // Don't set isProcessing to false here, ProgressTracker handles it
    }
  };

  const handleImportSuccess = (
    data: ImportedRecipeData,
    warnings?: string[]
  ) => {
    setImportStatus("success");
    toast.success(t("importSuccess"));

    if (warnings && warnings.length > 0) {
      warnings.forEach((warning: string) => {
        toast.warning(warning);
      });
    }

    onImportComplete?.(data);
    setTimeout(() => {
      // Reset state after completion
      setCurrentTaskId(null);
      setIsLoading(false);
      form.reset();
      setImportStatus("idle");
    }, 3000);
  };

  // Handle image upload completion
  const handleImageUploaded = (imageData: {
    file: File;
    preview: string;
    extractedData?: {
      title: string;
      description?: string;
      ingredients: Array<{
        name: string;
        amount: number;
        unit: string;
      }>;
      instructions: string[];
      prepTime?: number;
      cookTime?: number;
      servings?: number;
      difficulty?: string;
      cuisine?: string;
      tags?: string[];
      nutritionalInfo?: {
        calories?: number;
        protein?: number;
        carbs?: number;
        fat?: number;
      };
    };
  }) => {
    if (imageData.extractedData) {
      setImportStatus("success");

      // Transform the extracted data to match the expected format
      const extractedData: ImportedRecipeData = {
        title: imageData.extractedData.title,
        description: imageData.extractedData.description,
        ingredients: imageData.extractedData.ingredients,
        instructions: imageData.extractedData.instructions,
        prepTime: imageData.extractedData.prepTime,
        cookTime: imageData.extractedData.cookTime,
        servings: imageData.extractedData.servings,
        difficulty: imageData.extractedData.difficulty,
        cuisine: imageData.extractedData.cuisine,
        tags: imageData.extractedData.tags,
        nutritionalInfo: imageData.extractedData.nutritionalInfo,
      };

      console.log("Image extraction completed:", extractedData);

      // Call the completion handler after a short delay for better UX
      setTimeout(() => {
        onImportComplete?.(extractedData);
      }, 1000);
    }
  };

  // Handle image upload error
  const handleImageUploadError = (error: string) => {
    setImportStatus("error");
    setErrorMessage(error);
  };

  // Handle PDF upload completion
  const handlePDFUploaded = (pdfData: {
    file: File;
    extractedData?: {
      title: string;
      description?: string;
      ingredients: Array<{
        name: string;
        amount: number;
        unit: string;
      }>;
      instructions: string[];
      prepTime?: number;
      cookTime?: number;
      servings?: number;
      difficulty?: string;
      cuisine?: string;
      tags?: string[];
      nutritionalInfo?: {
        calories?: number;
        protein?: number;
        carbs?: number;
        fat?: number;
      };
    };
  }) => {
    if (pdfData.extractedData) {
      setImportStatus("success");
      handleImportSuccess(pdfData.extractedData);
    }
  };

  // Handle PDF upload error
  const handlePDFUploadError = (error: string) => {
    setImportStatus("error");
    setErrorMessage(error);
  };

  // Handle progress tracker completion
  const handleProgressComplete = (
    success: boolean,
    data?: {
      result?: ImportedRecipeData;
      message?: string;
      warnings?: string[];
    }
  ) => {
    setCurrentTaskId(null);
    setIsLoading(false);

    if (success && data && data.result) {
      // The actual recipe data is in the `result` property from the task
      const recipe = data.result;
      const transformedData: ImportedRecipeData = {
        title: recipe.title || "Imported Recipe",
        description: recipe.description || "",
        prepTime: recipe.prepTime || 0,
        cookTime: recipe.cookTime || 0,
        servings: recipe.servings || 4,
        difficulty: recipe.difficulty || "medium",
        ingredients: recipe.ingredients || [],
        instructions: recipe.instructions || [],
        tags: recipe.tags || [],
        nutritionalInfo: {
          calories: recipe.calories,
          protein: recipe.protein,
          carbs: recipe.carbs,
          fat: recipe.fat,
        },
      };
      handleImportSuccess(transformedData, data.warnings);
    } else {
      setImportStatus("error");
      const errorMsg = data?.message || "Failed to extract recipe from URL.";
      setErrorMessage(errorMsg);
      toast.error("Extraction Failed", {
        description: errorMsg,
      });
    }
  };

  // Handle progress tracker cancellation
  const handleProgressCancel = () => {
    setCurrentTaskId(null);
    setIsLoading(false);
    setImportStatus("idle");
    form.reset();

    toast.info("Extraction Cancelled", {
      description: "Recipe extraction was cancelled by the user.",
    });
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold">{t("importRecipe")}</h2>
        <p className="text-muted-foreground">{t("importDescription")}</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="url" className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            URL
          </TabsTrigger>
          <TabsTrigger value="image" className="flex items-center gap-2">
            <Image className="h-4 w-4" />
            {t("image")}
          </TabsTrigger>
          <TabsTrigger value="pdf" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            PDF
          </TabsTrigger>
        </TabsList>

        <TabsContent value="url">
          <Card>
            <CardHeader>
              <CardTitle>{t("importFromUrl")}</CardTitle>
              <CardDescription>{t("importFromUrlDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!currentTaskId ? (
                <Form {...form}>
                  <form
                    onSubmit={form.handleSubmit(handleUrlSubmit)}
                    className="space-y-4"
                  >
                    <FormField
                      control={form.control}
                      name="url"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("recipeUrl")}</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="https://example.com/recipe/..."
                              {...field}
                              disabled={isLoading || importStatus === "success"}
                              className={
                                form.formState.errors.url
                                  ? "border-red-500"
                                  : ""
                              }
                            />
                          </FormControl>
                          <FormDescription>
                            {t("enterRecipeUrl")}
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {/* Status display */}
                    {importStatus === "error" && errorMessage && (
                      <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{errorMessage}</AlertDescription>
                      </Alert>
                    )}

                    <div className="flex gap-3">
                      <Button
                        type="submit"
                        disabled={isLoading || importStatus === "success"}
                        className="flex-1"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {t("importing")}
                          </>
                        ) : (
                          <>
                            {t("importRecipeButton")}
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              ) : (
                <ProgressTracker
                  taskId={currentTaskId}
                  onComplete={handleProgressComplete}
                  onCancel={handleProgressCancel}
                />
              )}

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    {t("or")}
                  </span>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={onSkipImport}
                disabled={isLoading}
              >
                {t("createRecipeManually")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="image">
          <Card>
            <CardHeader>
              <CardTitle>{t("importFromImage")}</CardTitle>
              <CardDescription>
                {t("importFromImageDescription")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ImageUpload
                onImageUploaded={handleImageUploaded}
                onUploadError={handleImageUploadError}
                maxFileSize={10} // 10MB
                maxWidth={4000}
                maxHeight={4000}
                disabled={isLoading}
              />

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    {t("or")}
                  </span>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={onSkipImport}
                disabled={isLoading}
              >
                {t("createRecipeManually")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pdf">
          <Card>
            <CardHeader>
              <CardTitle>{t("importFromPdf")}</CardTitle>
              <CardDescription>{t("importFromPdfDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <PDFUpload
                onPDFUploaded={handlePDFUploaded}
                onUploadError={handlePDFUploadError}
                maxFileSize={20} // 20MB
                maxPages={15} // Document AI limit
                disabled={isLoading}
              />

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    {t("or")}
                  </span>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={onSkipImport}
                disabled={isLoading}
              >
                {t("createRecipeManually")}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          {t("supportedWebsites")}
        </p>
      </div>
    </div>
  );
}
