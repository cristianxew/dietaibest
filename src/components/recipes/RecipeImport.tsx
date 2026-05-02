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
import {
  StyledTabs as Tabs,
  StyledTabsContent as TabsContent,
  StyledTabsList as TabsList,
  StyledTabsTrigger as TabsTrigger,
} from "@/components/custom-ui/styled-tabs";
import { Button } from "@/components/ui/button";
import { Link2, Image, FileText } from "lucide-react";
import { toast } from "sonner";
import { ImageUpload } from "./ImageUpload";
import { PDFUpload } from "./PDFUpload";
import { URLUpload } from "./URLUpload";
import type { ImportedRecipe } from "@/types/recipe";

interface RecipeImportProps {
  onImportComplete?: (recipeData: ImportedRecipe) => void;
  onSkipImport?: () => void;
}

export function RecipeImport({
  onImportComplete,
  onSkipImport,
}: RecipeImportProps) {
  const t = useTranslations("recipes");
  const [activeTab, setActiveTab] = useState("url");

  // Handle URL upload completion - pass data through without analysis
  const handleURLUploaded = (urlData: {
    url: string;
    extractedData?: ImportedRecipe;
  }) => {
    if (urlData.extractedData) {
      toast.success("Recipe imported successfully");
      onImportComplete?.(urlData.extractedData);
    }
  };

  // Handle image upload completion - pass data through without analysis
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
      const transformedData: ImportedRecipe = {
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

      toast.success("Recipe imported successfully");
      onImportComplete?.(transformedData);
    }
  };

  // Handle PDF upload completion - pass data through without analysis
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
      const transformedData: ImportedRecipe = {
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

      toast.success("Recipe imported successfully");
      onImportComplete?.(transformedData);
    }
  };

  const handleError = (error: string) => {
    toast.error(error);
  };

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
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

          <TabsContent value="url" className="mt-6">
            <URLUpload
              onURLUploaded={handleURLUploaded}
              onUploadError={handleError}
            />
          </TabsContent>

          <TabsContent value="image" className="mt-6">
            <ImageUpload
              onImageUploaded={handleImageUploaded}
              onUploadError={handleError}
            />
          </TabsContent>

          <TabsContent value="pdf" className="mt-6">
            <PDFUpload
              onPDFUploaded={handlePDFUploaded}
              onUploadError={handleError}
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
          </TabsContent>
        </Tabs>
      </CardContent>
      <Button variant="outline" className="w-full mt-4" onClick={onSkipImport}>
        {t("createRecipeManually")}
      </Button>
    </Card>
  );
}
