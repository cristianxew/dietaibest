'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from './icons';
import { RecipeThumb, MacroBar, Chip } from './shared';
import { cn } from '@/lib/utils';
import type { TemplateWithMealsAndSchedules } from '@/lib/meal-plan-adapter';
import type { MealDisplay, MealType, MacroSummary, MacroTarget, MealPlanTemplateDisplay } from '@/types/meal-plan';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import type { Recipe, RecipeCategory } from '@/generated/prisma';
import { getRecipes, getCategories } from '@/actions/recipe';
import { toast } from 'sonner';
import { MEAL_SLOT_META } from '@/lib/meal-slot-meta';
import { compareMacro, getMacroStatusColor } from '@/lib/meal-plan-macros';
import { RecipeSidebarSkeleton } from './MealPlannerSkeletons';

/* ── PlanSwitcher ──────────────────────────────── */
interface PlanSwitcherProps {
  templates: TemplateWithMealsAndSchedules[];
  activeId: string | null;
  onPick: (id: string) => void;
  onCreate: () => void;
}

export function PlanSwitcher({ templates, activeId, onPick, onCreate }: PlanSwitcherProps) {
  const t = useTranslations('mealPlans');
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
            {template.isPublic && <Chip color="gold" size="xs">{t('public')}</Chip>}
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

function DraggableRecipeRow({ recipe, dense }: { recipe: Recipe; dense: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `library-${recipe.id}`,
    data: {
      type: 'recipe',
      recipe,
      recipeId: recipe.id,
    },
  });

  // Hide source in place while dragging — MealPlanner's DragOverlay renders the
  // floating preview outside overflow-y-auto so it's never clipped.
  const style: React.CSSProperties = {
    opacity: isDragging ? 0 : 1,
    transition: isDragging ? undefined : "opacity 150ms",
  };

  return (
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
  );
}

type RecipeWithCategories = Recipe & { categories: RecipeCategory[] };

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
  dense?: boolean;
  compact?: boolean;
  showServings?: boolean;
}

export function MealCell({
  meal,
  dayId,
  mealType,
  onRemove,
  onServingsChange,
  dense = false,
  compact = false,
  showServings = false,
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

  // Empty slot
  if (!meal) {
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
          'opacity-0 group-hover:opacity-100 transition-opacity duration-150',
          'cursor-pointer border-none',
        )}
        aria-label={t('slot.removeMeal')}
      >
        <Icon name="X" size={11} className="text-white" />
      </button>

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
  showServings?: boolean;
}

export function GridLayout({ template, density, onRemove, onServingsChange, showServings = false }: GridLayoutProps) {
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
                dense={dense}
                showServings={showServings}
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
  showServings?: boolean;
}

export function StackLayout({ template, density, onRemove, onServingsChange, showServings = false }: LayoutProps) {
  const t = useTranslations('mealPlans');
  const dense = density === 'compact';

  return (
    <div className="flex flex-col gap-3.5">
      {template.days.map(day => {
        const numSlots = template.mealSlots.length;
        const colsClass = numSlots <= 2 ? 'grid-cols-2' : numSlots === 3 ? 'grid-cols-3' : numSlots === 4 ? 'grid-cols-4' : 'grid-cols-5';
        return (
          <div key={day.id} className="bg-card border border-border rounded-[14px] p-[18px]">
            <div className="flex items-start justify-between mb-3.5 gap-4">
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
                      dense={dense}
                      showServings={showServings}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── SplitLayout ───────────────────────────────── */
export function SplitLayout({ template, density, onRemove, onServingsChange, showServings = true }: LayoutProps) {
  const t = useTranslations('mealPlans');
  const [selIdx, setSelIdx] = useState(0);
  useEffect(() => { setSelIdx(0); }, [template.id]);
  const dense = density === 'compact';
  const selectedDay = template.days[selIdx] ?? template.days[0];
  const numSlots = template.mealSlots.length;
  const colsClass = numSlots <= 2 ? 'grid-cols-2' : numSlots === 3 ? 'grid-cols-3' : 'grid-cols-4';

  return (
    <div className="grid gap-[18px] items-start" style={{ gridTemplateColumns: '200px 1fr' }}>
      {/* Day rail */}
      <div className="flex flex-col gap-1.5 sticky top-[290px] md:top-[178px] z-10">
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
                'w-full text-left px-3 py-2.5 rounded-[10px] cursor-pointer transition-all duration-150',
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
        <div className="bg-card border border-border rounded-[14px] p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="text-[11px] font-bold tracking-[0.12em] uppercase text-brand-500 mb-1">
                {template.name}
              </div>
              <div className="font-display text-[30px] font-semibold text-foreground tracking-tight">
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
                    dense={dense}
                    showServings={showServings}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
