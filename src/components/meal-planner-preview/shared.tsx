'use client';

import React from 'react';
import type { Recipe } from './types';
import { Icon } from './icons';
import { cn } from '@/lib/utils';

/* ── RecipeThumb ─────────────────────────────────── */
interface RecipeThumbProps {
  recipe: Recipe | null;
  size?: number;
  radius?: number;
}

export function RecipeThumb({ recipe, size = 44, radius = 8 }: RecipeThumbProps) {
  if (!recipe) return null;
  const initials = recipe.name
    .split(' ')
    .filter(w => w.length > 2)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();

  const radiusClass =
    radius <= 6 ? 'rounded-md' :
    radius <= 8 ? 'rounded-lg' :
    radius <= 12 ? 'rounded-xl' :
    'rounded-2xl';

  return (
    <div
      className={cn(
        'relative flex-shrink-0 overflow-hidden',
        'bg-gradient-to-br from-brand-100 to-gold-100 dark:from-brand-500/20 dark:to-gold-500/10',
        radiusClass,
      )}
      style={{ width: size, height: size }}
    >
      <div className="absolute inset-0 flex items-center justify-center font-semibold text-white/85 tracking-tight">
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
  height?: number;
}

export function MacroBar({ p, c, f, height = 4 }: MacroBarProps) {
  const totalCal = p * 4 + c * 4 + f * 9;

  if (totalCal === 0) {
    return (
      <div
        className="rounded-full bg-muted"
        style={{ height }}
      />
    );
  }

  const pP = (p * 4 / totalCal) * 100;
  const pC = (c * 4 / totalCal) * 100;
  const pF = (f * 9 / totalCal) * 100;

  return (
    <div
      className="flex rounded-full overflow-hidden bg-muted"
      style={{ height }}
    >
      <div className="bg-brand-500 flex-shrink-0" style={{ width: `${pP}%` }} />
      <div className="bg-gold-500 flex-shrink-0" style={{ width: `${pC}%` }} />
      <div className="bg-sage-500 flex-shrink-0" style={{ width: `${pF}%` }} />
    </div>
  );
}

/* ── Chip ────────────────────────────────────────── */
type ChipColor = 'neutral' | 'coral' | 'sage' | 'gold' | 'danger';
type ChipSize = 'xs' | 'sm' | 'md';

interface ChipProps {
  children: React.ReactNode;
  color?: ChipColor;
  size?: ChipSize;
  icon?: string;
  style?: React.CSSProperties;
}

const CHIP_COLOR_CLASSES: Record<ChipColor, string> = {
  neutral: 'bg-muted text-muted-foreground',
  coral:   'bg-brand-500/10 text-brand-600 dark:text-brand-400',
  sage:    'bg-sage-500/10 text-sage-600 dark:text-sage-400',
  gold:    'bg-gold-500/10 text-gold-600 dark:text-gold-400',
  danger:  'bg-destructive/10 text-destructive',
};

const CHIP_SIZE_CLASSES: Record<ChipSize, { wrapper: string; fontSize: number; iconSize: number }> = {
  xs: { wrapper: 'py-[2px] px-[7px]',  fontSize: 10, iconSize: 12 },
  sm: { wrapper: 'py-[3px] px-[9px]',  fontSize: 11, iconSize: 13 },
  md: { wrapper: 'py-[5px] px-[11px]', fontSize: 12, iconSize: 14 },
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
      style={{ ...style, fontSize: sz.fontSize }}
    >
      {icon && <Icon name={icon} size={sz.iconSize} />}
      {children}
    </span>
  );
}
