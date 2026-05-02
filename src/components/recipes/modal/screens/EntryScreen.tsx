"use client";

import { useState, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRecipeModal } from "@/hooks/use-recipe-modal";
import { importedToFormData } from "@/lib/recipe-utils";
import { Link2, Camera, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { ImportedRecipeData } from "@/types/recipe";

export function EntryScreen() {
  const t = useTranslations("recipeModal");
  const { goToScreen, setImportedPreview, form } = useRecipeModal();
  const [url, setUrl] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExtractURL = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    goToScreen("loading");
    try {
      const startRes = await fetch("/api/recipes/import/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      if (!startRes.ok) {
        const err = await startRes.json();
        throw new Error(err.error || "Failed to start extraction");
      }
      const { taskId } = await startRes.json();

      await new Promise<void>((resolve, reject) => {
        const es = new EventSource(`/api/recipes/import/url/status?taskId=${taskId}`);
        es.onmessage = (evt) => {
          try {
            const data = JSON.parse(evt.data);
            if (data.type === "complete" || data.status === "completed") {
              es.close();
              const recipe = data.recipe || data.data;
              if (recipe) {
                const preview: ImportedRecipeData = {
                  title: recipe.title || "",
                  description: recipe.description,
                  ingredients: recipe.ingredients || [],
                  instructions: recipe.instructions || [],
                  prepTime: recipe.prepTime,
                  cookTime: recipe.cookTime,
                  servings: recipe.servings,
                  difficulty: recipe.difficulty,
                  cuisine: recipe.cuisine,
                  tags: recipe.tags,
                  calories: recipe.calories,
                  protein: recipe.protein,
                  carbs: recipe.carbs,
                  fat: recipe.fat,
                  fiber: recipe.fiber,
                  sugar: recipe.sugar,
                  sodium: recipe.sodium,
                  imageUrl: recipe.imageUrl,
                  sourceUrl: trimmed,
                };
                setImportedPreview(preview);
                form.reset(importedToFormData(preview));
                goToScreen("preview");
              }
              resolve();
            } else if (data.type === "error" || data.status === "failed") {
              es.close();
              reject(new Error(data.error || "Extraction failed"));
            }
          } catch {
            // ignore parse errors
          }
        };
        es.onerror = () => {
          es.close();
          reject(new Error("Connection error during extraction"));
        };
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to extract recipe");
      goToScreen("entry");
    }
  }, [url, goToScreen, setImportedPreview, form]);

  const handleFileUpload = useCallback(async (file: File) => {
    goToScreen("loading");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/recipes/import/document", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }
      const data = await res.json();
      const recipe = data.recipe || data.data || data;
      const preview: ImportedRecipeData = {
        title: recipe.title || "",
        description: recipe.description,
        ingredients: recipe.ingredients || [],
        instructions: recipe.instructions || [],
        prepTime: recipe.prepTime,
        cookTime: recipe.cookTime,
        servings: recipe.servings,
        difficulty: recipe.difficulty,
        cuisine: recipe.cuisine,
        tags: recipe.tags,
        calories: recipe.calories,
        protein: recipe.protein,
        carbs: recipe.carbs,
        fat: recipe.fat,
        fiber: recipe.fiber,
        sugar: recipe.sugar,
        sodium: recipe.sodium,
        imageUrl: recipe.imageUrl,
        sourceUrl: file.name,
      };
      setImportedPreview(preview);
      form.reset(importedToFormData(preview));
      goToScreen("preview");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to process file");
      goToScreen("entry");
    }
  }, [goToScreen, setImportedPreview, form]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
  }, [handleFileUpload]);

  const handleManual = () => {
    goToScreen("step0");
  };

  return (
    <div className="flex-1 flex items-center justify-center p-8 animate-in fade-in duration-300">
      <div className="w-full max-w-md">
        {/* Title */}
        <div className="text-center mb-7">
          <h2 className="font-display text-2xl font-bold text-foreground mb-2">
            {t("entry.title")}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {t("entry.subtitle")}
          </p>
        </div>

        {/* URL Input */}
        <div
          className={cn(
            "flex items-center gap-2.5 bg-muted rounded-full px-4 py-2.5 mb-2.5",
            "border-[1.5px] transition-colors duration-200",
            url ? "border-primary" : "border-border"
          )}
        >
          <Link2 className={cn("w-4 h-4 shrink-0 transition-colors", url ? "text-primary" : "text-muted-foreground")} />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleExtractURL(); }}
            placeholder={t("entry.urlPlaceholder")}
            className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground"
          />
          {url && (
            <button onClick={() => setUrl("")} className="text-muted-foreground hover:text-foreground transition-colors">
              ×
            </button>
          )}
        </div>

        <button
          onClick={handleExtractURL}
          disabled={!url.trim()}
          className={cn(
            "w-full rounded-full py-3.5 text-sm font-semibold flex items-center justify-center gap-2 mb-6 transition-all duration-200",
            url.trim()
              ? "bg-primary text-primary-foreground shadow-[0_4px_20px_rgba(var(--primary-rgb),.3)] hover:opacity-90"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          )}
        >
          {t("entry.extractButton")}
          <Sparkles className="w-4 h-4" />
        </button>

        {/* OR divider */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[11px] font-bold text-muted-foreground tracking-widest">
            {t("entry.orDivider")}
          </span>
          <div className="flex-1 h-px bg-border" />
        </div>

        {/* Drop zone */}
        <div
          onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-xl p-7 text-center cursor-pointer transition-all duration-200 mb-5",
            dragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-muted-foreground hover:bg-muted/50"
          )}
        >
          <div className="relative w-11 h-11 mx-auto mb-2.5">
            <div className="w-11 h-11 rounded-full bg-muted border border-border flex items-center justify-center">
              <Camera className="w-5 h-5 text-primary" />
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-primary rounded-full border-2 border-card flex items-center justify-center">
              <span className="text-primary-foreground text-[8px] font-bold leading-none">+</span>
            </div>
          </div>
          <p className="text-sm font-semibold text-foreground mb-1">
            {t("entry.dropZoneTitle")}
          </p>
          <p className="text-[11px] font-semibold text-muted-foreground tracking-wide">
            {t("entry.dropZoneSubtitle")}
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Manual link */}
        <div className="text-center">
          <button
            onClick={handleManual}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("entry.addManually")}
          </button>
        </div>
      </div>
    </div>
  );
}
