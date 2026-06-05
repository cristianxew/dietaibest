"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export interface RecipePreview {
  title: string;
  description?: string;
  imageUrl?: string;
  servings?: number;
  prepTime?: number;
  cookTime?: number;
  ingredients: { name: string; amount: number; unit?: string }[];
  instructions: string[];
}

interface RecipePreviewCardProps {
  recipe: RecipePreview;
  onSave: () => void;
  onCancel: () => void;
}

function formatIngredient(i: { name: string; amount: number; unit?: string }): string {
  const unit = i.unit && i.unit !== "unit" ? i.unit : "";
  const qty = i.amount > 0 ? `${i.amount} ${unit}`.trim() : "";
  return qty ? `${qty} ${i.name}` : i.name;
}

export function RecipePreviewCard({ recipe, onSave, onCancel }: RecipePreviewCardProps) {
  const t = useTranslations("chat.preview");

  const meta: string[] = [];
  if (recipe.servings) meta.push(`${t("servings")}: ${recipe.servings}`);
  if (recipe.prepTime) meta.push(`${t("prep")}: ${recipe.prepTime} ${t("minutesShort")}`);
  if (recipe.cookTime) meta.push(`${t("cook")}: ${recipe.cookTime} ${t("minutesShort")}`);

  return (
    <div className="mt-2 overflow-hidden rounded-lg border border-border bg-card">
      {recipe.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={recipe.imageUrl}
          alt={recipe.title}
          className="h-40 w-full object-cover"
        />
      )}
      <div className="space-y-3 p-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{recipe.title}</h3>
          {recipe.description && (
            <p className="mt-1 text-xs text-muted-foreground">{recipe.description}</p>
          )}
          {meta.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">{meta.join(" · ")}</p>
          )}
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("ingredients")}
          </p>
          <ul className="list-disc space-y-0.5 pl-4 text-xs text-foreground">
            {recipe.ingredients.map((ing, idx) => (
              <li key={idx}>{formatIngredient(ing)}</li>
            ))}
          </ul>
        </div>

        {recipe.instructions.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("steps")}
            </p>
            <ol className="list-decimal space-y-0.5 pl-4 text-xs text-foreground">
              {recipe.instructions.map((step, idx) => (
                <li key={idx}>{step}</li>
              ))}
            </ol>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            onClick={onSave}
            className={cn(
              "rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground",
              "transition-opacity duration-150 hover:opacity-85"
            )}
          >
            {t("save")}
          </button>
          <button
            onClick={onCancel}
            className="rounded-md border-[1.5px] border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground transition-colors duration-150 hover:bg-muted"
          >
            {t("cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
