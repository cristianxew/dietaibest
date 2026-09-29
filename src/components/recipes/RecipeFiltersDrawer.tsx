"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { LayoutGrid, List, SlidersHorizontal } from "lucide-react";
import { RecipeCategory } from "@/generated/prisma";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export const ITEMS_PER_PAGE_OPTIONS = [8, 12, 24, 48] as const;

interface RecipeFiltersDrawerProps {
  categories: RecipeCategory[];
  getCategoryLabel: (category: RecipeCategory) => string;
  selectedCategory: string;
  onCategoryChange: (categoryId: string) => void;
  selectedDifficulty: string;
  onDifficultyChange: (difficulty: string) => void;
  viewMode: "grid" | "list";
  onViewModeChange: (viewMode: "grid" | "list") => void;
  itemsPerPage: number;
  onItemsPerPageChange: (itemsPerPage: number) => void;
  onClear: () => void;
  totalCount: number;
  className?: string;
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border text-[13px] font-medium transition-colors",
        active
          ? "bg-brand-500 border-brand-500 text-white shadow-sm"
          : "bg-card border-border/70 text-foreground/80 hover:border-brand-300 hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

function FilterSection({
  title,
  className,
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={className}>
      <h3 className="mb-2.5 font-sans text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  );
}

/**
 * Mobile/tablet filter trigger + bottom drawer for the recipes library.
 * Replaces the inline category/difficulty selects below `lg`, so the sticky
 * toolbar stays a single compact row on small screens. Filters apply live;
 * the primary footer button just closes the drawer.
 */
export function RecipeFiltersDrawer({
  categories,
  getCategoryLabel,
  selectedCategory,
  onCategoryChange,
  selectedDifficulty,
  onDifficultyChange,
  viewMode,
  onViewModeChange,
  itemsPerPage,
  onItemsPerPageChange,
  onClear,
  totalCount,
  className,
}: RecipeFiltersDrawerProps) {
  const t = useTranslations("recipes");
  const [open, setOpen] = useState(false);

  const activeCount =
    (selectedCategory !== "all" ? 1 : 0) +
    (selectedDifficulty !== "all" ? 1 : 0);

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <button
          type="button"
          aria-label={t("filters.title")}
          className={cn(
            "relative inline-flex items-center justify-center gap-2 h-11 min-w-11 shrink-0 px-3 sm:px-4 rounded-xl border text-[13px] font-medium shadow-sm transition-colors",
            activeCount > 0
              ? "border-brand-300 bg-brand-50 text-brand-600 dark:border-brand-500/50 dark:bg-brand-500/10 dark:text-brand-400"
              : "border-border/60 bg-background text-foreground/80 hover:border-brand-300",
            className
          )}
        >
          <SlidersHorizontal className="h-4 w-4" />
          <span className="hidden sm:inline">{t("filters.title")}</span>
          {activeCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 px-1 text-[10px] font-bold text-white ring-2 ring-background">
              {activeCount}
            </span>
          )}
        </button>
      </DrawerTrigger>

      <DrawerContent className="data-[vaul-drawer-direction=bottom]:max-h-[85dvh] data-[vaul-drawer-direction=bottom]:rounded-t-2xl">
        <div className="mx-auto flex w-full max-w-lg min-h-0 flex-1 flex-col">
          <DrawerHeader className="pb-2 text-left">
            <DrawerTitle className="font-display text-lg">
              {t("filters.title")}
            </DrawerTitle>
            <DrawerDescription>{t("filters.description")}</DrawerDescription>
          </DrawerHeader>

          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-2 space-y-6">
            <FilterSection title={t("filters.category")}>
              <FilterChip
                active={selectedCategory === "all"}
                onClick={() => onCategoryChange("all")}
              >
                {t("all")}
              </FilterChip>
              {categories.map((category) => (
                <FilterChip
                  key={category.id}
                  active={selectedCategory === category.id}
                  onClick={() => onCategoryChange(category.id)}
                >
                  {getCategoryLabel(category)}
                </FilterChip>
              ))}
            </FilterSection>

            <FilterSection title={t("filters.difficulty")}>
              <FilterChip
                active={selectedDifficulty === "all"}
                onClick={() => onDifficultyChange("all")}
              >
                {t("all")}
              </FilterChip>
              {DIFFICULTIES.map((difficulty) => (
                <FilterChip
                  key={difficulty}
                  active={selectedDifficulty === difficulty}
                  onClick={() => onDifficultyChange(difficulty)}
                >
                  {t(`difficulty.${difficulty}`)}
                </FilterChip>
              ))}
            </FilterSection>

            {/* The toolbar shows the view switcher from `sm` up */}
            <FilterSection title={t("filters.view")} className="sm:hidden">
              <FilterChip
                active={viewMode === "grid"}
                onClick={() => onViewModeChange("grid")}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                {t("gridView")}
              </FilterChip>
              <FilterChip
                active={viewMode === "list"}
                onClick={() => onViewModeChange("list")}
              >
                <List className="h-3.5 w-3.5" />
                {t("listView")}
              </FilterChip>
            </FilterSection>

            <FilterSection title={t("filters.perPage")}>
              {ITEMS_PER_PAGE_OPTIONS.map((option) => (
                <FilterChip
                  key={option}
                  active={itemsPerPage === option}
                  onClick={() => onItemsPerPageChange(option)}
                >
                  <span className="min-w-4 text-center tabular-nums">{option}</span>
                </FilterChip>
              ))}
            </FilterSection>
          </div>

          <DrawerFooter className="flex-row gap-3 border-t border-border/60 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button
              variant="outline"
              className="h-11 flex-1"
              onClick={onClear}
              disabled={activeCount === 0}
            >
              {t("filters.clear")}
            </Button>
            <DrawerClose asChild>
              <Button className="h-11 flex-1 bg-brand-500 hover:bg-brand-600 text-white">
                {t("filters.showResults", { count: totalCount })}
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
