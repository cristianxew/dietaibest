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
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  imageUrl?: string;
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
    "idle" | "importing" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [activeTab, setActiveTab] = useState("url");

  const form = useForm<UrlFormData>({
    resolver: zodResolver(urlSchema),
    defaultValues: {
      url: "",
    },
  });

  const handleUrlSubmit = async (data: UrlFormData) => {
    if (!data.url.trim()) {
      toast.error("URL Required: Please enter a URL to import a recipe.");
      return;
    }

    setImportStatus("importing");
    setErrorMessage("");

    try {
      const response = await fetch("/api/recipes/import/url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: data.url }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Unable to extract recipe from this URL. The website might not be supported or the page doesn't contain a valid recipe."
        );
      }

      // Transform the result to match our interface
      const transformedData: ImportedRecipeData = {
        title: result.title || "Imported Recipe",
        description: result.description || "",
        ingredients: result.ingredients || [],
        instructions: result.instructions || [],
        prepTime: result.prepTime,
        cookTime: result.cookTime,
        servings: result.servings || 4,
        difficulty: result.difficulty,
        cuisine: result.cuisine,
        tags: result.tags || [],
        calories: result.calories,
        protein: result.protein,
        carbs: result.carbs,
        fat: result.fat,
        imageUrl: result.imageUrl,
      };

      handleImportSuccess(transformedData);
    } catch (error) {
      const errorMsg =
        error instanceof Error
          ? error.message
          : "An unexpected error occurred. Please try again.";
      setImportStatus("error");
      setErrorMessage(errorMsg);
      toast.error(errorMsg);
    }
  };

  const handleImportSuccess = (data: ImportedRecipeData) => {
    setImportStatus("success");
    toast.success(t("importSuccess"));
    onImportComplete?.(data);

    // Reset form after success
    setTimeout(() => {
      form.reset();
      setImportStatus("idle");
    }, 2000);
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
      const transformedData: ImportedRecipeData = {
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
        calories: imageData.extractedData.nutritionalInfo?.calories,
        protein: imageData.extractedData.nutritionalInfo?.protein,
        carbs: imageData.extractedData.nutritionalInfo?.carbs,
        fat: imageData.extractedData.nutritionalInfo?.fat,
      };

      handleImportSuccess(transformedData);
    }
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
      const transformedData: ImportedRecipeData = {
        title: pdfData.extractedData.title,
        description: pdfData.extractedData.description,
        ingredients: pdfData.extractedData.ingredients,
        instructions: pdfData.extractedData.instructions,
        prepTime: pdfData.extractedData.prepTime,
        cookTime: pdfData.extractedData.cookTime,
        servings: pdfData.extractedData.servings,
        difficulty: pdfData.extractedData.difficulty,
        cuisine: pdfData.extractedData.cuisine,
        tags: pdfData.extractedData.tags,
        calories: pdfData.extractedData.nutritionalInfo?.calories,
        protein: pdfData.extractedData.nutritionalInfo?.protein,
        carbs: pdfData.extractedData.nutritionalInfo?.carbs,
        fat: pdfData.extractedData.nutritionalInfo?.fat,
      };

      handleImportSuccess(transformedData);
    }
  };

  // Handle upload errors
  const handleUploadError = (error: string) => {
    setImportStatus("error");
    setErrorMessage(error);
    toast.error(error);
  };

  const isLoading = importStatus === "importing";

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
                            disabled={isLoading}
                          />
                        </FormControl>
                        <FormDescription>{t("enterRecipeUrl")}</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {importStatus === "error" && errorMessage && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{errorMessage}</AlertDescription>
                    </Alert>
                  )}

                  <Button type="submit" disabled={isLoading} className="w-full">
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
                </form>
              </Form>

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
                onUploadError={handleUploadError}
                maxFileSize={10}
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
                onUploadError={handleUploadError}
                maxFileSize={20}
                maxPages={15}
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
