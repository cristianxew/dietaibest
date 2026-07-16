'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Icon } from './icons';
import { RecipeThumb, MacroBar, Chip } from './shared';
import { cn } from '@/lib/utils';
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card';
import { Badge } from '@/components/ui/badge';
import type { TemplateWithMealsAndSchedules } from '@/lib/meal-plan-adapter';
import type { MealDisplay, MealType, MacroSummary, MacroTarget, MealPlanTemplateDisplay } from '@/types/meal-plan';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { Recipe, RecipeCategory } from '@/generated/prisma';
import { getRecipes, getCategories } from '@/actions/recipe';
import { toast } from 'sonner';
import { MEAL_SLOT_META } from '@/lib/meal-slot-meta';
import { compareMacro, getMacroStatusColor } from '@/lib/meal-plan-macros';
import { RecipeSidebarSkeleton } from './MealPlannerSkeletons';
import { MicronutrientPanel } from './MicronutrientPanel';
import type { ReferenceIntakes } from '@/lib/nutrition-rda';

/* ── PlanSwitcher ──────────────────────────────── */
interface PlanSwitcherProps {
  templates: TemplateWithMealsAndSchedules[];
  activeId: string | null;
  onPick: (id: string) => void;
  onCreate: () => void;
}

export function PlanSwitcher({ templates, activeId, onPick, onCreate }: PlanSwitcherProps) {
  const t = useTranslations('mealPlans');
  const params = useParams();
  const locale = params.locale as string;

  const copyShareLink = (token: string) => {
    navigator.clipboard.writeText(
      `${window.location.origin}/${locale}/share/meal-plan/${token}`
    );
    toast.success(t('shareLinkCopied'));
  };

  return (
    <div className="flex flex-wrap gap-2.5 items-stretch">
      {templates.map(template => {
        const isActive = template.id === activeId;
        return (
          <button
            key={template.id}
            onClick={() => onPick(template.id)}
            className={cn(
              'min-w-[200px] px-4 py-3.5 text-left rounded-xl cursor-pointer relative transition-all duration-200 ease-in-out',
              isActive
                ? 'bg-muted border border-brand-500 shadow-[0_12px_20px_-8px_rgba(224,122,95,0.35),0_4px_12px_-2px_rgba(0,0,0,0.12),0_0_0_4px_rgba(224,122,95,0.1)]'
                : 'bg-card border border-border shadow-none'
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <div
                className={cn(
                  'font-display text-base font-semibold tracking-tight',
                  isActive ? 'text-brand-500' : 'text-foreground'
                )}
              >
                {template.name}
              </div>
              {isActive && (
                <div className="w-[18px] h-[18px] rounded-full bg-brand-500 flex items-center justify-center flex-shrink-0 text-[#1C1A17]">
                  <Icon name="Check" size={11} />
                </div>
              )}
            </div>
            <div className="flex gap-3.5 text-[11px] text-muted-foreground mb-2">
              <span className="flex items-center gap-1">
                <Icon name="Clock" size={11} />{template.duration}d
              </span>
              <span className="flex items-center gap-1">
                <Icon name="Utensils" size={11} />{template.mealSlots.length}{t('perDay')}
              </span>
              <span className="flex items-center gap-1 text-brand-500">
                <Icon name="Flame" size={11} />{template.targetCalories ?? 0} kcal
              </span>
            </div>
            {template.isPublic && (
              <span className="flex items-center gap-1.5">
                <Chip color="gold" size="xs">{t('public')}</Chip>
                {template.shareToken && (
                  <span
                    role="button"
                    tabIndex={0}
                    title={t('copyShareLink')}
                    className="inline-flex items-center justify-center w-5 h-5 rounded-md text-muted-foreground hover:text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyShareLink(template.shareToken!);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        copyShareLink(template.shareToken!);
                      }
                    }}
                  >
                    <Icon name="Link2" size={12} />
                  </span>
                )}
              </span>
            )}
          </button>
        );
      })}
      <button
        onClick={onCreate}
        className={cn(
          'min-w-[140px] px-4 py-3.5',
          'flex flex-col items-center justify-center gap-1.5',
          'bg-transparent border-[1.5px] border-dashed border-border rounded-xl cursor-pointer',
          'text-muted-foreground transition-all duration-150',
          'hover:border-brand-500 hover:text-brand-500'
        )}
      >
        <Icon name="Plus" size={18} />
        <span className="text-xs font-semibold">{t('createPlan')}</span>
      </button>
    </div>
  );
}

/* ── RecipeLibrary ─────────────────────────────── */
interface RecipeLibraryProps {
  dense?: boolean;
  searchQuery?: string;
  selectedCategory?: string;
}

type RecipeWithCategories = Recipe & { categories: RecipeCategory[] };

const difficultyBadgeClass: Record<string, string> = {
  easy: 'border-sage-300 text-sage-600 dark:border-sage-700 dark:text-sage-400',
  medium: 'border-gold-300 text-gold-600 dark:border-gold-700 dark:text-gold-400',
  hard: 'border-brand-300 text-brand-600 dark:border-brand-700 dark:text-brand-400',
};

function DraggableRecipeRow({ recipe, dense }: { recipe: RecipeWithCategories; dense: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `library-${recipe.id}`,
    data: {
      type: 'recipe',
      recipe,
      recipeId: recipe.id,
    },
  });

  const t = useTranslations('recipes');
  const tPlanner = useTranslations('mealPlans');
  const params = useParams();
  const locale = (params?.locale as string) || 'en';

  // Hide source in place while dragging — MealPlanner's DragOverlay renders the
  // floating preview outside overflow-y-auto so it's never clipped.
  const style: React.CSSProperties = {
    opacity: isDragging ? 0 : 1,
    transition: isDragging ? undefined : "opacity 150ms",
  };

  let ingredientsList: any[] = [];
  if (recipe.ingredients) {
    if (Array.isArray(recipe.ingredients)) {
      ingredientsList = recipe.ingredients;
    } else if (typeof recipe.ingredients === 'string') {
      try {
        ingredientsList = JSON.parse(recipe.ingredients);
      } catch {
        ingredientsList = [];
      }
    }
  }

  const totalTime = (recipe.prepTime || 0) + (recipe.cookTime || 0);

  return (
    <HoverCard openDelay={300} closeDelay={150} open={isDragging ? false : undefined}>
      <HoverCardTrigger asChild>
        <div
          ref={setNodeRef}
          style={style}
          {...attributes}
          {...listeners}
          className={cn(
            'flex gap-2.5 rounded-[10px] border border-border bg-card cursor-grab transition-all duration-150',
            'hover:border-brand-500 hover:-translate-y-px',
            dense ? 'p-2' : 'p-2.5',
          )}
        >
          <RecipeThumb recipe={recipe} size={dense ? 40 : 48} radius={8} />
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-foreground overflow-hidden text-ellipsis whitespace-nowrap leading-[1.3]">
              {recipe.title}
            </div>
            <div className="flex gap-1.5 mt-[5px] flex-wrap items-center">
              {recipe.calories != null && (
                <Chip color="coral" size="xs">{Math.round(recipe.calories)} kcal</Chip>
              )}
              {recipe.protein != null && (
                <Chip color="sage" size="xs">{Math.round(recipe.protein)}g P</Chip>
              )}
              {recipe.prepTime != null && (
                <span className="text-[10px] text-muted-foreground flex items-center gap-[3px]">
                  <Icon name="Clock" size={10} />{recipe.prepTime}m
                </span>
              )}
            </div>
          </div>
        </div>
      </HoverCardTrigger>
      <HoverCardContent
        side="right"
        align="start"
        sideOffset={12}
        className="w-[320px] p-4 bg-popover border border-border shadow-xl rounded-xl z-50 space-y-3 before:absolute before:inset-y-0 before:-left-3 before:w-3 before:content-['']"
      >
        {/* Header with Title and Category badge */}
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            {recipe.categories?.slice(0, 2).map((cat) => (
              <Badge key={cat.id} className="badge-brand text-[9px] uppercase tracking-wider font-bold px-2 py-0.5">
                {cat.name}
              </Badge>
            ))}
            {recipe.difficulty && (
              <Badge
                variant="outline"
                className={cn("text-[9px] font-semibold px-2 py-0.5", difficultyBadgeClass[recipe.difficulty])}
              >
                {t(`difficulty.${recipe.difficulty}`, { fallback: recipe.difficulty })}
              </Badge>
            )}
          </div>
          <h4 className="font-display font-semibold text-sm text-foreground leading-tight">
            {recipe.title}
          </h4>
        </div>

        {/* Cover Image or placeholder */}
        {recipe.imageUrl ? (
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg border border-border/40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={recipe.imageUrl}
              alt={recipe.title}
              className="object-cover w-full h-full"
            />
          </div>
        ) : (
          <div className="aspect-[16/9] w-full rounded-lg bg-brand-50/40 dark:bg-brand-900/10 border border-border/40 flex flex-col items-center justify-center relative overflow-hidden">
            <Icon name="ChefHat" size={24} className="text-brand-500/60" />
          </div>
        )}

        {/* Description */}
        {recipe.description && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
            {recipe.description}
          </p>
        )}

        {/* Stats line */}
        <div className="flex gap-3 text-[10px] text-muted-foreground">
          {recipe.prepTime != null && (
            <span className="flex items-center gap-1">
              <Icon name="Clock" size={11} /> {recipe.prepTime}m {t('prepTime', { fallback: 'prep' }).toLowerCase()}
            </span>
          )}
          {recipe.cookTime != null && (
            <span className="flex items-center gap-1">
              <Icon name="Flame" size={11} /> {recipe.cookTime}m {t('cookTime', { fallback: 'cook' }).toLowerCase()}
            </span>
          )}
          <span>
            <Icon name="Utensils" size={11} className="inline mr-1" />
            {recipe.servings} {tPlanner('servingsAbbrev', { fallback: 'serv.' })}
          </span>
        </div>

        {/* Macros */}
        <div className="flex gap-1.5 flex-wrap items-center pt-0.5">
          {recipe.calories != null && (
            <Chip color="coral" size="xs">{Math.round(recipe.calories)} kcal</Chip>
          )}
          {recipe.protein != null && (
            <Chip color="sage" size="xs">{Math.round(recipe.protein)}g P</Chip>
          )}
          {recipe.carbs != null && (
            <Chip color="gold" size="xs">{Math.round(recipe.carbs)}g C</Chip>
          )}
          {recipe.fat != null && (
            <Chip color="sage" size="xs">{Math.round(recipe.fat)}g F</Chip>
          )}
        </div>

        {/* Ingredients preview */}
        {ingredientsList.length > 0 && (
          <div className="space-y-1 pt-1 border-t border-border/40">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {t('ingredients', { fallback: 'Ingredients' })}
            </div>
            <div className="grid grid-cols-1 gap-1">
              {ingredientsList.slice(0, 4).map((ing, idx) => (
                <div key={idx} className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-brand-500 flex-shrink-0" />
                  <span className="truncate">
                    {ing.amount} {ing.unit} {ing.name}
                  </span>
                </div>
              ))}
              {ingredientsList.length > 4 && (
                <div className="text-[10px] font-semibold text-brand-600 dark:text-brand-400 pl-2">
                  {t('moreIngredients', { count: ingredientsList.length - 4, fallback: `+ ${ingredientsList.length - 4} more` })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* View full recipe link */}
        <div className="pt-2 border-t border-border/40 flex justify-end">
          <Link
            href={`/${locale}/recipes/${recipe.id}`}
            className="text-xs font-semibold text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors inline-flex items-center gap-1"
          >
            <span>{t('viewFullRecipe', { fallback: 'View full recipe' })}</span>
            <Icon name="ArrowUpRight" size={13} />
          </Link>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

export function RecipeLibrary({ dense = false, searchQuery = '', selectedCategory = 'all' }: RecipeLibraryProps) {
  const t = useTranslations('mealPlans');
  const [recipes, setRecipes] = useState<RecipeWithCategories[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const recipesResult = await getRecipes({ page: 1, limit: 50 });

      if (recipesResult.error) {
        toast.error(recipesResult.error);
      } else if (recipesResult.data) {
        setRecipes(recipesResult.data.recipes as RecipeWithCategories[]);
      }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = recipes.filter(r => {
    const matchesCat =
      selectedCategory === 'all' || r.categories.some(c => c.name === selectedCategory);
    const matchesQ = !searchQuery || r.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesQ;
  });

  return (
    <div className="flex flex-col gap-2.5 h-full">
      {/* Count */}
      <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 pb-1">
        <Icon name="UtensilsCrossed" size={12} />{t('recipesFound', { count: filtered.length })}
      </div>

      {/* Recipe rows */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
        {loading ? (
          <RecipeSidebarSkeleton dense={dense} />
        ) : filtered.length === 0 ? (
          <div className="text-[12px] text-muted-foreground py-6 text-center">
            {t('noRecipesFound')}
          </div>
        ) : (
          filtered.map(r => (
            <DraggableRecipeRow key={r.id} recipe={r} dense={dense} />
          ))
        )}
      </div>
    </div>
  );
}

/* ── MealCell ──────────────────────────────────── */
interface MealCellProps {
  meal?: MealDisplay;
  dayId: string;
  mealType: MealType;
  onRemove: (mealId: string) => void;
  onServingsChange: (mealId: string, servings: number) => void;
  onSlotSelect?: (dayId: string, mealType: MealType) => void;
  dense?: boolean;
  compact?: boolean;
  showServings?: boolean;
  onViewRecipeDetail?: (id: string) => void;
}

export function MealCell({
  meal,
  dayId,
  mealType,
  onRemove,
  onServingsChange,
  onSlotSelect,
  dense = false,
  compact = false,
  showServings = false,
  onViewRecipeDetail,
}: MealCellProps) {
  const t = useTranslations('mealPlans');
  // Drop target: always active regardless of filled/empty
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `${dayId}:${mealType}`,
    data: { dayId, mealType },
  });

  // Drag source: only active when a meal exists
  const {
    attributes: dragAttributes,
    listeners: dragListeners,
    setNodeRef: setDragRef,
    isDragging,
  } = useDraggable({
    id: meal ? `meal-${meal.id}` : `empty-${dayId}-${mealType}`,
    data: {
      type: 'meal',
      meal,
      sourceDayId: dayId,
      sourceMealType: mealType,
    },
    disabled: !meal,
  });

  // Compose droppable + draggable refs onto the same element
  const setNodeRef = (node: HTMLElement | null) => {
    setDropRef(node);
    setDragRef(node);
  };

  // Hide source while dragging — DragOverlay in MealPlanner handles the floating preview.
  const dragStyle: React.CSSProperties = isDragging ? { opacity: 0 } : {};

  // Empty slot.
  // Mobile (onSlotSelect provided): a tappable button that opens the recipe
  // picker — the touch add path, since the drag library is hidden.
  // Desktop (no onSlotSelect): the original drop-target div, unchanged.
  if (!meal) {
    if (onSlotSelect) {
      return (
        <button
          ref={setDropRef}
          type="button"
          onClick={() => onSlotSelect(dayId, mealType)}
          aria-label={t('tapToAdd')}
          className={cn(
            'w-full flex flex-col items-center justify-center gap-1.5 rounded-[10px] border-[1.5px] border-dashed transition-all duration-150 cursor-pointer text-center',
            compact ? 'p-2.5 min-h-[64px]' : dense ? 'p-2.5 min-h-[72px]' : 'p-3.5 min-h-[88px]',
            isOver
              ? 'border-brand-500 bg-brand-500/5 text-brand-500'
              : 'border-border bg-card/50 text-muted-foreground hover:border-brand-300 dark:hover:border-brand-500/50',
          )}
        >
          <Icon name={isOver ? 'Sparkles' : 'Plus'} size={14} className={isOver ? 'text-brand-500' : 'text-muted-foreground/50'} />
          <div className={cn('text-[11px] font-medium', isOver ? 'text-brand-500' : 'text-muted-foreground/60')}>
            {isOver ? t('dropMealHere') : t('tapToAdd')}
          </div>
        </button>
      );
    }

    return (
      <div
        ref={setDropRef}
        className={cn(
          'flex flex-col items-center justify-center gap-1.5 rounded-[10px] border-[1.5px] border-dashed transition-all duration-150 cursor-pointer text-center',
          compact ? 'p-2.5 min-h-[64px]' : dense ? 'p-2.5 min-h-[72px]' : 'p-3.5 min-h-[88px]',
          isOver
            ? 'border-brand-500 bg-brand-500/5 text-brand-500'
            : 'border-border bg-card/50 text-muted-foreground',
        )}
      >
        <Icon name="Sparkles" size={14} className={isOver ? 'text-brand-500' : 'text-muted-foreground/50'} />
        <div className={cn('text-[11px] font-medium', isOver ? 'text-brand-500' : 'text-muted-foreground/60')}>
          {isOver ? t('dropMealHere') : t('dragOrSuggest')}
        </div>
      </div>
    );
  }

  // Filled slot: draggable + droppable card
  return (
    <div
      ref={setNodeRef}
      style={dragStyle}
      className={cn(
        'group relative rounded-[10px] border transition-all duration-150 overflow-hidden',
        compact ? 'p-2' : 'p-2.5',
        isOver ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-border bg-card',
        isDragging ? 'cursor-grabbing' : 'cursor-grab',
      )}
    >
      {/* Clear button — hover-revealed, outside drag listeners */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onRemove(meal.id); }}
        className={cn(
          'absolute top-1 right-1 z-10 w-5 h-5 rounded-full',
          'bg-black/50 flex items-center justify-center',
          // Always visible on touch; hover-revealed on pointer devices.
          'opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-150',
          'cursor-pointer border-none',
        )}
        aria-label={t('slot.removeMeal')}
      >
        <Icon name="X" size={11} className="text-white" />
      </button>

      {/* View Details button — hover-revealed, outside drag listeners */}
      {meal.recipeId && onViewRecipeDetail && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onViewRecipeDetail(meal.recipeId!); }}
          className={cn(
            'absolute top-1 right-7 z-10 w-5 h-5 rounded-full',
            'bg-black/50 flex items-center justify-center',
            'opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-150',
            'cursor-pointer border-none',
          )}
          aria-label={t('slot.viewRecipe')}
        >
          <Icon name="Eye" size={11} className="text-white" />
        </button>
      )}

      {compact ? (
        /* Compact layout: horizontal row */
        <div className="flex items-center gap-2">
          {/* Drag area: thumb + name */}
          <div
            className="flex items-center gap-2 flex-1 min-w-0"
            {...dragAttributes}
            {...dragListeners}
          >
            <RecipeThumb
              recipe={{ title: meal.recipeName, imageUrl: meal.recipeImage ?? null }}
              size={32}
              radius={6}
            />
            <div className="flex-1 min-w-0">
              <div className="text-[11px] font-semibold text-foreground overflow-hidden text-ellipsis whitespace-nowrap leading-[1.25]">
                {meal.recipeName}
              </div>
              <div className="text-[10px] text-muted-foreground font-mono">{meal.calories} kcal</div>
            </div>
          </div>
          {/* Servings stepper */}
          {showServings && (
            <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onServingsChange(meal.id, Math.max(1, meal.servings - 1)); }}
                className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label={t('slot.decreaseServings')}
              >
                <Icon name="Minus" size={10} />
              </button>
              <span className="text-[11px] font-semibold text-foreground w-4 text-center tabular-nums">
                {meal.servings}
              </span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onServingsChange(meal.id, meal.servings + 1); }}
                className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label={t('slot.increaseServings')}
              >
                <Icon name="Plus" size={10} />
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Standard layout: vertical card */
        <>
          {/* Drag area: thumb + name */}
          <div
            {...dragAttributes}
            {...dragListeners}
            className="cursor-grab active:cursor-grabbing"
          >
            <RecipeThumb
              recipe={{ title: meal.recipeName, imageUrl: meal.recipeImage ?? null }}
              size={dense ? 40 : 48}
              radius={6}
            />
            <div
              className="mt-2 text-[12px] font-semibold text-foreground leading-[1.3] line-clamp-2"
            >
              {meal.recipeName}
            </div>
          </div>

          {/* Macro line */}
          <div className="flex gap-1.5 mt-1.5 flex-wrap items-center">
            <Chip color="coral" size="xs">{meal.calories} kcal</Chip>
            <Chip color="sage" size="xs">{meal.protein}g P</Chip>
          </div>

          {/* Servings stepper — outside drag listeners */}
          {showServings && (
            <div
              className="flex items-center gap-1 mt-2"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onServingsChange(meal.id, Math.max(1, meal.servings - 1)); }}
                className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label={t('slot.decreaseServings')}
              >
                <Icon name="Minus" size={10} />
              </button>
              <span className="text-[11px] font-semibold text-foreground w-5 text-center tabular-nums">
                {meal.servings}
              </span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onServingsChange(meal.id, meal.servings + 1); }}
                className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label={t('slot.increaseServings')}
              >
                <Icon name="Plus" size={10} />
              </button>
              <span className="text-[10px] text-muted-foreground ml-0.5">{t('servingsAbbrev')}</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── DayMacros ─────────────────────────────────── */
interface DayMacrosProps {
  macros: MacroSummary;
  targets?: MacroTarget;
  compact?: boolean;
}

export function DayMacros({ macros, targets, compact = false }: DayMacrosProps) {
  const t = useTranslations('mealPlans');
  const comparison = compareMacro(macros.calories, targets?.calories);
  const statusColor = getMacroStatusColor(comparison.status);
  const statusLabel =
    comparison.status === 'under' ? t('underTarget') :
      comparison.status === 'over' ? t('overTarget') :
        t('onTrack');

  return (
    <div className={cn('flex flex-col gap-1.5', !compact && 'min-w-[200px]')}>
      <div className="flex items-baseline gap-2">
        <div className={cn('font-mono font-medium text-foreground', compact ? 'text-sm' : 'text-[17px]')}>
          {Math.round(macros.calories)}
        </div>
        {targets?.calories != null && (
          <div className="text-[10px] text-muted-foreground">
            / {targets.calories} kcal
          </div>
        )}
        {!compact && comparison.status && (
          <div className={cn('inline-flex items-center text-[10px] font-semibold ml-auto px-1.5 py-0.5 rounded-full border', statusColor)}>
            {statusLabel}
          </div>
        )}
      </div>
      <MacroBar p={macros.protein} c={macros.carbs} f={macros.fat} height={5} />
      <div className="flex gap-2.5 text-[10px] text-muted-foreground font-mono">
        <span><span className="text-brand-500">●</span> {Math.round(macros.protein)}g P</span>
        <span><span className="text-gold-500">●</span> {Math.round(macros.carbs)}g C</span>
        <span><span className="text-sage-500">●</span> {Math.round(macros.fat)}g F</span>
      </div>
    </div>
  );
}

/* ── GridLayout ────────────────────────────────── */
interface GridLayoutProps {
  template: MealPlanTemplateDisplay;
  density: 'regular' | 'compact';
  onRemove: (mealId: string) => void;
  onServingsChange: (mealId: string, servings: number) => void;
  onSlotSelect?: (dayId: string, mealType: MealType) => void;
  showServings?: boolean;
  onViewRecipeDetail?: (id: string) => void;
}

export function GridLayout({ template, density, onRemove, onServingsChange, onSlotSelect, showServings = false, onViewRecipeDetail }: GridLayoutProps) {
  const t = useTranslations('mealPlans');
  const dense = density === 'compact';
  const numDays = template.days.length;
  const cellMin = dense ? 'minmax(110px, 1fr)' : 'minmax(132px, 1fr)';
  const gridCols = `72px repeat(${numDays}, ${cellMin})`;

  return (
    <div className="flex flex-col">
      {/* Day headers */}
      <div
        className="grid gap-2 mb-2.5 pb-1.5"
        style={{ gridTemplateColumns: gridCols }}
      >
        <div />
        {template.days.map(day => (
          <div key={day.id} className="text-center py-1.5 px-1">
            <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground">
              {t('calendar.dayPrefix')}
            </div>
            <div className="font-display text-lg font-semibold text-foreground">
              {day.dayNumber}
            </div>
          </div>
        ))}
      </div>

      {/* Meal rows */}
      {template.mealSlots.map(slot => {
        const meta = MEAL_SLOT_META[slot];
        return (
          <div
            key={slot}
            className="grid gap-2 mb-2.5"
            style={{ gridTemplateColumns: gridCols }}
          >
            {/* Row label */}
            <div className="flex flex-col items-start justify-center pt-1.5">
              <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center">
                <Icon name={meta.iconName} size={13} className={meta.colorClass} />
              </div>
              <div className="text-[11px] font-semibold text-muted-foreground mt-1.5 leading-tight">
                {t(meta.i18nKey)}
              </div>
            </div>
            {/* Cells */}
            {template.days.map(day => (
              <MealCell
                key={day.id}
                meal={day.meals.find(m => m.mealType === slot)}
                dayId={day.id}
                mealType={slot}
                onRemove={onRemove}
                onServingsChange={onServingsChange}
                onSlotSelect={onSlotSelect}
                dense={dense}
                showServings={showServings}
                onViewRecipeDetail={onViewRecipeDetail}
              />
            ))}
          </div>
        );
      })}

      {/* Macro footer */}
      <div
        className="grid gap-2 mt-2 pt-3.5 border-t border-border"
        style={{ gridTemplateColumns: gridCols }}
      >
        <div className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground self-center">
          {t('total')}
        </div>
        {template.days.map(day => (
          <div key={day.id} className="py-1 px-1.5">
            <DayMacros macros={day.macros} targets={template.targets} compact />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── StackLayout ───────────────────────────────── */
interface LayoutProps {
  template: MealPlanTemplateDisplay;
  density: 'regular' | 'compact';
  onRemove: (mealId: string) => void;
  onServingsChange: (mealId: string, servings: number) => void;
  onSlotSelect?: (dayId: string, mealType: MealType) => void;
  showServings?: boolean;
  reference: ReferenceIntakes;
  onViewRecipeDetail?: (id: string) => void;
}

export function StackLayout({ template, density, onRemove, onServingsChange, onSlotSelect, showServings = false, reference, onViewRecipeDetail }: LayoutProps) {
  const t = useTranslations('mealPlans');
  const dense = density === 'compact';

  return (
    <div className="flex flex-col gap-3.5">
      {template.days.map(day => {
        const numSlots = template.mealSlots.length;
        const colsClass = numSlots <= 2 ? 'grid-cols-2' : numSlots === 3 ? 'grid-cols-2 sm:grid-cols-3' : numSlots === 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5';
        return (
          <div key={day.id} className="bg-card border border-border rounded-[14px] p-3.5 sm:p-[18px]">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4 mb-3.5">
              <div className="flex items-baseline gap-3">
                <div className="font-display text-2xl font-semibold text-foreground tracking-tight">
                  {t('calendar.dayNumber', { number: day.dayNumber })}
                </div>
              </div>
              <DayMacros macros={day.macros} targets={template.targets} compact />
            </div>
            <div className={cn('grid gap-2.5', colsClass)}>
              {template.mealSlots.map(slot => {
                const meta = MEAL_SLOT_META[slot];
                return (
                  <div key={slot}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Icon name={meta.iconName} size={12} className={meta.colorClass} />
                      <span className={cn('text-[10px] font-bold tracking-[0.1em] uppercase', meta.colorClass)}>
                        {t(meta.i18nKey)}
                      </span>
                    </div>
                    <MealCell
                      meal={day.meals.find(m => m.mealType === slot)}
                      dayId={day.id}
                      mealType={slot}
                      onRemove={onRemove}
                      onServingsChange={onServingsChange}
                      onSlotSelect={onSlotSelect}
                      dense={dense}
                      showServings={showServings}
                      onViewRecipeDetail={onViewRecipeDetail}
                    />
                  </div>
                );
              })}
            </div>
            <MicronutrientPanel
              variant="day"
              micros={day.micros}
              reference={reference}
              className="mt-3.5"
            />
          </div>
        );
      })}
    </div>
  );
}

/* ── SplitLayout ───────────────────────────────── */
export function SplitLayout({ template, density, onRemove, onServingsChange, onSlotSelect, showServings = true, reference, onViewRecipeDetail }: LayoutProps) {
  const t = useTranslations('mealPlans');
  const [selIdx, setSelIdx] = useState(0);
  useEffect(() => { setSelIdx(0); }, [template.id]);
  const dense = density === 'compact';
  const selectedDay = template.days[selIdx] ?? template.days[0];
  const numSlots = template.mealSlots.length;
  const colsClass = numSlots <= 2 ? 'grid-cols-2' : numSlots === 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-4';

  return (
    <div className="grid gap-3 lg:gap-[18px] items-start grid-cols-1 lg:grid-cols-[200px_1fr]">
      {/* Day rail */}
      <div className="flex flex-row lg:flex-col gap-1.5 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 lg:sticky lg:top-[178px] z-10 scrollbar-thin">
        {template.days.map((day, i) => {
          const isActive = i === selIdx;
          const calTarget = template.targets?.calories ?? 2000;
          const pct = Math.min(1, day.macros.calories / calTarget);
          const barColor =
            pct < 0.85 ? 'bg-gold-500' : pct > 1.05 ? 'bg-brand-500' : 'bg-sage-500';
          return (
            <button
              key={day.id}
              type="button"
              onClick={() => setSelIdx(i)}
              className={cn(
                'flex-shrink-0 min-w-[130px] lg:min-w-0 lg:w-full text-left px-3 py-2.5 rounded-[10px] cursor-pointer transition-all duration-150',
                isActive
                  ? 'bg-muted shadow-[inset_0_0_0_1.5px_theme(colors.brand.500)]'
                  : 'bg-transparent shadow-[inset_0_0_0_1px_theme(colors.border)]',
              )}
            >
              <div className="flex items-baseline justify-between mb-1.5">
                <div className="font-display text-[18px] font-semibold text-foreground">
                  {t('calendar.dayNumber', { number: day.dayNumber })}
                </div>
              </div>
              <div className="text-[10px] text-muted-foreground font-mono mb-1.5">
                {Math.round(day.macros.calories)} kcal
              </div>
              <div className="h-[3px] bg-muted rounded-full overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', barColor)}
                  style={{ width: `${pct * 100}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>

      {/* Day editor */}
      {selectedDay && (
        <div className="bg-card border border-border rounded-[14px] p-4 sm:p-6 min-w-0">
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="text-[11px] font-bold tracking-[0.12em] uppercase text-brand-500 mb-1">
                {template.name}
              </div>
              <div className="font-display text-2xl sm:text-[30px] font-semibold text-foreground tracking-tight">
                {t('calendar.dayNumber', { number: selectedDay.dayNumber })}
              </div>
            </div>
          </div>
          <div className="mb-5">
            <DayMacros macros={selectedDay.macros} targets={template.targets} />
          </div>
          <div className={cn('grid gap-3', colsClass)}>
            {template.mealSlots.map(slot => {
              const meta = MEAL_SLOT_META[slot];
              return (
                <div key={slot}>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Icon name={meta.iconName} size={13} className={meta.colorClass} />
                    <span className={cn('text-[11px] font-bold tracking-[0.1em] uppercase', meta.colorClass)}>
                      {t(meta.i18nKey)}
                    </span>
                  </div>
                  <MealCell
                    meal={selectedDay.meals.find(m => m.mealType === slot)}
                    dayId={selectedDay.id}
                    mealType={slot}
                    onRemove={onRemove}
                    onServingsChange={onServingsChange}
                    onSlotSelect={onSlotSelect}
                    dense={dense}
                    showServings={showServings}
                    onViewRecipeDetail={onViewRecipeDetail}
                  />
                </div>
              );
            })}
          </div>
          <MicronutrientPanel
            variant="day"
            micros={selectedDay.micros}
            reference={reference}
            className="mt-5"
          />
        </div>
      )}
    </div>
  );
}
