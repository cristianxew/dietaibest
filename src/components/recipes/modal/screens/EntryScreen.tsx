"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useRecipeModal } from "@/hooks/use-recipe-modal";
import { useRecipeForm } from "@/hooks/use-recipe-form";
import { importedToFormData } from "@/lib/recipe-utils";
import {
  Link2,
  Camera,
  Sparkles,
  PenLine,
  ChevronRight,
  ArrowLeft,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { ImportedRecipe } from "@/types/recipe";

type EntryView = "chooser" | "import";

/** Server error envelope: `{ error: { code, message } }` (or entitlement payload). */
type ApiError = { code?: string; message?: string } | undefined;

export function EntryScreen() {
  const t = useTranslations("recipeModal");
  const locale = useLocale();
  const router = useRouter();
  const { goToScreen, setImportedPreview, close } = useRecipeModal();
  const { form } = useRecipeForm();
  const [view, setView] = useState<EntryView>("chooser");
  const [url, setUrl] = useState("");
  const [dragging, setDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Map a server error code to a friendly message; fall back to the server's
  // own message, then a generic string.
  const toErrorMessage = useCallback(
    (err: ApiError): string => {
      const map: Record<string, string> = {
        "no-recipe": t("import.errors.noRecipe"),
        "rate-limited": t("import.errors.rateLimited"),
        "daily-cap": t("import.errors.dailyCap"),
        "unsupported-format": t("import.errors.unsupportedFormat"),
        "file-too-large": t("import.errors.fileTooLarge"),
        PRO_ONLY: t("import.errors.proOnly"),
      };
      const code = err?.code;
      return (code && map[code]) || err?.message || t("import.errors.generic");
    },
    [t]
  );

  // Map an extracted recipe into the preview + prefill the form, then show the
  // preview screen. `sourceUrl` drives the persisted recipe's provenance: an
  // http(s) URL → "url", a filename → "imported" (see use-recipe-form).
  const applyImported = useCallback(
    (recipe: Partial<ImportedRecipe>, sourceUrl: string) => {
      const preview: ImportedRecipe = {
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
        sourceUrl,
        dedupSourceRecipeId: recipe.dedupSourceRecipeId,
      };
      setImportedPreview(preview);
      form.reset(importedToFormData(preview));
      goToScreen("preview");
    },
    [form, goToScreen, setImportedPreview]
  );

  const handleExtractURL = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/recipes/import/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed, locale }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(toErrorMessage(data?.error));
        setIsLoading(false);
        return;
      }
      // Dedup: this user already imported the exact same link — nothing to
      // extract or create, just take them to their existing recipe.
      if (data.alreadyImported?.id) {
        toast.info(t("import.alreadyImported"));
        close();
        router.push(`/${locale}/recipes/${data.alreadyImported.id}`);
        return;
      }
      applyImported(
        { ...(data.recipe ?? {}), dedupSourceRecipeId: data.dedupSourceRecipeId },
        trimmed
      );
    } catch {
      toast.error(t("import.errors.generic"));
      setIsLoading(false);
    }
  }, [url, locale, applyImported, toErrorMessage, t, close, router]);

  const handleFileUpload = useCallback(
    async (file: File) => {
      goToScreen("loading");
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("locale", locale);
        const res = await fetch("/api/recipes/import/image", {
          method: "POST",
          body: formData,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          toast.error(toErrorMessage(data?.error));
          goToScreen("entry");
          return;
        }
        applyImported(data.recipe ?? {}, file.name);
      } catch {
        toast.error(t("import.errors.generic"));
        goToScreen("entry");
      }
    },
    [locale, applyImported, goToScreen, toErrorMessage, t]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFileUpload(file);
    },
    [handleFileUpload]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFileUpload(file);
    },
    [handleFileUpload]
  );

  const handleManual = () => {
    // An abandoned import (entry → preview → back → Manual entry) must not
    // leak its sourceUrl/dedupSourceRecipeId into a manual-entry session —
    // otherwise handleSubmit derives source: "url" for a recipe the user
    // explicitly chose to type by hand, and persistRecipe computes a real
    // canonicalUrl for a URL the user rejected.
    setImportedPreview(null);
    form.setValue("sourceUrl", "");
    goToScreen("step0");
  };

  // Hand off to the AI chat assistant: open the drawer with a seed prompt, then
  // close this modal so the conversation is front and center.
  const handleAskAssistant = () => {
    window.dispatchEvent(
      new CustomEvent("dietai:open-chat", {
        detail: { prompt: t("entry.aiPrompt") },
      })
    );
    close();
  };

  return (
    <div className="flex-1 flex items-center justify-center p-8 animate-in fade-in duration-300">
      <div className="w-full max-w-md">
        {isLoading ? (
          <div className="text-center space-y-6 py-4">
            <div className="relative w-[60px] h-[60px] mx-auto">
              <div className="absolute inset-0 rounded-full border-[3px] border-border border-t-primary animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center text-primary">
                <Sparkles className="w-5 h-5" />
              </div>
            </div>
            <div>
              <h3 className="font-display text-xl font-semibold text-foreground mb-1.5">
                {t("loading.title")}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t("loading.subtitle")}
              </p>
            </div>
          </div>
        ) : view === "chooser" ? (
          <>
            {/* Title */}
            <div className="text-center mb-7">
              <h2 className="font-display text-2xl font-bold text-foreground mb-2">
                {t("entry.title")}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t("entry.subtitle")}
              </p>
            </div>

            {/* Three options */}
            <div className="space-y-3">
              <OptionCard
                icon={PenLine}
                title={t("entry.optionManualTitle")}
                description={t("entry.optionManualDesc")}
                onClick={handleManual}
              />
              <OptionCard
                icon={Sparkles}
                title={t("entry.optionAiTitle")}
                description={t("entry.optionAiDesc")}
                onClick={handleAskAssistant}
                accent
              />
              <OptionCard
                icon={Link2}
                title={t("entry.optionImportTitle")}
                description={t("entry.optionImportDesc")}
                onClick={() => setView("import")}
              />
            </div>
          </>
        ) : (
          <>
            {/* Import header with back to chooser */}
            <div className="mb-6">
              <button
                onClick={() => setView("chooser")}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
              >
                <ArrowLeft className="w-4 h-4" />
                {t("header.back")}
              </button>
              <h2 className="font-display text-2xl font-bold text-foreground mb-2">
                {t("entry.importTitle")}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {t("entry.importSubtitle")}
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
              <Link2
                className={cn(
                  "w-4 h-4 shrink-0 transition-colors",
                  url ? "text-primary" : "text-muted-foreground"
                )}
              />
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleExtractURL();
                }}
                placeholder={t("entry.urlPlaceholder")}
                className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground"
              />
              {url && (
                <button
                  onClick={() => setUrl("")}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  ×
                </button>
              )}
            </div>

            {/* Supported sources hint — paste from social video or any recipe site */}
            <p className="text-[11px] text-muted-foreground leading-snug mb-4 px-1">
              {t("entry.urlHint")}
            </p>

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
              onDragEnter={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-xl p-7 text-center cursor-pointer transition-all duration-200",
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
                  <span className="text-primary-foreground text-[8px] font-bold leading-none">
                    +
                  </span>
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
              accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
              className="hidden"
              onChange={handleFileChange}
            />
          </>
        )}
      </div>
    </div>
  );
}

function OptionCard({
  icon: Icon,
  title,
  description,
  onClick,
  accent = false,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group w-full flex items-center gap-4 text-left rounded-2xl border p-4 transition-all duration-200",
        "hover:-translate-y-px hover:shadow-md",
        accent
          ? "border-primary/40 bg-primary/5 hover:border-primary"
          : "border-border bg-card hover:border-muted-foreground/40"
      )}
    >
      <span
        className={cn(
          "shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-colors",
          accent
            ? "bg-primary/15 text-primary"
            : "bg-muted text-muted-foreground group-hover:text-foreground"
        )}
      >
        <Icon className="w-5 h-5" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[15px] font-semibold text-foreground">{title}</div>
        <div className="text-[13px] text-muted-foreground leading-snug">
          {description}
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-foreground transition-colors shrink-0" />
    </button>
  );
}
