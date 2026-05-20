import type { Recipe, Plan, SlotDef } from './types';

export const RECIPES: Recipe[] = [
  { id: 'r1',  name: 'Lasaña vegetal con pesto',   cat: 'Pasta',       kcal: 499, p: 13, c: 55, f: 18, time: 25, diff: 'Medio', tone: [345, 55] },
  { id: 'r2',  name: 'Carbonara vegana con tofu',  cat: 'Pasta',       kcal: 506, p: 21, c: 58, f: 14, time: 10, diff: 'Fácil', tone: [40,  60] },
  { id: 'r3',  name: 'Tostada de aguacate',        cat: 'Desayuno',    kcal: 312, p: 11, c: 32, f: 15, time: 8,  diff: 'Fácil', tone: [140, 40] },
  { id: 'r4',  name: 'Bowl de quinoa y salmón',    cat: 'Bowls',       kcal: 548, p: 38, c: 42, f: 22, time: 20, diff: 'Fácil', tone: [15,  70] },
  { id: 'r5',  name: 'Pan de lentejas sin harina', cat: 'Panes',       kcal: 240, p: 14, c: 28, f: 6,  time: 35, diff: 'Medio', tone: [30,  55] },
  { id: 'r6',  name: 'Makaron boloñesa vegana',    cat: 'Pasta',       kcal: 681, p: 41, c: 78, f: 14, time: 30, diff: 'Medio', tone: [10,  65] },
  { id: 'r7',  name: 'Tortillas de maíz azul',     cat: 'Mexicano',    kcal: 100, p: 2,  c: 18, f: 1,  time: 15, diff: 'Fácil', tone: [260, 30] },
  { id: 'r8',  name: 'Ensalada de remolacha',      cat: 'Ensaladas',   kcal: 185, p: 6,  c: 14, f: 11, time: 12, diff: 'Fácil', tone: [340, 60] },
  { id: 'r9',  name: 'Curry de garbanzos',         cat: 'Vegetariano', kcal: 445, p: 18, c: 52, f: 14, time: 25, diff: 'Medio', tone: [35,  75] },
  { id: 'r10', name: 'Pasta primavera',            cat: 'Pasta',       kcal: 520, p: 16, c: 72, f: 18, time: 18, diff: 'Fácil', tone: [80,  50] },
  { id: 'r11', name: 'Yogur griego con frutos',    cat: 'Desayuno',    kcal: 220, p: 18, c: 24, f: 5,  time: 3,  diff: 'Fácil', tone: [280, 40] },
  { id: 'r12', name: 'Pollo asado con verduras',   cat: 'Carnes',      kcal: 580, p: 48, c: 18, f: 32, time: 45, diff: 'Medio', tone: [25,  60] },
];

export const RX: Record<string, Recipe> = Object.fromEntries(RECIPES.map(r => [r.id, r]));

export const PLANS: Plan[] = [
  {
    id: 'p1', name: 'Unani 1', days: 7, meals: 4, kcal: 1000, color: '#F47B5C', public: true,
    schedule: {
      d0: { b: 'r3',  l: 'r5',  s: 'r11', d: 'r6'  },
      d1: { b: 'r11', l: 'r7',  s: null,  d: 'r1'  },
      d2: { b: 'r3',  l: 'r4',  s: 'r11', d: 'r2'  },
      d3: { b: 'r11', l: 'r9',  s: null,  d: 'r10' },
      d4: { b: 'r3',  l: 'r8',  s: 'r11', d: 'r12' },
      d5: { b: null,  l: 'r4',  s: null,  d: 'r1'  },
      d6: { b: 'r3',  l: null,  s: null,  d: 'r6'  },
    },
  },
  {
    id: 'p2', name: 'Visita compadres', days: 7, meals: 2, kcal: 2000, color: '#6B9B6B', public: true,
    schedule: {
      d0: { l: 'r12', d: 'r1'  }, d1: { l: 'r4',  d: 'r6'  },
      d2: { l: 'r10', d: 'r12' }, d3: { l: 'r9',  d: 'r4'  },
      d4: { l: 'r6',  d: 'r1'  }, d5: { l: 'r12', d: 'r10' },
      d6: { l: 'r4',  d: 'r12' },
    },
  },
  {
    id: 'p3', name: 'Semana Ligera', days: 7, meals: 3, kcal: 1600, color: '#D4A017', public: false,
    schedule: {
      d0: { b: 'r3', l: 'r8', d: 'r2' }, d1: { b: 'r11', l: 'r4', d: 'r10' },
      d2: { b: 'r3', l: 'r9', d: 'r1' }, d3: { b: 'r11', l: 'r8', d: 'r2' },
      d4: { b: 'r3', l: 'r4', d: 'r12' }, d5: { b: 'r11', l: 'r9', d: 'r10' },
      d6: { b: 'r3', l: 'r8', d: 'r1' },
    },
  },
];

export const DAY_NAMES_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
export const MONTH_NAMES_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export const MONTH_NAMES_ES_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export const SLOT_DEFS: SlotDef[] = [
  { key: 'b', label: 'Desayuno', short: 'D', icon: 'sun',   color: '#F47B5C' },
  { key: 'l', label: 'Almuerzo', short: 'A', icon: 'leaf',  color: '#6B9B6B' },
  { key: 's', label: 'Snack',    short: 'S', icon: 'star',  color: '#D4A017' },
  { key: 'd', label: 'Cena',     short: 'C', icon: 'moon',  color: '#A8A092' },
];

export const TARGETS = { kcal: 1000, p: 75, c: 120, f: 35 };

export function dayTotals(plan: Plan, dayIdx: number) {
  const d = plan.schedule['d' + dayIdx] || {};
  let kcal = 0, p = 0, c = 0, f = 0;
  for (const k of Object.keys(d)) {
    const rId = d[k];
    if (!rId) continue;
    const r = RX[rId];
    if (r) { kcal += r.kcal; p += r.p; c += r.c; f += r.f; }
  }
  return { kcal, p, c, f };
}

export function slotsForPlan(plan: Plan): SlotDef[] {
  return SLOT_DEFS.filter(s =>
    plan.meals === 4 ||
    (plan.meals === 3 && s.key !== 's') ||
    (plan.meals === 2 && (s.key === 'l' || s.key === 'd'))
  );
}
