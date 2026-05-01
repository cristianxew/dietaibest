"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRecipeModal } from "@/hooks/use-recipe-modal";
import {
  FormField,
  FormItem,
  FormControl,
  FormMessage,
  Form,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const DIFFICULTIES = ["easy", "medium", "hard"] as const;

export function Step0Details() {
  const t = useTranslations("recipeModal");
  const { form, categories, goToNextStep } = useRecipeModal();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const control = form.control as any;

  const selectedCategories = form.watch("categoryIds") as string[];
  const selectedDifficulty = form.watch("difficulty");
  const imageUrl = form.watch("imageUrl") as string | undefined;

  const [imgError, setImgError] = useState(false);
  const hasValidImage = !!imageUrl?.trim() && !imgError;

  const toggleCategory = (id: string) => {
    const current = form.getValues("categoryIds") as string[];
    if (current.includes(id)) {
      form.setValue("categoryIds", current.filter((c) => c !== id));
    } else {
      form.setValue("categoryIds", [...current, id]);
    }
  };

  const toggleDifficulty = (val: "easy" | "medium" | "hard") => {
    form.setValue("difficulty", selectedDifficulty === val ? undefined : val);
  };

  return (
    <Form {...form as any}>
      <div className="flex-1 p-8 pb-0 animate-in fade-in-50 slide-in-from-bottom-2 duration-300">
        <div>
          <h2 className="font-display text-3xl font-semibold mb-2">
            {t("step0.title")}
          </h2>
          <p className="text-muted-foreground text-[15px] mb-6">
            {t("step0.subtitle")}
          </p>
        </div>

        {/* Recipe Name — standalone at top */}
        <div className="mb-4">
          <FormField
            control={control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  {t("step0.nameLabel")}
                </div>
                <FormControl>
                  <Input
                    {...field}
                    placeholder={t("step0.namePlaceholder")}
                    className="text-sm font-medium"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Photo preview + Image URL */}
        <div className="flex gap-3 mb-4">
          {/* Photo preview — shows image from URL or placeholder */}
          <div
            className={cn(
              "w-[76px] h-[76px] rounded-md bg-muted border-[1.5px] border-border flex flex-col items-center justify-center shrink-0 overflow-hidden transition-colors",
              hasValidImage
                ? "border-solid"
                : "border-dashed text-muted-foreground hover:border-primary hover:text-primary cursor-pointer"
            )}
          >
            {hasValidImage ? (
              <img
                src={imageUrl!.trim()}
                alt="Recipe preview"
                className="w-full h-full object-cover"
                onError={() => setImgError(true)}
              />
            ) : (
              <>
                <span className="text-xl mb-0.5">📷</span>
                <span className="text-[10px]">{t("step0.photo")}</span>
              </>
            )}
          </div>

          {/* Image URL input */}
          <div className="flex-1 flex items-center">
            <FormField
              control={control}
              name="imageUrl"
              render={({ field }) => (
                <FormItem className="w-full">
                  <div className="text-xs font-medium text-muted-foreground mb-1">
                    Image URL
                    <span className="text-muted-foreground/60 font-normal ml-1">
                      ({t("step0.descriptionOptional")})
                    </span>
                  </div>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="https://example.com/photo.jpg"
                      className="text-xs"
                      onChange={(e) => {
                        field.onChange(e);
                        setImgError(false);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        {/* Description */}
        <div className="mb-4">
          <div className="text-xs font-medium text-muted-foreground mb-1.5">
            {t("step0.descriptionLabel")}{" "}
            <span className="text-muted-foreground/60 font-normal">
              ({t("step0.descriptionOptional")})
            </span>
          </div>
          <FormField
            control={control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <Textarea
                    {...field}
                    rows={2}
                    className="resize-none text-sm"
                    placeholder="A short description of the recipe..."
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Categories */}
        {categories.length > 0 && (
          <div className="mb-4">
            <div className="text-xs font-medium text-muted-foreground mb-2">
              {t("step0.categoriesLabel")}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => toggleCategory(cat.id)}
                  className={cn(
                    "px-3 py-1 rounded-full border text-xs transition-colors cursor-pointer",
                    selectedCategories.includes(cat.id)
                      ? "bg-primary text-primary-foreground border-transparent"
                      : "border-border text-muted-foreground hover:border-muted-foreground"
                  )}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Times + Servings */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <FormField
            control={control}
            name="prepTime"
            render={({ field }) => (
              <FormItem>
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  {t("step0.prepLabel")}
                </div>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    placeholder="0"
                    {...field}
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(e.target.value ? parseInt(e.target.value) : undefined)
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="cookTime"
            render={({ field }) => (
              <FormItem>
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  {t("step0.cookLabel")}
                </div>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    placeholder="0"
                    {...field}
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(e.target.value ? parseInt(e.target.value) : undefined)
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="servings"
            render={({ field }) => (
              <FormItem>
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  {t("step0.servingsLabel")}
                </div>
                <FormControl>
                  <Input
                    type="number"
                    min={1}
                    placeholder="1"
                    {...field}
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

        {/* Difficulty */}
        <div className="mb-6">
          <div className="text-xs font-medium text-muted-foreground mb-2">
            {t("step0.difficultyLabel")}
          </div>
          <div className="flex gap-2">
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => toggleDifficulty(d)}
                className={cn(
                  "flex-1 py-2 rounded-md border text-xs font-medium transition-colors",
                  selectedDifficulty === d
                    ? "bg-primary text-primary-foreground border-transparent"
                    : "border-border text-muted-foreground hover:border-muted-foreground"
                )}
              >
                {t(`step0.${d}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Sticky footer */}
      <div className="sticky bottom-0 mt-auto bg-card border-t border-border p-6 flex justify-end">
        <button
          type="button"
          onClick={goToNextStep}
          className="bg-primary text-primary-foreground rounded-md px-6 py-2.5 text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          {t("step0.next")} →
        </button>
      </div>
    </Form>
  );
}
