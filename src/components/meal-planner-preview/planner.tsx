'use client';

import React, { useState, useEffect } from 'react';
import type { Plan, SlotDef } from './types';
import type { DensityType } from './types';
import { RX, DAY_NAMES_ES, MONTH_NAMES_ES, SLOT_DEFS, TARGETS, dayTotals, slotsForPlan } from './data';
import { Icon } from './icons';
import { RecipeThumb, MacroBar, Chip } from './shared';
import { cn } from '@/lib/utils';
import type { TemplateWithMealsAndSchedules } from '@/lib/meal-plan-adapter';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import type { Recipe, RecipeCategory } from '@/generated/prisma';
import { getRecipes, getCategories } from '@/actions/recipe';
import { toast } from 'sonner';

/* ── PlanSwitcher ──────────────────────────────── */
interface PlanSwitcherProps {
  templates: TemplateWithMealsAndSchedules[];
  activeId: string | null;
  onPick: (id: string) => void;
  onCreate: () => void;
}

export function PlanSwitcher({ templates, activeId, onPick, onCreate }: PlanSwitcherProps) {
  return (
    <div className="flex flex-wrap gap-2.5 items-stretch">
      {templates.map(template => {
        const isActive = template.id === activeId;
        return (
          <button
            key={template.id}
            onClick={() => onPick(template.id)}
            className={cn(
              'min-w-[200px] px-4 py-3.5 text-left rounded-xl cursor-pointer relative transition-all duration-200',
              isActive
                ? 'bg-muted border-[1.5px] border-brand-500 shadow-[0_0_0_4px_theme(colors.brand.500/10)]'
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
                <Icon name="Utensils" size={11} />{template.mealSlots.length}/día
              </span>
              <span className="flex items-center gap-1 text-brand-500">
                <Icon name="Flame" size={11} />{template.targetCalories ?? 0} kcal
              </span>
            </div>
            {template.isPublic && <Chip color="gold" size="xs">Público</Chip>}
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
        <span className="text-xs font-semibold">Nuevo plan</span>
      </button>
    </div>
  );
}

/* ── RecipeLibrary ─────────────────────────────── */
interface RecipeLibraryProps {
  dense?: boolean;
}

function DraggableRecipeRow({ recipe, dense }: { recipe: Recipe; dense: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `library-${recipe.id}`,
    data: {
      type: 'recipe',
      recipe,
      recipeId: recipe.id,
    },
  });

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
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

export function RecipeLibrary({ dense = false }: RecipeLibraryProps) {
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('Todas');
  const [recipes, setRecipes] = useState<RecipeWithCategories[]>([]);
  const [categories, setCategories] = useState<RecipeCategory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [recipesResult, catsResult] = await Promise.all([
        getRecipes({ page: 1, limit: 50 }),
        getCategories(),
      ]);
      if (recipesResult.error) {
        toast.error(recipesResult.error);
      } else if (recipesResult.data) {
        setRecipes(recipesResult.data.recipes as RecipeWithCategories[]);
      }
      if (catsResult.error) {
        toast.error(catsResult.error);
      } else if (catsResult.data) {
        setCategories(catsResult.data);
      }
      setLoading(false);
    }
    load();
  }, []);

  const cats = ['Todas', ...categories.map(c => c.name)];

  const filtered = recipes.filter(r => {
    const matchesCat =
      cat === 'Todas' || r.categories.some(c => c.name === cat);
    const matchesQ = !q || r.title.toLowerCase().includes(q.toLowerCase());
    return matchesCat && matchesQ;
  });

  return (
    <div className="flex flex-col gap-2.5 h-full">
      {/* Search */}
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2">
          <Icon name="Search" size={15} />
        </div>
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Buscar recetas…"
          className={cn(
            'w-full py-[9px] pr-3 pl-[34px] rounded-lg border border-border bg-background',
            'text-foreground font-sans text-[13px] outline-none',
            'focus:border-brand-300 focus:ring-1 focus:ring-brand-500/20',
          )}
        />
      </div>

      {/* Category chips */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5">
        {cats.map(c => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={cn(
              'py-[5px] px-[11px] rounded-full border text-[11px] font-semibold cursor-pointer whitespace-nowrap transition-all duration-150',
              cat === c
                ? 'bg-brand-500 border-brand-500 text-[#1C1A17]'
                : 'bg-transparent border-border text-muted-foreground hover:border-brand-300',
            )}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Count */}
      <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
        <Icon name="UtensilsCrossed" size={12} />{filtered.length} recetas
      </div>

      {/* Recipe rows */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1">
        {loading ? (
          <div className="text-[12px] text-muted-foreground py-6 text-center">
            Cargando recetas…
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-[12px] text-muted-foreground py-6 text-center">
            No se encontraron recetas.
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
  recipeId?: string | null;
  slot: string;
  onDrop: (id: string) => void;
  onClear: () => void;
  dense?: boolean;
  compact?: boolean;
}

export function MealCell({ recipeId, slot, onDrop, onClear, dense = false, compact = false }: MealCellProps) {
  const [over, setOver] = useState(false);
  const r = recipeId ? RX[recipeId] : null;

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setOver(true); };
  const onDragLeave = () => setOver(false);
  const onDropEv = (e: React.DragEvent) => {
    e.preventDefault(); setOver(false);
    const id = e.dataTransfer.getData('text/plain');
    if (id) onDrop(id);
  };

  if (!r) {
    return (
      <div
        onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDropEv}
        style={{
          background: over ? 'rgba(244,123,92,0.08)' : 'var(--mp-card-soft)',
          border: `1.5px dashed ${over ? 'var(--mp-coral)' : 'var(--mp-border)'}`,
          borderRadius: 10, padding: compact ? '10px 10px' : (dense ? '10px' : '14px'),
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
          minHeight: compact ? 64 : (dense ? 72 : 88),
          cursor: 'pointer', transition: 'all 150ms', textAlign: 'center',
        }}
      >
        <Icon name="sparkle" size={14} color={over ? 'var(--mp-coral)' : 'var(--mp-fg4)'} />
        <div style={{ fontSize: 11, color: over ? 'var(--mp-coral)' : 'var(--mp-fg4)', fontWeight: 500 }}>
          {over ? 'Suelta aquí' : 'Arrastra o sugerir'}
        </div>
      </div>
    );
  }

  return (
    <div
      onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDropEv}
      className="mp-meal-cell"
      style={{
        background: 'var(--mp-card)',
        border: `1px solid ${over ? 'var(--mp-coral)' : 'var(--mp-border)'}`,
        borderRadius: 10, padding: compact ? 8 : 10,
        position: 'relative', transition: 'all 150ms', cursor: 'pointer', overflow: 'hidden',
      }}
    >
      <button
        className="mp-cell-x"
        onClick={onClear}
        style={{
          position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 99,
          background: 'rgba(0,0,0,0.5)', border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', opacity: 0, transition: 'opacity 150ms', zIndex: 2,
        }}
      >
        <Icon name="x" size={11} color="#fff" />
      </button>
      {compact ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <RecipeThumb recipe={r} size={32} radius={6} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--mp-fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.25 }}>
              {r.name}
            </div>
            <div style={{ fontSize: 10, color: 'var(--mp-fg3)', fontFamily: 'var(--font-mono)' }}>{r.kcal} kcal</div>
          </div>
        </div>
      ) : (
        <>
          <RecipeThumb recipe={r} size={dense ? 40 : 48} radius={6} />
          <div style={{
            marginTop: 8, fontSize: 12, fontWeight: 600, color: 'var(--mp-fg)', lineHeight: 1.3,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          } as React.CSSProperties}>
            {r.name}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 10, color: 'var(--mp-coral)', fontFamily: 'var(--font-mono)', fontWeight: 500 }}>{r.kcal} kcal</span>
            <span style={{ fontSize: 10, color: 'var(--mp-fg3)' }}>·</span>
            <span style={{ fontSize: 10, color: 'var(--mp-fg3)', fontFamily: 'var(--font-mono)' }}>{r.p}g P</span>
          </div>
        </>
      )}
    </div>
  );
}

/* ── DayMacros ─────────────────────────────────── */
interface DayMacrosProps {
  tot: { kcal: number; p: number; c: number; f: number };
  target?: typeof TARGETS;
  compact?: boolean;
}

export function DayMacros({ tot, target = TARGETS, compact = false }: DayMacrosProps) {
  const pct = Math.min(1, tot.kcal / target.kcal);
  const status =
    pct < 0.85 ? { c: 'var(--mp-gold)',  t: 'Bajo objetivo'  } :
    pct > 1.05 ? { c: 'var(--mp-coral)', t: 'Sobre objetivo' } :
                 { c: 'var(--mp-sage)',  t: 'En objetivo'    };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: compact ? 0 : 200 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: compact ? 14 : 17, fontWeight: 500, color: 'var(--mp-fg)' }}>{tot.kcal}</div>
        <div style={{ fontSize: 10, color: 'var(--mp-fg3)' }}>/ {target.kcal} kcal</div>
        {!compact && <div style={{ fontSize: 10, color: status.c, fontWeight: 600, marginLeft: 'auto' }}>{status.t}</div>}
      </div>
      <MacroBar p={tot.p} c={tot.c} f={tot.f} height={5} />
      <div style={{ display: 'flex', gap: 10, fontSize: 10, color: 'var(--mp-fg3)', fontFamily: 'var(--font-mono)' }}>
        <span><span style={{ color: 'var(--mp-coral)' }}>●</span> {tot.p}g P</span>
        <span><span style={{ color: 'var(--mp-gold)' }}>●</span> {tot.c}g C</span>
        <span><span style={{ color: 'var(--mp-sage)' }}>●</span> {tot.f}g F</span>
      </div>
    </div>
  );
}

/* ── GridLayout ────────────────────────────────── */
interface LayoutProps {
  plan: Plan;
  onUpdate: (dayIdx: number, slotKey: string, recipeId: string | null) => void;
  density?: DensityType;
}

export function GridLayout({ plan, onUpdate, density }: LayoutProps) {
  const days = Array.from({ length: plan.days }, (_, i) => i);
  const dense = density === 'compact';
  const cellMin = dense ? 'minmax(110px, 1fr)' : 'minmax(132px, 1fr)';
  const slots = slotsForPlan(plan);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Day headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `72px repeat(${plan.days}, ${cellMin})`,
        gap: 8, marginBottom: 10,
        position: 'sticky', top: 0,
        background: 'var(--mp-bg)', zIndex: 2, paddingBottom: 6,
      }}>
        <div />
        {days.map(i => {
          const date = new Date(2026, 4, 4 + i);
          const isToday = i === 3;
          return (
            <div key={i} style={{ textAlign: 'center', padding: '6px 4px' }}>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                color: isToday ? 'var(--mp-coral)' : 'var(--mp-fg3)',
              }}>
                {DAY_NAMES_ES[i]}
              </div>
              <div style={{
                fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600,
                color: isToday ? 'var(--mp-coral)' : 'var(--mp-fg)',
              }}>
                {date.getDate()}
              </div>
              <div style={{ fontSize: 9, color: 'var(--mp-fg4)' }}>{MONTH_NAMES_ES[date.getMonth()]}</div>
            </div>
          );
        })}
      </div>

      {/* Meal rows */}
      {slots.map(s => (
        <div key={s.key} style={{
          display: 'grid',
          gridTemplateColumns: `72px repeat(${plan.days}, ${cellMin})`,
          gap: 8, marginBottom: 10,
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 24, height: 24, borderRadius: 6,
                background: `${s.color}22`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name={s.icon} size={13} color={s.color} />
              </div>
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--mp-fg2)', marginTop: 6 }}>{s.label}</div>
          </div>
          {days.map(i => (
            <MealCell
              key={i}
              recipeId={(plan.schedule['d' + i] || {})[s.key]}
              slot={s.key}
              dense={dense}
              onDrop={id => onUpdate(i, s.key, id)}
              onClear={() => onUpdate(i, s.key, null)}
            />
          ))}
        </div>
      ))}

      {/* Macro footer */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `72px repeat(${plan.days}, ${cellMin})`,
        gap: 8, marginTop: 8, paddingTop: 14, borderTop: '1px solid var(--mp-border)',
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--mp-fg4)', alignSelf: 'center' }}>Total</div>
        {days.map(i => {
          const t = dayTotals(plan, i);
          return (
            <div key={i} style={{ padding: '4px 6px' }}>
              <DayMacros tot={t} compact />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── StackLayout ───────────────────────────────── */
export function StackLayout({ plan, onUpdate }: LayoutProps) {
  const days = Array.from({ length: plan.days }, (_, i) => i);
  const slots = slotsForPlan(plan);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {days.map(i => {
        const date = new Date(2026, 4, 4 + i);
        const isToday = i === 3;
        const tot = dayTotals(plan, i);
        return (
          <div key={i} style={{
            background: 'var(--mp-card)',
            border: isToday ? '1.5px solid var(--mp-coral)' : '1px solid var(--mp-border)',
            borderRadius: 14, padding: 18, position: 'relative',
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
                <div style={{
                  fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 600,
                  color: isToday ? 'var(--mp-coral)' : 'var(--mp-fg)', letterSpacing: '-0.01em',
                }}>
                  {DAY_NAMES_ES[i]} {date.getDate()}
                </div>
                <div style={{ fontSize: 12, color: 'var(--mp-fg3)' }}>{MONTH_NAMES_ES[date.getMonth()]} · Día {i + 1}</div>
                {isToday && <Chip color="coral" size="xs">Hoy</Chip>}
              </div>
              <DayMacros tot={tot} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${slots.length}, 1fr)`, gap: 10 }}>
              {slots.map(s => (
                <div key={s.key}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <Icon name={s.icon} size={12} color={s.color} />
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: s.color }}>{s.label}</span>
                  </div>
                  <MealCell
                    recipeId={(plan.schedule['d' + i] || {})[s.key]}
                    slot={s.key}
                    onDrop={id => onUpdate(i, s.key, id)}
                    onClear={() => onUpdate(i, s.key, null)}
                  />
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── SplitLayout ───────────────────────────────── */
export function SplitLayout({ plan, onUpdate }: LayoutProps) {
  const [sel, setSel] = useState(0);
  const days = Array.from({ length: plan.days }, (_, i) => i);
  const date = new Date(2026, 4, 4 + sel);
  const tot = dayTotals(plan, sel);
  const slots = slotsForPlan(plan);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 18, alignItems: 'start' }}>
      {/* Rail */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, position: 'sticky', top: 0 }}>
        {days.map(i => {
          const t = dayTotals(plan, i);
          const a = i === sel;
          const isToday = i === 3;
          const dt = new Date(2026, 4, 4 + i);
          const pct = Math.min(1, t.kcal / TARGETS.kcal);
          return (
            <button
              key={i}
              onClick={() => setSel(i)}
              style={{
                padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', textAlign: 'left',
                background: a ? 'var(--mp-card-soft)' : 'transparent',
                boxShadow: a ? `inset 0 0 0 1.5px var(--mp-coral)` : 'inset 0 0 0 1px var(--mp-border)',
                transition: 'all 150ms', width: '100%',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
                <div>
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                    color: isToday ? 'var(--mp-coral)' : 'var(--mp-fg3)',
                  }}>
                    {DAY_NAMES_ES[i]}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 600,
                    color: a ? 'var(--mp-coral)' : 'var(--mp-fg)', marginLeft: 6,
                  }}>
                    {dt.getDate()}
                  </span>
                </div>
                {isToday && <span style={{ fontSize: 9, color: 'var(--mp-coral)', fontWeight: 700 }}>HOY</span>}
              </div>
              <div style={{ fontSize: 10, color: 'var(--mp-fg3)', fontFamily: 'var(--font-mono)', marginBottom: 5 }}>{t.kcal} kcal</div>
              <div style={{ height: 3, background: 'var(--mp-track)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{
                  width: (pct * 100) + '%', height: '100%',
                  background: pct < 0.85 ? 'var(--mp-gold)' : pct > 1.05 ? 'var(--mp-coral)' : 'var(--mp-sage)',
                }} />
              </div>
            </button>
          );
        })}
      </div>

      {/* Day editor */}
      <div style={{ background: 'var(--mp-card)', border: '1px solid var(--mp-border)', borderRadius: 14, padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--mp-coral)', marginBottom: 4 }}>
              {DAY_NAMES_ES[sel]} · {date.getDate()} {MONTH_NAMES_ES[date.getMonth()]}
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 600, color: 'var(--mp-fg)', letterSpacing: '-0.015em' }}>
              Día {sel + 1}
            </div>
          </div>
          <button style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(244,123,92,0.12)', color: 'var(--mp-coral)',
            border: '1px solid rgba(244,123,92,0.3)', padding: '8px 14px', borderRadius: 8,
            cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 600,
          }}>
            <Icon name="sparkle" size={14} color="var(--mp-coral)" /> Auto-completar día
          </button>
        </div>
        <div style={{ marginBottom: 22 }}><DayMacros tot={tot} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(slots.length, 4)}, 1fr)`, gap: 12 }}>
          {slots.map(s => (
            <div key={s.key}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Icon name={s.icon} size={13} color={s.color} />
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: s.color }}>{s.label}</span>
              </div>
              <MealCell
                recipeId={(plan.schedule['d' + sel] || {})[s.key]}
                slot={s.key}
                onDrop={id => onUpdate(sel, s.key, id)}
                onClear={() => onUpdate(sel, s.key, null)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
