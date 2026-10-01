'use client';

import React from 'react';
import Image from 'next/image';
import { Icon } from './icons';
import { cn } from '@/lib/utils';
import { getMacroBarLayout } from '@/lib/meal-plan-macros';

/* ── RecipeThumb ─────────────────────────────────── */
interface RecipeThumbProps {
  recipe: { title: string; imageUrl: string | null } | null;
  size?: number;
  radius?: number;
}

export function RecipeThumb({ recipe, size = 44, radius = 8 }: RecipeThumbProps) {
  if (!recipe) return null;

  const radiusClass =
    radius <= 6 ? 'rounded-md' :
    radius <= 8 ? 'rounded-lg' :
    radius <= 12 ? 'rounded-xl' :
    'rounded-2xl';

  if (recipe.imageUrl) {
    return (
      <div
        className={cn('relative flex-shrink-0 overflow-hidden', radiusClass)}
        style={{ width: size, height: size }}
      >
        <Image
          src={recipe.imageUrl}
          alt={recipe.title}
          fill
          className="object-cover"
          sizes={`${size}px`}
        />
      </div>
    );
  }

  const initials = recipe.title
    .split(' ')
    .filter(w => w.length > 2)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();

  return (
    <div
      className={cn(
        'relative flex-shrink-0 overflow-hidden',
        'bg-gradient-to-br from-brand-100 to-gold-100 dark:from-brand-500/20 dark:to-gold-500/10',
        radiusClass,
      )}
      style={{ width: size, height: size }}
    >
      <div className="absolute inset-0 flex items-center justify-center font-semibold text-brand-900/80 dark:text-white/85 tracking-tight">
        <span style={{ fontSize: size * 0.36 }}>{initials}</span>
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/25" />
    </div>
  );
}

/* ── MacroBar ────────────────────────────────────── */
interface MacroBarProps {
  p: number;
  c: number;
  f: number;
  /** Calories shown by the bar; with `calorieTarget` it becomes a progress track. */
  calories?: number;
  /** Daily calorie target. Without one the bar shows the macro composition only. */
  calorieTarget?: number | null;
  height?: number;
}

/**
 * Macro bar. With a calorie target it fills `calories / target` of the track,
 * split into protein / carbs / fat by energy share, and past the target it
 * fills the track and marks where the target falls. Without a target it is a
 * full-width composition bar. Decorative: callers render the numbers as text.
 */
export function MacroBar({ p, c, f, calories = 0, calorieTarget, height = 4 }: MacroBarProps) {
  const { fill, shares, targetMarker } = getMacroBarLayout(
    { calories, protein: p, carbs: c, fat: f },
    calorieTarget,
  );
  const hasShares = shares.protein + shares.carbs + shares.fat > 0;

  return (
    <div aria-hidden className="relative rounded-full overflow-hidden bg-muted" style={{ height }}>
      {fill > 0 && (
        <div
          // Calories without macro data still fill the track, in a neutral tone
          className={cn('flex h-full rounded-full overflow-hidden', !hasShares && 'bg-muted-foreground/40')}
          style={{ width: `${fill}%` }}
        >
          <div className="bg-slate-500 flex-shrink-0" style={{ width: `${shares.protein}%` }} />
          <div className="bg-gold-500 flex-shrink-0" style={{ width: `${shares.carbs}%` }} />
          <div className="bg-sage-500 flex-shrink-0" style={{ width: `${shares.fat}%` }} />
        </div>
      )}
      {targetMarker != null && (
        <div
          className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-foreground"
          style={{ left: `${targetMarker}%` }}
        />
      )}
    </div>
  );
}

/* ── Chip ────────────────────────────────────────── */
type ChipColor = 'neutral' | 'coral' | 'sage' | 'gold' | 'slate' | 'danger';
type ChipSize = 'xs' | 'sm' | 'md';

interface ChipProps {
  children: React.ReactNode;
  color?: ChipColor;
  size?: ChipSize;
  icon?: string;
  style?: React.CSSProperties;
}

/**
 * Every pair reaches WCAG AA (4.5:1) in both themes on card, muted-row and page
 * surfaces. The brand / sage / gold scales are inverted in dark mode (see
 * globals.css), so a `-700` text shade stays dark in light mode and light in
 * dark mode; slate and red are Tailwind's fixed scales and need a `dark:` shade.
 */
export const CHIP_COLOR_CLASSES: Record<ChipColor, string> = {
  neutral: 'bg-muted text-secondary-foreground',
  coral:   'bg-brand-500/8 text-brand-700 dark:text-brand-600',
  sage:    'bg-sage-500/10 text-sage-700 dark:text-sage-600',
  gold:    'bg-gold-500/10 text-gold-700 dark:text-gold-400',
  slate:   'bg-slate-500/10 text-slate-600 dark:text-slate-400',
  danger:  'bg-destructive/10 text-red-700 dark:text-red-300',
};

const CHIP_SIZE_CLASSES: Record<ChipSize, { wrapper: string; iconSize: number }> = {
  xs: { wrapper: 'py-[2px] px-[7px] text-[11px] touch:text-xs',  iconSize: 12 },
  sm: { wrapper: 'py-[3px] px-[9px] text-[11px] touch:text-xs',  iconSize: 13 },
  md: { wrapper: 'py-[5px] px-[11px] text-xs',                   iconSize: 14 },
};

export function Chip({ children, color = 'neutral', size = 'sm', icon, style }: ChipProps) {
  const colorCls = CHIP_COLOR_CLASSES[color];
  const sz = CHIP_SIZE_CLASSES[size];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full font-semibold',
        colorCls,
        sz.wrapper,
      )}
      style={style}
    >
      {icon && <Icon name={icon} size={sz.iconSize} />}
      {children}
    </span>
  );
}
