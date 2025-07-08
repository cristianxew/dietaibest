"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  Link2,
  Image,
  FileText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

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
  const [isProcessing, setIsProcessing] = useState(false);
  const [importStatus, setImportStatus] = useState<
    "idle" | "processing" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const form = useForm<UrlFormData>({
    resolver: zodResolver(urlSchema),
    defaultValues: {
      url: "",
    },
  });

  const handleUrlSubmit = async (data: UrlFormData) => {
    setIsProcessing(true);
    setImportStatus("processing");
    setErrorMessage("");

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
        setErrorMessage(
          result.error ||
            "Unable to extract recipe from this URL. The website might not be supported or the page doesn't contain a valid recipe."
        );
        toast.error(t("importError"));
        return;
      }

      if (result.success && result.data) {
        setImportStatus("success");
        toast.success(t("importSuccess"));

        // Show any warnings if present
        if (result.warnings && result.warnings.length > 0) {
          result.warnings.forEach((warning: string) => {
            toast.warning(warning);
          });
        }

        // Transform the API response to match the expected format
        const extractedData: ImportedRecipeData = {
          title: result.data.title,
          description: result.data.description,
          ingredients: result.data.ingredients,
          instructions: result.data.instructions,
          prepTime: result.data.prepTime,
          cookTime: result.data.cookTime,
          servings: result.data.servings,
        };

        // Call the completion handler after a short delay for better UX
        setTimeout(() => {
          onImportComplete?.(extractedData);
        }, 1000);
      } else {
        setImportStatus("error");
        setErrorMessage(
          "Unexpected response format from server. Please try again."
        );
        toast.error(t("importError"));
      }
    } catch {
      setImportStatus("error");
      setErrorMessage("An unexpected error occurred. Please try again.");
      toast.error(t("unexpectedError"));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold">{t("importRecipe")}</h2>
        <p className="text-muted-foreground">{t("importDescription")}</p>
      </div>

      <Tabs defaultValue="url" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="url" className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            URL
          </TabsTrigger>
          <TabsTrigger
            value="image"
            disabled
            className="flex items-center gap-2"
          >
            <Image className="h-4 w-4" />
            {t("image")}
          </TabsTrigger>
          <TabsTrigger value="pdf" disabled className="flex items-center gap-2">
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
                            disabled={isProcessing}
                            className={
                              form.formState.errors.url ? "border-red-500" : ""
                            }
                          />
                        </FormControl>
                        <FormDescription>{t("enterRecipeUrl")}</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Status display */}
                  {importStatus !== "idle" && (
                    <Alert
                      variant={
                        importStatus === "error" ? "destructive" : "default"
                      }
                      className={
                        importStatus === "success"
                          ? "border-green-500 bg-green-50 dark:bg-green-950"
                          : importStatus === "processing"
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                          : ""
                      }
                    >
                      <div className="flex items-center gap-2">
                        {importStatus === "processing" && (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <AlertDescription>
                              {t("extractingRecipe")}
                            </AlertDescription>
                          </>
                        )}
                        {importStatus === "success" && (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <AlertDescription className="text-green-600">
                              {t("recipeImportedSuccessfully")}
                            </AlertDescription>
                          </>
                        )}
                        {importStatus === "error" && (
                          <>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{errorMessage}</AlertDescription>
                          </>
                        )}
                      </div>
                    </Alert>
                  )}

                  <div className="flex gap-3">
                    <Button
                      type="submit"
                      disabled={isProcessing || importStatus === "success"}
                      className="flex-1"
                    >
                      {isProcessing ? (
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
                disabled={isProcessing}
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
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Image className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>{t("imageImportComingSoon")}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pdf">
          <Card>
            <CardHeader>
              <CardTitle>{t("importFromPdf")}</CardTitle>
              <CardDescription>{t("importFromPdfDescription")}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>{t("pdfImportComingSoon")}</p>
              </div>
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
