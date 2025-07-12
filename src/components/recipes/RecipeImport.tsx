"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Link2, Image, FileText } from "lucide-react";
import { toast } from "sonner";
import { ImageUpload } from "./ImageUpload";
import { PDFUpload } from "./PDFUpload";
import { URLUpload } from "./URLUpload";

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
  const [activeTab, setActiveTab] = useState("url");

  const handleImportSuccess = (data: ImportedRecipeData) => {
    toast.success(t("importSuccess"));
    onImportComplete?.(data);
  };

  // Handle URL upload completion
  const handleURLUploaded = (urlData: {
    url: string;
    extractedData?: ImportedRecipeData;
  }) => {
    if (urlData.extractedData) {
      handleImportSuccess(urlData.extractedData);
    }
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
    toast.error(error);
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
              <URLUpload
                onURLUploaded={handleURLUploaded}
                onUploadError={handleUploadError}
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
