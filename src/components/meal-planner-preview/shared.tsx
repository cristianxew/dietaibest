'use client';

import React from 'react';
import Image from 'next/image';
import type { Recipe } from './types';
import type { Theme, NavId } from './types';
import { Icon } from './icons';

/* ── RecipeThumb ─────────────────────────────────── */
interface RecipeThumbProps {
  recipe: Recipe | null;
  size?: number;
  radius?: number;
}

export function RecipeThumb({ recipe, size = 44, radius = 8 }: RecipeThumbProps) {
  if (!recipe) return null;
  const [h, s] = recipe.tone;
  const bg = `radial-gradient(circle at 30% 30%, hsl(${h} ${s}% 62%), hsl(${(h + 25) % 360} ${s - 10}% 38%))`;
  const initials = recipe.name
    .split(' ')
    .filter(w => w.length > 2)
    .slice(0, 2)
    .map(w => w[0])
    .join('')
    .toUpperCase();
  return (
    <div style={{
      width: size, height: size, borderRadius: radius, background: bg,
      position: 'relative', flexShrink: 0, overflow: 'hidden',
      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06)',
    }}>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-display)', fontSize: size * 0.36, fontWeight: 600,
        color: 'rgba(255,255,255,0.85)', letterSpacing: '-0.02em',
      }}>
        {initials}
      </div>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.25))' }} />
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
    return <div style={{ height, background: 'var(--mp-track)', borderRadius: 99 }} />;
  }
  const pP = (p * 4 / totalCal) * 100;
  const pC = (c * 4 / totalCal) * 100;
  const pF = (f * 9 / totalCal) * 100;
  return (
    <div style={{ display: 'flex', height, borderRadius: 99, overflow: 'hidden', background: 'var(--mp-track)' }}>
      <div style={{ width: pP + '%', background: 'var(--mp-coral)' }} />
      <div style={{ width: pC + '%', background: 'var(--mp-gold)' }} />
      <div style={{ width: pF + '%', background: 'var(--mp-sage)' }} />
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

const CHIP_PALETTES: Record<ChipColor, { bg: string; fg: string }> = {
  neutral: { bg: 'var(--mp-chip-bg)',          fg: 'var(--mp-fg2)' },
  coral:   { bg: 'rgba(244,123,92,0.14)',       fg: '#F47B5C' },
  sage:    { bg: 'rgba(107,155,107,0.16)',      fg: '#9FBC9F' },
  gold:    { bg: 'rgba(212,160,23,0.14)',       fg: '#FCD34D' },
  danger:  { bg: 'rgba(220,38,38,0.16)',        fg: '#FCA5A5' },
};

const CHIP_SIZES: Record<ChipSize, { f: number; py: string; px: string }> = {
  xs: { f: 10, py: '2px',  px: '7px'  },
  sm: { f: 11, py: '3px',  px: '9px'  },
  md: { f: 12, py: '5px',  px: '11px' },
};

export function Chip({ children, color = 'neutral', size = 'sm', icon, style }: ChipProps) {
  const p = CHIP_PALETTES[color];
  const sz = CHIP_SIZES[size];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontFamily: 'var(--font-sans)', fontSize: sz.f, fontWeight: 600,
      padding: `${sz.py} ${sz.px}`, borderRadius: 9999,
      background: p.bg, color: p.fg, ...style,
    }}>
      {icon && <Icon name={icon} size={sz.f + 2} color={p.fg} />}
      {children}
    </span>
  );
}

/* ── Sidebar ─────────────────────────────────────── */
const NAV_ITEMS = [
  { id: 'panel'     as NavId, label: 'Panel',             icon: 'panel'     },
  { id: 'recetas'   as NavId, label: 'Recetas',           icon: 'recipes'   },
  { id: 'planner'   as NavId, label: 'Planes de comidas', icon: 'calendar'  },
  { id: 'nutricion' as NavId, label: 'Nutrición',         icon: 'nutrition' },
  { id: 'compras'   as NavId, label: 'Compras',           icon: 'cart'      },
];

interface SidebarProps {
  active: NavId;
  onNav: (id: NavId) => void;
  theme: Theme;
  onTheme: (t: Theme) => void;
  collapsed: boolean;
  onCollapse: (v: boolean) => void;
}

function subtleBtn(collapsed: boolean): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: collapsed ? '9px' : '9px 12px',
    borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer',
    color: 'var(--mp-fg3)', fontFamily: 'var(--font-sans)', fontSize: 12, fontWeight: 500,
    textAlign: 'left', justifyContent: collapsed ? 'center' : 'flex-start',
    width: '100%',
  };
}

export function Sidebar({ active, onNav, theme, onTheme, collapsed, onCollapse }: SidebarProps) {
  return (
    <aside style={{
      width: collapsed ? 64 : 232,
      background: 'var(--mp-bg)',
      borderRight: '1px solid var(--mp-border)',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
      transition: 'width 250ms var(--mp-ease)',
      zIndex: 5, position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{
        padding: collapsed ? '20px 12px' : '20px 18px',
        display: 'flex', alignItems: 'center', gap: 10,
        height: 72, borderBottom: '1px solid var(--mp-border)',
        flexShrink: 0,
      }}>
        {collapsed ? (
          <Image
            src="/Dietai_logo_symbol.svg"
            alt="DietAI"
            width={32} height={32}
            style={{ width: 32, height: 32 }}
          />
        ) : (
          <Image
            src={theme === 'dark' ? '/Dietai_logo_light.png' : '/Dietai_logo_dark.png'}
            alt="DietAI"
            width={120} height={30}
            style={{ height: 30, width: 'auto' }}
          />
        )}
      </div>

      {/* Nav */}
      <nav style={{ padding: '14px 8px', display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        {NAV_ITEMS.map(n => {
          const a = n.id === active;
          return (
            <button
              key={n.id}
              onClick={() => onNav(n.id)}
              title={collapsed ? n.label : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: collapsed ? '11px' : '11px 12px',
                borderRadius: 8, border: 'none', cursor: 'pointer', textAlign: 'left',
                background: a ? 'rgba(244,123,92,0.12)' : 'transparent',
                color: a ? 'var(--mp-coral)' : 'var(--mp-fg2)',
                fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: a ? 600 : 500,
                transition: 'background 150ms',
                justifyContent: collapsed ? 'center' : 'flex-start',
                width: '100%',
              }}
              onMouseEnter={e => { if (!a) (e.currentTarget as HTMLElement).style.background = 'var(--mp-chip-bg)'; }}
              onMouseLeave={e => { if (!a) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <Icon name={n.icon} size={18} color={a ? 'var(--mp-coral)' : 'var(--mp-fg3)'} />
              {!collapsed && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 2, borderTop: '1px solid var(--mp-border)' }}>
        <button
          onClick={() => onTheme(theme === 'dark' ? 'light' : 'dark')}
          style={subtleBtn(collapsed)}
          title="Cambiar tema"
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} color="var(--mp-fg3)" />
          {!collapsed && <span>{theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}</span>}
        </button>
        <button style={subtleBtn(collapsed)} title="Idioma">
          <Icon name="globe" size={16} color="var(--mp-fg3)" />
          {!collapsed && <span>Español</span>}
        </button>
        <button onClick={() => onCollapse(!collapsed)} style={subtleBtn(collapsed)} title="Colapsar">
          <Icon name="collapse" size={16} color="var(--mp-fg3)" />
          {!collapsed && <span>Colapsar</span>}
        </button>
      </div>

      {/* User avatar */}
      <div style={{
        padding: collapsed ? '12px' : '14px 16px',
        borderTop: '1px solid var(--mp-border)',
        display: 'flex', alignItems: 'center', gap: 10,
        flexShrink: 0,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 99,
          background: 'linear-gradient(135deg,#F47B5C,#D4A017)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#1C1A17', fontWeight: 700, fontSize: 13, flexShrink: 0,
        }}>C</div>
        {!collapsed && (
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--mp-fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Cristian Bernal
            </div>
            <div style={{ fontSize: 11, color: 'var(--mp-fg3)' }}>Plan Pro</div>
          </div>
        )}
      </div>
    </aside>
  );
}
