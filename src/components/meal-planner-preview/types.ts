export interface Recipe {
  id: string;
  name: string;
  cat: string;
  kcal: number;
  p: number;
  c: number;
  f: number;
  time: number;
  diff: string;
  tone: [number, number];
}

export interface Plan {
  id: string;
  name: string;
  days: number;
  meals: number;
  kcal: number;
  color: string;
  public: boolean;
  schedule: Record<string, Record<string, string | null | undefined>>;
}

export type SlotKey = 'b' | 'l' | 's' | 'd';

export interface SlotDef {
  key: SlotKey;
  label: string;
  short: string;
  icon: string;
  color: string;
}

export interface Totals {
  kcal: number;
  p: number;
  c: number;
  f: number;
}

export type Theme = 'dark' | 'light';
export type LayoutType = 'grid' | 'stack' | 'split';
export type DensityType = 'regular' | 'compact';
export type NavId = 'panel' | 'recetas' | 'planner' | 'nutricion' | 'compras';
export type TabId = 'planner' | 'calendar';
