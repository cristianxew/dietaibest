# Nutrition Hub v2 — "Fix My Week" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Analyze the user's scheduled meal-plan week against their personal nutrient targets, surface ranked findings with culprit attribution, and let the user fix them with one-tap recipe swaps (own library first, USDA-verified AI recipe as fallback).

**Architecture:** Three new pure engines in `src/lib/nutrients/` (`schedule-window`, `week-analysis`, `swap-scorer`) reuse v1's `aggregate`/`rda`/`extract` modules untouched. A batched recipe-profile resolver moves to `src/lib/recipeNutrients.ts`. Thin server actions in `src/actions/nutrition-week.ts` orchestrate; `applySwap` is an in-place `MealPlanMeal.recipeId` UPDATE. No schema changes, no migrations.

**Tech Stack:** Next.js 15 App Router, Prisma, vitest (`bun run test:unit`), next-intl (en/es/pl), USDA FDC via `getFoodsCached`, Vercel AI SDK `generateText` with the existing Mastra model helpers.

**Spec:** `docs/superpowers/specs/2026-06-11-nutrition-hub-v2-my-week-design.md`

**Deviation from spec (justified by discovery):** No code path in the repo persists `RecipeIngredient` rows — `analyzeRecipeAction` computes FDC matches but nothing saves them, so in production every recipe is `macrosOnly`. The spec's "Improve your data" card therefore becomes a **one-tap `matchRecipeIngredients` server action** (Task 5) instead of a deep-link to the recipe editor. Without it, micro-analysis never activates for anyone.

**House rules (non-negotiable):**
- Package manager is **bun**, never npm. Tests: `bun run test:unit <path>`.
- Conventional commits. **Never** add Co-Authored-By or AI attribution.
- Never build (`bun run build`) after changes. Type-check with `bun tsc --noEmit`.
- Use `rg`/`fd`/`bat`/`eza`/`sd`, never grep/find/cat/ls/sed.
- **Zero imports from `src/lib/edamam*` in any new file** (per-user macro cache policy).
- `NutrientVector` is sparse: missing key = unknown, NEVER zero.
- Never touch `src/lib/chat/system-prompt.ts` (ADR-0001).
- Restart the dev server after editing `messages/*.json` (catalogs are cached).
- Never run `bun prisma migrate dev` (it offers to RESET the remote shared DB). This plan needs no migration at all.

---

## File map

| File | Status | Responsibility |
|---|---|---|
| `src/lib/nutrients/schedule-window.ts` | create | Pure: calendar dates → template dayNumbers |
| `src/lib/nutrients/week-analysis.ts` | create | Pure: week vectors + RDA → ranked Findings |
| `src/lib/nutrients/swap-scorer.ts` | create | Pure: multi-objective swap ranking |
| `src/lib/recipeNutrients.ts` | create | Batched recipe → NutrientVector resolver (prisma + FDC cache) |
| `src/actions/nutrition-hub.ts` | modify | Delegate `buildRecipeProfile` to the new lib |
| `src/actions/nutrition-week.ts` | create | `getMyWeekAnalysis`, `getSwapSuggestions`, `applySwap`, `matchRecipeIngredients`, `generateGapRecipe` |
| `src/app/[locale]/(protected-pages)/nutrition/my-week/page.tsx` | create | Route (server component) |
| `src/components/nutrition-hub/my-week/MyWeekBoard.tsx` | create | Client island: state, refresh, undo |
| `src/components/nutrition-hub/my-week/WeekStrip.tsx` | create | 7 day chips |
| `src/components/nutrition-hub/my-week/FindingCard.tsx` | create | Finding + inline swap suggestions |
| `src/components/nutrition-hub/my-week/WeekHeatmap.tsx` | create | Collapsible nutrient × day detail |
| `src/components/nutrition-hub/my-week/ImproveDataCard.tsx` | create | One-tap ingredient matching |
| `src/components/nutrition-hub/my-week/MyWeekHero.tsx` | create | Landing hero card (server) |
| `src/components/nutrition-hub/my-week/PlannerNutritionBanner.tsx` | create | Slim banner for the meal-plans page |
| `src/app/[locale]/(protected-pages)/nutrition/page.tsx` | modify | Hero card + module entry |
| `src/app/[locale]/(protected-pages)/meal-plans/page.tsx` | modify | Mount banner |
| `messages/{en,es,pl}.json` | modify | `nutritionHub.myWeek.*` |
| `tests/unit/nutrients/schedule-window.test.ts` | create | TDD |
| `tests/unit/nutrients/week-analysis.test.ts` | create | TDD |
| `tests/unit/nutrients/swap-scorer.test.ts` | create | TDD |

Existing modules reused as-is (do NOT modify): `src/lib/nutrients/{registry,extract,aggregate,rda,rda-data}.ts`, `src/lib/fdcRepo.ts`, `src/actions/analyzeRecipe.ts`, `src/lib/ingredients.ts`, `src/lib/server-action.ts`, `src/components/nutrition-hub/{format.ts,shared/*,vs-day/ProfileNudge.tsx}`.

Server actions follow the v1 convention: thin orchestration, **no unit tests** (pure engines carry the test burden; actions are verified in the browser via preview tools).

---

## Phase A — Pure engines (strict TDD)

### Task 1: `resolveScheduleWindow`

**Files:**
- Create: `src/lib/nutrients/schedule-window.ts`
- Test: `tests/unit/nutrients/schedule-window.test.ts`

Semantics copied from `getMealPlanSchedule` reality (`src/actions/meal-plan.ts:1065`): plans do NOT cycle; `dayNumber = daysSinceStart + 1`; a date past `duration` is unplanned; overlapping schedules → latest `startDate` wins (matches the action's `orderBy: { startDate: "desc" }`).

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/nutrients/schedule-window.test.ts
import { describe, it, expect } from "vitest";
import {
  resolveScheduleWindow,
  type ScheduleLike,
} from "@/lib/nutrients/schedule-window";

// Local-noon constructor avoids UTC-midnight rollover in any timezone.
const d = (y: number, m: number, day: number) => new Date(y, m - 1, day, 12);

const schedule = (over: Partial<ScheduleLike> = {}): ScheduleLike => ({
  id: "s1",
  startDate: d(2026, 6, 8), // Monday
  duration: 7,
  ...over,
});

describe("resolveScheduleWindow", () => {
  it("maps the next 7 days to 1-based template dayNumbers", () => {
    const win = resolveScheduleWindow([schedule()], d(2026, 6, 10));
    expect(win).toHaveLength(7);
    expect(win[0]).toEqual({ date: "2026-06-10", scheduleId: "s1", dayNumber: 3 });
    expect(win[4]).toEqual({ date: "2026-06-14", scheduleId: "s1", dayNumber: 7 });
  });

  it("marks days past the plan duration as unplanned", () => {
    const win = resolveScheduleWindow([schedule()], d(2026, 6, 10));
    // 2026-06-15 is day 8 of a 7-day plan
    expect(win[5]).toEqual({ date: "2026-06-15", scheduleId: null, dayNumber: null });
    expect(win[6].dayNumber).toBeNull();
  });

  it("marks days before the schedule start as unplanned", () => {
    const win = resolveScheduleWindow(
      [schedule({ startDate: d(2026, 6, 12) })],
      d(2026, 6, 10)
    );
    expect(win[0].dayNumber).toBeNull(); // 06-10
    expect(win[1].dayNumber).toBeNull(); // 06-11
    expect(win[2]).toEqual({ date: "2026-06-12", scheduleId: "s1", dayNumber: 1 });
  });

  it("prefers the schedule with the latest startDate on overlap", () => {
    const win = resolveScheduleWindow(
      [
        schedule({ id: "old", startDate: d(2026, 6, 1), duration: 30 }),
        schedule({ id: "new", startDate: d(2026, 6, 9), duration: 7 }),
      ],
      d(2026, 6, 10)
    );
    expect(win[0]).toEqual({ date: "2026-06-10", scheduleId: "new", dayNumber: 2 });
  });

  it("returns all-unplanned when there are no schedules", () => {
    const win = resolveScheduleWindow([], d(2026, 6, 10));
    expect(win.every((w) => w.dayNumber === null && w.scheduleId === null)).toBe(true);
  });

  it("is robust across a month boundary", () => {
    const win = resolveScheduleWindow(
      [schedule({ startDate: d(2026, 6, 28), duration: 7 })],
      d(2026, 6, 29)
    );
    expect(win[2]).toEqual({ date: "2026-07-01", scheduleId: "s1", dayNumber: 4 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit tests/unit/nutrients/schedule-window.test.ts`
Expected: FAIL — `Cannot find module '@/lib/nutrients/schedule-window'`

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/lib/nutrients/schedule-window.ts
/**
 * Maps upcoming calendar days to meal-plan template day numbers.
 *
 * Mirrors the production semantics of getActiveMealPlanSchedule
 * (actions/meal-plan.ts): plans do not cycle, dayNumber is 1-based,
 * dates past `duration` are unplanned, latest startDate wins overlaps.
 *
 * Pure module — date math only, no I/O.
 *
 * @module lib/nutrients/schedule-window
 */

export interface ScheduleLike {
  id: string;
  startDate: Date;
  /** Template duration in days */
  duration: number;
}

export interface WindowDay {
  /** Local calendar date, YYYY-MM-DD */
  date: string;
  scheduleId: string | null;
  /** 1-based template dayNumber, null when no schedule covers the date */
  dayNumber: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function atLocalMidnight(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Whole local days from a to b; Math.round absorbs DST hour shifts. */
function daysBetween(a: Date, b: Date): number {
  return Math.round((atLocalMidnight(b).getTime() - atLocalMidnight(a).getTime()) / DAY_MS);
}

export function resolveScheduleWindow(
  schedules: ScheduleLike[],
  today: Date,
  windowDays = 7
): WindowDay[] {
  const byLatestStart = [...schedules].sort(
    (a, b) => b.startDate.getTime() - a.startDate.getTime()
  );

  const window: WindowDay[] = [];
  const start = atLocalMidnight(today);

  for (let i = 0; i < windowDays; i++) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);

    let resolved: WindowDay = { date: localDateKey(date), scheduleId: null, dayNumber: null };
    for (const s of byLatestStart) {
      const diff = daysBetween(s.startDate, date);
      if (diff >= 0 && diff < s.duration) {
        resolved = { date: localDateKey(date), scheduleId: s.id, dayNumber: diff + 1 };
        break;
      }
    }
    window.push(resolved);
  }

  return window;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit tests/unit/nutrients/schedule-window.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/nutrients/schedule-window.ts tests/unit/nutrients/schedule-window.test.ts
git commit -m "feat(nutrition-hub): pure schedule-window resolver for week analysis"
```

---

### Task 2: `week-analysis` engine

**Files:**
- Create: `src/lib/nutrients/week-analysis.ts`
- Test: `tests/unit/nutrients/week-analysis.test.ts`

Rules (deterministic, all constants live in the module):
- A nutrient is **known** for a day iff the key is present in the day's totals (sparse rule).
- **Goal deficit:** day misses when `total < 0.7 × target`; finding emitted when misses ≥ ⌈knownDays/2⌉. `weekGapAmount = Σ max(0, target − total)` over known days.
- **Limit excess:** day over when `total > limit`; finding emitted when overs ≥ 2. `weekGapAmount = Σ max(0, total − limit)`.
- **kcal** (neutral): both directions — deficit per goal rule, excess when `total > 1.15 × target` on ≥ 2 days. **carbs/fat:** no findings ever.
- `severity = (weekGapAmount / (target × knownDays)) × (affectedDays / knownDays)`, ×1.25 for limit excess.
- **Contributors:** excess → meals sorted by week amount desc (top 3, `share = amount / weekTotal`); deficit → meals with the key present sorted asc (best replacement headroom).
- **Reliability:** `macrosOnlyMeals / totalMeals > 0.5` ⇒ `microFindingsReliable = false` and findings are restricted to the macro keys `kcal | protein | fiber` (carbs/fat never; sugar/sodium etc. are micro-class here).

- [ ] **Step 1: Write the failing test**

Hand-verified fixture (FDA fallback targets from `computeRdaProfile({})`: kcal 2000, protein 50, sodium limit 2300):

```typescript
// tests/unit/nutrients/week-analysis.test.ts
import { describe, it, expect } from "vitest";
import { computeRdaProfile } from "@/lib/nutrients/rda";
import {
  analyzeWeek,
  type PlannedMealInput,
  type WindowDayInput,
} from "@/lib/nutrients/week-analysis";

const rda = computeRdaProfile({}); // FDA fallback: kcal 2000, protein 50, sodium limit 2300

let mealSeq = 0;
function meal(
  perServing: PlannedMealInput["perServing"],
  over: Partial<PlannedMealInput> = {}
): PlannedMealInput {
  mealSeq += 1;
  return {
    mealId: `m${mealSeq}`,
    recipeId: `r${mealSeq}`,
    recipeTitle: `Recipe ${mealSeq}`,
    mealType: "dinner",
    servings: 1,
    coverage: "full",
    perServing,
    ...over,
  };
}

function day(date: string, meals: PlannedMealInput[]): WindowDayInput {
  return { date, planned: true, meals };
}

// Day1: sodium 2700 (over), protein 40, kcal 1500
// Day2: sodium 2800 (over), protein 25 (miss), kcal 1500
// Day3: sodium 500,         protein 20 (miss), kcal 700 (miss)
function fixture(): WindowDayInput[] {
  mealSeq = 0;
  return [
    day("2026-06-10", [
      meal({ kcal: 800, protein: 30, sodium: 1500 }), // m1
      meal({ kcal: 700, protein: 10, sodium: 1200 }), // m2
    ]),
    day("2026-06-11", [
      meal({ kcal: 900, protein: 15, sodium: 2000 }), // m3
      meal({ kcal: 600, protein: 10, sodium: 800 }),  // m4
    ]),
    day("2026-06-12", [
      meal({ kcal: 700, protein: 20, sodium: 500 }),  // m5
    ]),
  ];
}

describe("analyzeWeek", () => {
  it("emits a protein deficit ranked above the sodium excess", () => {
    const a = analyzeWeek(fixture(), rda);
    const kinds = a.findings.map((f) => `${f.kind}:${f.nutrient}`);
    expect(kinds[0]).toBe("deficit:protein");
    expect(kinds).toContain("excess:sodium");
  });

  it("computes deficit gap, days affected and severity", () => {
    const a = analyzeWeek(fixture(), rda);
    const p = a.findings.find((f) => f.nutrient === "protein")!;
    // gaps: (50-40)+(50-25)+(50-20) = 65 ; misses on day2+day3
    expect(p.weekGapAmount).toBeCloseTo(65);
    expect(p.daysAffected).toBe(2);
    expect(p.plannedDays).toBe(3);
    // (65 / (50*3)) * (2/3)
    expect(p.severity).toBeCloseTo(0.28889, 4);
  });

  it("computes excess gap and applies the 1.25 limit weight", () => {
    const a = analyzeWeek(fixture(), rda);
    const s = a.findings.find((f) => f.nutrient === "sodium")!;
    expect(s.kind).toBe("excess");
    expect(s.weekGapAmount).toBeCloseTo(900); // 400 + 500
    expect(s.daysAffected).toBe(2);
    // (900 / (2300*3)) * (2/3) * 1.25
    expect(s.severity).toBeCloseTo(0.108696, 4);
  });

  it("does not emit kcal findings when thresholds are not met", () => {
    const a = analyzeWeek(fixture(), rda);
    // only day3 under 0.7×2000; no day over 1.15×2000
    expect(a.findings.find((f) => f.nutrient === "kcal")).toBeUndefined();
  });

  it("attributes excess to the biggest sources, descending", () => {
    const a = analyzeWeek(fixture(), rda);
    const s = a.findings.find((f) => f.nutrient === "sodium")!;
    expect(s.topContributors.map((c) => c.mealId)).toEqual(["m3", "m1", "m2"]);
    expect(s.topContributors[0].share).toBeCloseTo(2000 / 6000);
  });

  it("attributes deficits to the lowest-amount meals, ascending", () => {
    const a = analyzeWeek(fixture(), rda);
    const p = a.findings.find((f) => f.nutrient === "protein")!;
    expect(p.topContributors.map((c) => c.mealId)).toEqual(["m2", "m4", "m3"]);
  });

  it("multiplies meal servings into day totals", () => {
    mealSeq = 0;
    const a = analyzeWeek(
      [day("2026-06-10", [meal({ kcal: 500 }, { servings: 2 })])],
      rda
    );
    expect(a.days[0].totals.kcal).toBeCloseTo(1000);
  });

  it("treats unknown nutrients as unknown, never zero", () => {
    mealSeq = 0;
    const a = analyzeWeek([day("2026-06-10", [meal({ kcal: 1000 })])], rda);
    expect("protein" in a.days[0].totals).toBe(false);
    // no known days for protein → no protein finding
    expect(a.findings.find((f) => f.nutrient === "protein")).toBeUndefined();
  });

  it("excludes unplanned days from all denominators", () => {
    const days = fixture();
    days.push({ date: "2026-06-13", planned: false, meals: [] });
    const a = analyzeWeek(days, rda);
    const p = a.findings.find((f) => f.nutrient === "protein")!;
    expect(p.plannedDays).toBe(3);
    expect(a.coverage.unplannedDays).toBe(1);
  });

  it("restricts findings to macro keys when most meals are macrosOnly", () => {
    mealSeq = 0;
    const days = [
      day("2026-06-10", [
        meal({ kcal: 700, protein: 10, fiber: 2 }, { coverage: "macrosOnly" }),
        meal({ kcal: 600, protein: 8, fiber: 1 }, { coverage: "macrosOnly" }),
        meal({ kcal: 500, protein: 9, sodium: 4000 }, { coverage: "full" }),
      ]),
    ];
    const a = analyzeWeek(days, rda);
    expect(a.microFindingsReliable).toBe(false);
    expect(a.findings.find((f) => f.nutrient === "sodium")).toBeUndefined();
    expect(a.findings.find((f) => f.nutrient === "protein")).toBeDefined();
  });

  it("reports day coverage as the worst meal coverage", () => {
    mealSeq = 0;
    const a = analyzeWeek(
      [day("2026-06-10", [meal({ kcal: 1 }), meal({ kcal: 1 }, { coverage: "partial" })])],
      rda
    );
    expect(a.days[0].coverage).toBe("partial");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit tests/unit/nutrients/week-analysis.test.ts`
Expected: FAIL — `Cannot find module '@/lib/nutrients/week-analysis'`

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/nutrients/week-analysis.ts
/**
 * Week-level nutrition analysis: planned meals vs personal daily targets.
 *
 * Emits structured, ranked Findings with per-meal attribution — the UI
 * builds sentences from ICU messages, this module only does math.
 * Sparse-vector rule applies throughout: a missing key is unknown, never
 * zero, and unknowns never count toward gaps or attributions.
 *
 * Pure module.
 *
 * @module lib/nutrients/week-analysis
 */

import { addVectors, scaleVector, type NutrientVector } from "@/lib/nutrients/extract";
import { ALL_NUTRIENT_KEYS, type NutrientKey } from "@/lib/nutrients/registry";
import type { NutrientCoverage } from "@/lib/nutrients/aggregate";
import type { RdaProfile } from "@/lib/nutrients/rda";

export interface PlannedMealInput {
  mealId: string;
  recipeId: string;
  recipeTitle: string;
  mealType: string;
  /** MealPlanMeal.servings — how many recipe servings this meal represents */
  servings: number;
  perServing: NutrientVector;
  coverage: NutrientCoverage;
}

export interface WindowDayInput {
  /** YYYY-MM-DD */
  date: string;
  planned: boolean;
  meals: PlannedMealInput[];
}

export interface DayAnalysis {
  date: string;
  planned: boolean;
  totals: NutrientVector;
  /** total / daily target; 1 = exactly met. Absent when nutrient unknown. */
  fill: Partial<Record<NutrientKey, number>>;
  coverage: NutrientCoverage;
  meals: PlannedMealInput[];
}

export interface MealContribution {
  mealId: string;
  recipeId: string;
  recipeTitle: string;
  date: string;
  mealType: string;
  /** This meal's week amount of the finding nutrient */
  amount: number;
  /** Fraction of the week total of that nutrient */
  share: number;
}

export type FindingKind = "deficit" | "excess";

export interface Finding {
  id: string;
  kind: FindingKind;
  nutrient: NutrientKey;
  daysAffected: number;
  plannedDays: number;
  weekGapAmount: number;
  severity: number;
  topContributors: MealContribution[];
}

export interface WeekCoverage {
  fullMeals: number;
  partialMeals: number;
  macrosOnlyMeals: number;
  totalMeals: number;
  unplannedDays: number;
}

export interface WeekAnalysis {
  generatedAt: string;
  days: DayAnalysis[];
  weekTotals: NutrientVector;
  avgPerPlannedDay: NutrientVector;
  findings: Finding[];
  microFindingsReliable: boolean;
  coverage: WeekCoverage;
  personalized: boolean;
}

const DEFICIT_FILL_FLOOR = 0.7;
const KCAL_EXCESS_CEILING = 1.15;
const MIN_EXCESS_DAYS = 2;
const LIMIT_SEVERITY_WEIGHT = 1.25;
const MAX_CONTRIBUTORS = 3;
const MACROS_ONLY_RELIABILITY_CUTOFF = 0.5;

/** Findings allowed when micro coverage is unreliable (stored Recipe macros). */
const MACRO_FINDING_KEYS: ReadonlySet<NutrientKey> = new Set(["kcal", "protein", "fiber"]);
/** Neutral macros never produce findings — kcal + satFat cover their story. */
const NO_FINDING_KEYS: ReadonlySet<NutrientKey> = new Set(["carbs", "fat"]);

const COVERAGE_RANK: Record<NutrientCoverage, number> = {
  full: 0,
  partial: 1,
  macrosOnly: 2,
};

function worstCoverage(meals: PlannedMealInput[]): NutrientCoverage {
  let worst: NutrientCoverage = "full";
  for (const m of meals) {
    if (COVERAGE_RANK[m.coverage] > COVERAGE_RANK[worst]) worst = m.coverage;
  }
  return worst;
}

interface WeekMeal extends PlannedMealInput {
  date: string;
  weekVector: NutrientVector;
}

function contribution(meal: WeekMeal, nutrient: NutrientKey, weekTotal: number): MealContribution {
  const amount = meal.weekVector[nutrient] ?? 0;
  return {
    mealId: meal.mealId,
    recipeId: meal.recipeId,
    recipeTitle: meal.recipeTitle,
    date: meal.date,
    mealType: meal.mealType,
    amount,
    share: weekTotal > 0 ? amount / weekTotal : 0,
  };
}

export function analyzeWeek(
  days: WindowDayInput[],
  rda: RdaProfile,
  now: Date = new Date()
): WeekAnalysis {
  const dayAnalyses: DayAnalysis[] = [];
  const allMeals: WeekMeal[] = [];

  for (const d of days) {
    const weekMeals: WeekMeal[] = d.meals.map((m) => ({
      ...m,
      date: d.date,
      weekVector: scaleVector(m.perServing, m.servings),
    }));
    allMeals.push(...weekMeals);

    const totals = weekMeals.reduce<NutrientVector>(
      (sum, m) => addVectors(sum, m.weekVector),
      {}
    );

    const fill: Partial<Record<NutrientKey, number>> = {};
    for (const key of Object.keys(totals) as NutrientKey[]) {
      const target = rda.entries[key]?.value;
      if (target && target > 0) fill[key] = (totals[key] as number) / target;
    }

    dayAnalyses.push({
      date: d.date,
      planned: d.planned,
      totals,
      fill,
      coverage: d.meals.length > 0 ? worstCoverage(d.meals) : "full",
      meals: d.meals,
    });
  }

  const plannedDayAnalyses = dayAnalyses.filter((d) => d.planned);
  const plannedDays = plannedDayAnalyses.length;
  const weekTotals = plannedDayAnalyses.reduce<NutrientVector>(
    (sum, d) => addVectors(sum, d.totals),
    {}
  );

  const coverage: WeekCoverage = {
    fullMeals: allMeals.filter((m) => m.coverage === "full").length,
    partialMeals: allMeals.filter((m) => m.coverage === "partial").length,
    macrosOnlyMeals: allMeals.filter((m) => m.coverage === "macrosOnly").length,
    totalMeals: allMeals.length,
    unplannedDays: days.filter((d) => !d.planned).length,
  };
  const microFindingsReliable =
    coverage.totalMeals === 0 ||
    coverage.macrosOnlyMeals / coverage.totalMeals <= MACROS_ONLY_RELIABILITY_CUTOFF;

  const findings: Finding[] = [];

  for (const nutrient of ALL_NUTRIENT_KEYS) {
    if (NO_FINDING_KEYS.has(nutrient)) continue;
    if (!microFindingsReliable && !MACRO_FINDING_KEYS.has(nutrient)) continue;

    const entry = rda.entries[nutrient];
    if (!entry || entry.value <= 0) continue;
    const target = entry.value;

    const knownDays = plannedDayAnalyses.filter((d) => d.totals[nutrient] !== undefined);
    if (knownDays.length === 0) continue;

    const totalsOf = (d: DayAnalysis) => d.totals[nutrient] as number;
    const weekTotal = weekTotals[nutrient] ?? 0;
    const knownMeals = allMeals.filter((m) => m.weekVector[nutrient] !== undefined);

    // Deficit: goal nutrients, plus kcal (neutral but headline-worthy)
    if (entry.direction === "goal" || nutrient === "kcal") {
      const misses = knownDays.filter((d) => totalsOf(d) < DEFICIT_FILL_FLOOR * target);
      if (misses.length >= Math.ceil(knownDays.length / 2)) {
        const gap = knownDays.reduce((s, d) => s + Math.max(0, target - totalsOf(d)), 0);
        if (gap > 0) {
          findings.push({
            id: `deficit:${nutrient}`,
            kind: "deficit",
            nutrient,
            daysAffected: misses.length,
            plannedDays,
            weekGapAmount: gap,
            severity:
              (gap / (target * knownDays.length)) * (misses.length / knownDays.length),
            topContributors: [...knownMeals]
              .sort((a, b) => (a.weekVector[nutrient] ?? 0) - (b.weekVector[nutrient] ?? 0))
              .slice(0, MAX_CONTRIBUTORS)
              .map((m) => contribution(m, nutrient, weekTotal)),
          });
        }
      }
    }

    // Excess: limit nutrients at their ceiling, kcal at 1.15× target
    const isLimit = entry.direction === "limit";
    if (isLimit || nutrient === "kcal") {
      const ceiling = isLimit ? target : KCAL_EXCESS_CEILING * target;
      const overs = knownDays.filter((d) => totalsOf(d) > ceiling);
      if (overs.length >= MIN_EXCESS_DAYS) {
        const gap = knownDays.reduce((s, d) => s + Math.max(0, totalsOf(d) - ceiling), 0);
        findings.push({
          id: `excess:${nutrient}`,
          kind: "excess",
          nutrient,
          daysAffected: overs.length,
          plannedDays,
          weekGapAmount: gap,
          severity:
            (gap / (ceiling * knownDays.length)) *
            (overs.length / knownDays.length) *
            (isLimit ? LIMIT_SEVERITY_WEIGHT : 1),
          topContributors: [...knownMeals]
            .sort((a, b) => (b.weekVector[nutrient] ?? 0) - (a.weekVector[nutrient] ?? 0))
            .slice(0, MAX_CONTRIBUTORS)
            .map((m) => contribution(m, nutrient, weekTotal)),
        });
      }
    }
  }

  findings.sort((a, b) => b.severity - a.severity);

  return {
    generatedAt: now.toISOString(),
    days: dayAnalyses,
    weekTotals,
    avgPerPlannedDay: plannedDays > 0 ? scaleVector(weekTotals, 1 / plannedDays) : {},
    findings,
    microFindingsReliable,
    coverage,
    personalized: rda.personalized,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit tests/unit/nutrients/week-analysis.test.ts`
Expected: PASS (11 tests). If a severity assertion fails, re-derive by hand before touching the engine — the fixture numbers above are pre-verified.

- [ ] **Step 5: Run the whole unit suite (no regressions)**

Run: `bun run test:unit`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/lib/nutrients/week-analysis.ts tests/unit/nutrients/week-analysis.test.ts
git commit -m "feat(nutrition-hub): week-analysis engine with ranked findings and attribution"
```

---

### Task 3: `swap-scorer` engine

**Files:**
- Create: `src/lib/nutrients/swap-scorer.ts`
- Test: `tests/unit/nutrients/swap-scorer.test.ts`

Rules:
- Week delta per nutrient: `(candidate.perServing[n] − meal.perServing[n]) × meal.servings`, only when **both** sides know `n`.
- Hard filters: candidate ≠ current recipe; candidate must know the target nutrient; both must know kcal and `|Δkcal_perServing| ≤ 0.25 × meal kcal`; allergen token match excludes.
- `gapClosure`: deficit → `Δ/gap`; excess → `−Δ/gap`. Suggestions below 0.05 are dropped.
- Penalty per **other** finding worsened: `|Δ| / finding.weekGapAmount`. `score = gapClosure − 0.5 × Σpenalties`.
- `tradeoffs[]`: any nutrient worsened beyond the week noise floor `{kcal: 100, g: 5, mg: 100, ug: 20}` (worsened = down for goal, up for limit, kcal excluded).

- [ ] **Step 1: Write the failing test**

```typescript
// tests/unit/nutrients/swap-scorer.test.ts
import { describe, it, expect } from "vitest";
import type { Finding, PlannedMealInput } from "@/lib/nutrients/week-analysis";
import {
  scoreSwaps,
  type SwapCandidate,
  type SwapContext,
} from "@/lib/nutrients/swap-scorer";

const oldMeal: PlannedMealInput = {
  mealId: "meal1",
  recipeId: "old",
  recipeTitle: "Carbonara",
  mealType: "dinner",
  servings: 1,
  coverage: "full",
  perServing: { kcal: 800, sodium: 1500, protein: 30 },
};

const sodiumExcess: Finding = {
  id: "excess:sodium",
  kind: "excess",
  nutrient: "sodium",
  daysAffected: 2,
  plannedDays: 3,
  weekGapAmount: 900,
  severity: 0.11,
  topContributors: [],
};

const proteinDeficit: Finding = {
  id: "deficit:protein",
  kind: "deficit",
  nutrient: "protein",
  daysAffected: 2,
  plannedDays: 3,
  weekGapAmount: 65,
  severity: 0.29,
  topContributors: [],
};

function candidate(
  id: string,
  perServing: SwapCandidate["perServing"],
  over: Partial<SwapCandidate> = {}
): SwapCandidate {
  return {
    recipeId: id,
    title: id,
    perServing,
    coverage: "full",
    ingredientNames: ["tomato", "rice"],
    ...over,
  };
}

function ctx(over: Partial<SwapContext> = {}): SwapContext {
  return {
    meal: oldMeal,
    target: sodiumExcess,
    findings: [proteinDeficit, sodiumExcess],
    allergies: [],
    ...over,
  };
}

describe("scoreSwaps", () => {
  it("ranks by gap closure and quantifies week deltas", () => {
    const out = scoreSwaps(ctx(), [
      candidate("good", { kcal: 750, sodium: 600, protein: 28 }),
      candidate("weak", { kcal: 780, sodium: 1200, protein: 30 }),
    ]);
    expect(out.map((s) => s.candidateRecipeId)).toEqual(["good", "weak"]);
    expect(out[0].deltas.sodium).toBeCloseTo(-900);
    expect(out[0].gapClosure).toBeCloseTo(1); // closes the whole 900mg gap
    expect(out[1].gapClosure).toBeCloseTo(300 / 900);
  });

  it("penalizes swaps that worsen another finding and lists the tradeoff", () => {
    const out = scoreSwaps(ctx(), [
      candidate("clean", { kcal: 780, sodium: 900, protein: 30 }),
      candidate("costly", { kcal: 780, sodium: 900, protein: 10 }),
    ]);
    const clean = out.find((s) => s.candidateRecipeId === "clean")!;
    const costly = out.find((s) => s.candidateRecipeId === "costly")!;
    // both close 600/900; costly loses 20g protein → penalty 20/65
    expect(clean.score).toBeGreaterThan(costly.score);
    expect(costly.score).toBeCloseTo(600 / 900 - 0.5 * (20 / 65), 4);
    expect(costly.tradeoffs).toContain("protein");
    expect(clean.tradeoffs).toEqual([]);
  });

  it("excludes candidates outside the ±25% kcal band", () => {
    const out = scoreSwaps(ctx(), [candidate("huge", { kcal: 1200, sodium: 100 })]);
    expect(out).toEqual([]);
  });

  it("excludes candidates that do not know the target nutrient", () => {
    const out = scoreSwaps(ctx(), [candidate("blind", { kcal: 790 })]);
    expect(out).toEqual([]);
  });

  it("excludes the current recipe and allergen matches", () => {
    const out = scoreSwaps(ctx({ allergies: ["peanut"] }), [
      candidate("old", { kcal: 800, sodium: 100 }),
      candidate("nutty", { kcal: 800, sodium: 100 }, { ingredientNames: ["peanut butter"] }),
    ]);
    expect(out).toEqual([]);
  });

  it("drops suggestions that close less than 5% of the gap", () => {
    const out = scoreSwaps(ctx(), [candidate("noop", { kcal: 800, sodium: 1480 })]);
    expect(out).toEqual([]); // closes 20/900 ≈ 2%
  });

  it("supports deficit targets (more of the nutrient closes the gap)", () => {
    const out = scoreSwaps(
      ctx({ target: proteinDeficit }),
      [candidate("protein-up", { kcal: 820, sodium: 1400, protein: 55 })]
    );
    expect(out[0].gapClosure).toBeCloseTo(25 / 65);
  });

  it("ignores below-floor noise in tradeoffs", () => {
    const out = scoreSwaps(ctx(), [
      candidate("noise", { kcal: 790, sodium: 600, protein: 28 }), // protein −2g < 5g floor
    ]);
    expect(out[0].tradeoffs).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test:unit tests/unit/nutrients/swap-scorer.test.ts`
Expected: FAIL — `Cannot find module '@/lib/nutrients/swap-scorer'`

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/nutrients/swap-scorer.ts
/**
 * Multi-objective swap ranking: how well does replacing one planned meal
 * with a candidate recipe close a Finding's week gap — without wrecking
 * other findings or hiding tradeoffs.
 *
 * A naive scorer that fixes fiber with a sodium bomb is worse than no
 * scorer; the penalty term and the honest tradeoffs[] are the point.
 *
 * Pure module.
 *
 * @module lib/nutrients/swap-scorer
 */

import { NUTRIENT_REGISTRY, type NutrientKey, type NutrientUnit } from "@/lib/nutrients/registry";
import type { NutrientVector } from "@/lib/nutrients/extract";
import type { NutrientCoverage } from "@/lib/nutrients/aggregate";
import type { Finding, PlannedMealInput } from "@/lib/nutrients/week-analysis";

export interface SwapCandidate {
  recipeId: string;
  title: string;
  perServing: NutrientVector;
  coverage: NutrientCoverage;
  /** Normalized ingredient names/lines for allergen filtering */
  ingredientNames: string[];
}

export interface SwapContext {
  meal: PlannedMealInput;
  /** The finding this swap should fix */
  target: Finding;
  /** All active findings — worsening any of them is penalized */
  findings: Finding[];
  /** Lowercased allergen tokens from UserProfile.allergies */
  allergies: string[];
}

export interface SwapSuggestion {
  mealId: string;
  candidateRecipeId: string;
  candidateTitle: string;
  /** Week-level deltas, only for nutrients both sides know */
  deltas: NutrientVector;
  /** Fraction of the target finding's weekGapAmount this swap closes */
  gapClosure: number;
  /** Nutrients made meaningfully worse by this swap */
  tradeoffs: NutrientKey[];
  score: number;
}

const KCAL_BAND = 0.25;
const MIN_GAP_CLOSURE = 0.05;
const PENALTY_WEIGHT = 0.5;
/** Week-level noise floors per unit — changes below these are not tradeoffs */
const TRADEOFF_FLOOR: Record<NutrientUnit, number> = { kcal: 100, g: 5, mg: 100, ug: 20 };

function hasAllergen(candidate: SwapCandidate, allergies: string[]): boolean {
  if (allergies.length === 0) return false;
  const names = candidate.ingredientNames.map((n) => n.toLowerCase());
  return allergies.some((a) => {
    const token = a.trim().toLowerCase();
    return token.length > 0 && names.some((n) => n.includes(token));
  });
}

/** Positive delta hurts limit nutrients; negative delta hurts goal nutrients. */
function worsens(key: NutrientKey, delta: number): boolean {
  const def = NUTRIENT_REGISTRY[key];
  if (def.direction === "limit") return delta > 0;
  if (def.direction === "goal") return delta < 0;
  return false;
}

export function scoreSwaps(ctx: SwapContext, candidates: SwapCandidate[]): SwapSuggestion[] {
  const { meal, target, findings, allergies } = ctx;
  const mealKcal = meal.perServing.kcal;
  const suggestions: SwapSuggestion[] = [];

  for (const cand of candidates) {
    if (cand.recipeId === meal.recipeId) continue;
    if (cand.perServing[target.nutrient] === undefined) continue;
    if (meal.perServing[target.nutrient] === undefined) continue;
    if (hasAllergen(cand, allergies)) continue;

    const candKcal = cand.perServing.kcal;
    if (mealKcal === undefined || candKcal === undefined) continue;
    if (Math.abs(candKcal - mealKcal) > KCAL_BAND * mealKcal) continue;

    const deltas: NutrientVector = {};
    for (const key of Object.keys(cand.perServing) as NutrientKey[]) {
      const before = meal.perServing[key];
      if (before === undefined) continue;
      deltas[key] = ((cand.perServing[key] as number) - before) * meal.servings;
    }

    const targetDelta = deltas[target.nutrient] as number;
    const gapClosure =
      target.kind === "excess"
        ? -targetDelta / target.weekGapAmount
        : targetDelta / target.weekGapAmount;
    if (gapClosure < MIN_GAP_CLOSURE) continue;

    let penalty = 0;
    for (const f of findings) {
      if (f.id === target.id) continue;
      const d = deltas[f.nutrient];
      if (d === undefined || f.weekGapAmount <= 0) continue;
      const hurts = f.kind === "deficit" ? d < 0 : d > 0;
      if (hurts) penalty += Math.abs(d) / f.weekGapAmount;
    }

    const tradeoffs = (Object.keys(deltas) as NutrientKey[]).filter((key) => {
      if (key === target.nutrient || key === "kcal") return false;
      const d = deltas[key] as number;
      return worsens(key, d) && Math.abs(d) >= TRADEOFF_FLOOR[NUTRIENT_REGISTRY[key].unit];
    });

    suggestions.push({
      mealId: meal.mealId,
      candidateRecipeId: cand.recipeId,
      candidateTitle: cand.title,
      deltas,
      gapClosure,
      tradeoffs,
      score: gapClosure - PENALTY_WEIGHT * penalty,
    });
  }

  return suggestions.sort((a, b) => b.score - a.score);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test:unit tests/unit/nutrients/swap-scorer.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/nutrients/swap-scorer.ts tests/unit/nutrients/swap-scorer.test.ts
git commit -m "feat(nutrition-hub): multi-objective swap scorer with honest tradeoffs"
```

---

## Phase B — Data plumbing

### Task 4: Batched recipe-profile resolver

**Files:**
- Create: `src/lib/recipeNutrients.ts`
- Modify: `src/actions/nutrition-hub.ts` (delete local `buildRecipeProfile` + the `RecipeNutrientProfile` interface, import from the lib, re-export the type)

The week needs ~21 recipe profiles in 2 queries (1 prisma + 1 `getFoodsCached`), not 21 sequential lookups. The logic is a batched lift of v1's `buildRecipeProfile` (`src/actions/nutrition-hub.ts:113-179`) — same coverage semantics, same macrosOnly fallback to the stored `Recipe` macros.

- [ ] **Step 1: Create the lib**

```typescript
// src/lib/recipeNutrients.ts
/**
 * Batched recipe → nutrient-profile resolution. One prisma query for all
 * recipes, one getFoodsCached call for all distinct fdcIds — rate-limit
 * friendly for week-level analysis (~21 meals).
 *
 * Server-only (imports prisma). USDA FDC only — never Edamam.
 *
 * @module lib/recipeNutrients
 */

import { prisma } from "@/lib/prisma";
import { getFoodsCached } from "@/lib/fdcRepo";
import { extractNutrientVector, type NutrientVector } from "@/lib/nutrients/extract";
import {
  aggregateRecipeNutrients,
  type IngredientContribution,
  type NutrientCoverage,
} from "@/lib/nutrients/aggregate";

export interface RecipeNutrientProfile {
  kind: "recipe";
  recipeId: string;
  title: string;
  servings: number;
  imageUrl: string | null;
  /** Nutrients per serving (sparse — missing key means unknown, not zero) */
  perServing: NutrientVector;
  coverage: NutrientCoverage;
  matchedIngredients: number;
  totalIngredients: number;
}

/**
 * Resolve nutrient profiles for the given recipes (ownership enforced by
 * the userId filter — silently omits recipes the user does not own).
 */
export async function getRecipeNutrientProfiles(
  recipeIds: string[],
  userId: string
): Promise<Map<string, RecipeNutrientProfile>> {
  const result = new Map<string, RecipeNutrientProfile>();
  const distinct = [...new Set(recipeIds)];
  if (distinct.length === 0) return result;

  const recipes = await prisma.recipe.findMany({
    where: { id: { in: distinct }, userId },
    include: { recipeIngredients: true },
  });

  const allFdcIds = new Set<number>();
  for (const recipe of recipes) {
    for (const ri of recipe.recipeIngredients) {
      if (ri.fdcId != null && ri.gramWeight != null && ri.gramWeight > 0) {
        allFdcIds.add(ri.fdcId);
      }
    }
  }
  const foods = await getFoodsCached([...allFdcIds], { profile: "extended" });
  const foodById = new Map(foods.map((f) => [f.fdcId, f]));

  for (const recipe of recipes) {
    const matched = recipe.recipeIngredients.filter(
      (ri) => ri.fdcId != null && ri.gramWeight != null && ri.gramWeight > 0
    );
    const unmatchedCount = recipe.recipeIngredients.length - matched.length;

    const contributions: IngredientContribution[] = [];
    let unresolved = 0;
    for (const ri of matched) {
      const food = foodById.get(ri.fdcId as number);
      if (!food) {
        unresolved++;
        continue;
      }
      contributions.push({
        gramWeight: ri.gramWeight as number,
        vectorPer100g: extractNutrientVector(food),
      });
    }

    const aggregation = aggregateRecipeNutrients(
      contributions,
      unmatchedCount + unresolved,
      recipe.servings
    );

    // No usable FDC matches: fall back to the 5 per-serving macros stored
    // on the Recipe row (covers manual and Edamam-sourced recipes without
    // re-exposing any Edamam detail).
    const perServing: NutrientVector =
      aggregation.coverage === "macrosOnly"
        ? {
            ...(recipe.calories != null && { kcal: recipe.calories }),
            ...(recipe.protein != null && { protein: recipe.protein }),
            ...(recipe.carbs != null && { carbs: recipe.carbs }),
            ...(recipe.fat != null && { fat: recipe.fat }),
            ...(recipe.fiber != null && { fiber: recipe.fiber }),
          }
        : aggregation.perServing;

    result.set(recipe.id, {
      kind: "recipe",
      recipeId: recipe.id,
      title: recipe.title,
      servings: recipe.servings,
      imageUrl: recipe.imageUrl ?? null,
      perServing,
      coverage: aggregation.coverage,
      matchedIngredients: aggregation.matchedIngredients,
      totalIngredients: aggregation.totalIngredients,
    });
  }

  return result;
}
```

- [ ] **Step 2: Refactor `src/actions/nutrition-hub.ts`**

Delete the local `RecipeNutrientProfile` interface (lines 45-56) and the whole `buildRecipeProfile` function (lines 113-179). Delete the now-unused imports of `aggregateRecipeNutrients`, `IngredientContribution`, and `prisma` **only if** nothing else in the file uses them (`prisma` is still used by `getMyRdaProfile` and `searchMyRecipes` — keep it; `NutrientCoverage` is still used — keep it). Add:

```typescript
import {
  getRecipeNutrientProfiles,
  type RecipeNutrientProfile,
} from "@/lib/recipeNutrients";

export type { RecipeNutrientProfile };

async function buildRecipeProfile(
  recipeId: string,
  userId: string
): Promise<RecipeNutrientProfile> {
  const profiles = await getRecipeNutrientProfiles([recipeId], userId);
  const profile = profiles.get(recipeId);
  if (!profile) throw new Error("Recipe not found");
  return profile;
}
```

`getItemProfiles` keeps calling `buildRecipeProfile(item.id, ctx.user.id)` unchanged. The `ItemNutrientProfile` union keeps compiling because the re-exported type is structurally identical.

- [ ] **Step 3: Verify types and tests**

Run: `bun tsc --noEmit`
Expected: clean.
Run: `bun run test:unit`
Expected: all green (no existing test imports the moved function).

- [ ] **Step 4: Commit**

```bash
git add src/lib/recipeNutrients.ts src/actions/nutrition-hub.ts
git commit -m "refactor(nutrition-hub): extract batched recipe nutrient-profile resolver"
```

---

### Task 5: `matchRecipeIngredients` — persist FDC matches (the keystone)

**Files:**
- Create: `src/actions/nutrition-week.ts` (first two exports; the file grows in later tasks)

Discovery: `analyzeRecipeAction` (`src/actions/analyzeRecipe.ts:245`) computes `fdcId`, `gramsTotal`, `confidence` per ingredient but **nothing persists `RecipeIngredient` rows anywhere in the repo**. This action closes that gap and powers the "Improve your data" card. The result items align 1:1 with non-empty trimmed input lines (the analyzer filters `line.trim().length > 0` — we pre-filter identically so the zip with `parseIngredientLine` stays aligned).

- [ ] **Step 1: Create the action file**

```typescript
// src/actions/nutrition-week.ts
"use server";

/**
 * "Fix My Week" server actions — thin orchestration over the pure
 * lib/nutrients engines. USDA FDC only: this file must never import
 * from lib/edamam* (per-user macro cache policy).
 */

import { z } from "zod";
import { serverAction } from "@/lib/server-action";
import { prisma } from "@/lib/prisma";
import { analyzeRecipeAction } from "@/actions/analyzeRecipe";
import { formatIngredientsForNutrition, parseIngredientLine } from "@/lib/ingredients";

export interface IngredientMatchSummary {
  matched: number;
  total: number;
}

/**
 * Run USDA FDC matching over a recipe's stored ingredients and persist
 * the matches as RecipeIngredient rows (replacing any previous rows).
 * Stored Recipe macros are NOT touched.
 */
async function persistIngredientMatches(recipe: {
  id: string;
  ingredients: unknown;
  servings: number;
}): Promise<IngredientMatchSummary> {
  const lines = formatIngredientsForNutrition(recipe.ingredients).filter(
    (line) => line.trim().length > 0
  );
  if (lines.length === 0) {
    throw new Error("Recipe has no ingredients to analyze");
  }

  const analysis = await analyzeRecipeAction({
    ingredients: lines,
    servings: recipe.servings,
  });
  if (!analysis.success) {
    throw new Error(analysis.error ?? "Ingredient analysis failed");
  }

  const parsed = lines.map(parseIngredientLine);
  const rows = analysis.items.map((item, i) => ({
    recipeId: recipe.id,
    originalText: item.original,
    nameNorm: item.name,
    qty: parsed[i]?.qty ?? 0,
    unit: parsed[i]?.unit ?? "",
    fdcId: item.fdcId,
    gramWeight: item.gramsTotal > 0 ? item.gramsTotal : null,
    confidence: item.confidence,
  }));

  await prisma.$transaction([
    prisma.recipeIngredient.deleteMany({ where: { recipeId: recipe.id } }),
    prisma.recipeIngredient.createMany({ data: rows }),
  ]);

  return {
    matched: rows.filter((r) => r.fdcId != null).length,
    total: rows.length,
  };
}

const matchRecipeIngredientsSchema = z.object({
  recipeId: z.string().uuid(),
});

/** One-tap data fix: match + persist a recipe's ingredients against USDA. */
export async function matchRecipeIngredients(input: { recipeId: string }) {
  return serverAction(
    {
      input: matchRecipeIngredientsSchema,
      revalidates: ["/nutrition/my-week"],
    },
    async (ctx, validated): Promise<IngredientMatchSummary> => {
      const recipe = await prisma.recipe.findUnique({
        where: { id: validated.recipeId },
        select: { id: true, userId: true, ingredients: true, servings: true },
      });
      if (!recipe || recipe.userId !== ctx.user.id) {
        throw new Error("Recipe not found");
      }
      return persistIngredientMatches(recipe);
    }
  )(input);
}
```

- [ ] **Step 2: Verify types**

Run: `bun tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/actions/nutrition-week.ts
git commit -m "feat(nutrition-hub): persist USDA ingredient matches (matchRecipeIngredients)"
```

---

### Task 6: `getMyWeekAnalysis`

**Files:**
- Modify: `src/actions/nutrition-week.ts` (append)

- [ ] **Step 1: Append imports and the week loader**

Add to the import block at the top of `src/actions/nutrition-week.ts`:

```typescript
import { resolveScheduleWindow } from "@/lib/nutrients/schedule-window";
import {
  analyzeWeek,
  type PlannedMealInput,
  type WeekAnalysis,
  type WindowDayInput,
} from "@/lib/nutrients/week-analysis";
import { computeRdaProfile, type RdaProfile } from "@/lib/nutrients/rda";
import { getRecipeNutrientProfiles } from "@/lib/recipeNutrients";
import type { NutrientCoverage } from "@/lib/nutrients/aggregate";
```

Append below `matchRecipeIngredients`:

```typescript
export interface ImproveDataItem {
  recipeId: string;
  title: string;
  coverage: NutrientCoverage;
}

export interface MyWeekData {
  hasActivePlan: boolean;
  analysis: WeekAnalysis;
  improveData: ImproveDataItem[];
  profileComplete: boolean;
}

interface LoadedWeek {
  days: WindowDayInput[];
  rda: RdaProfile;
  profileComplete: boolean;
  hasActivePlan: boolean;
  /** mealId → meal input, for swap actions */
  mealsById: Map<string, PlannedMealInput>;
  improveData: ImproveDataItem[];
}

/** Shared loader: schedules → window → batched profiles → engine inputs. */
async function loadWeek(userId: string): Promise<LoadedWeek> {
  const [profile, schedules] = await Promise.all([
    prisma.userProfile.findUnique({ where: { userId } }),
    prisma.mealPlanSchedule.findMany({
      where: { userId, status: "active" },
      include: {
        template: {
          include: {
            days: {
              include: {
                meals: {
                  where: { recipeId: { not: null } },
                  include: {
                    recipe: { select: { id: true, title: true } },
                  },
                  orderBy: { sortOrder: "asc" },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  const rda = computeRdaProfile({
    dateOfBirth: profile?.dateOfBirth ?? null,
    gender: profile?.gender ?? null,
    weightKg: profile?.weightKg ?? null,
    dailyCalories: profile?.dailyCalories ?? null,
    proteinGrams: profile?.proteinGrams ?? null,
    carbsGrams: profile?.carbsGrams ?? null,
    fatGrams: profile?.fatGrams ?? null,
  });

  const window = resolveScheduleWindow(
    schedules.map((s) => ({
      id: s.id,
      startDate: s.startDate,
      duration: s.template.duration,
    })),
    new Date()
  );

  const scheduleById = new Map(schedules.map((s) => [s.id, s]));
  const recipeIds = new Set<string>();
  for (const w of window) {
    if (!w.scheduleId || w.dayNumber === null) continue;
    const day = scheduleById
      .get(w.scheduleId)
      ?.template.days.find((d) => d.dayNumber === w.dayNumber);
    for (const m of day?.meals ?? []) {
      if (m.recipe) recipeIds.add(m.recipe.id);
    }
  }

  const profiles = await getRecipeNutrientProfiles([...recipeIds], userId);

  const mealsById = new Map<string, PlannedMealInput>();
  const days: WindowDayInput[] = window.map((w) => {
    if (!w.scheduleId || w.dayNumber === null) {
      return { date: w.date, planned: false, meals: [] };
    }
    const day = scheduleById
      .get(w.scheduleId)
      ?.template.days.find((d) => d.dayNumber === w.dayNumber);
    const meals: PlannedMealInput[] = [];
    for (const m of day?.meals ?? []) {
      const p = m.recipe ? profiles.get(m.recipe.id) : undefined;
      if (!p) continue;
      const input: PlannedMealInput = {
        mealId: m.id,
        recipeId: p.recipeId,
        recipeTitle: p.title,
        mealType: m.mealType,
        servings: m.servings,
        perServing: p.perServing,
        coverage: p.coverage,
      };
      meals.push(input);
      mealsById.set(m.id, input);
    }
    return { date: w.date, planned: true, meals };
  });

  const improveData: ImproveDataItem[] = [...profiles.values()]
    .filter((p) => p.coverage !== "full")
    .map((p) => ({ recipeId: p.recipeId, title: p.title, coverage: p.coverage }));

  return {
    days,
    rda,
    profileComplete: Boolean(profile?.dateOfBirth && profile?.gender),
    hasActivePlan: window.some((w) => w.dayNumber !== null),
    mealsById,
    improveData,
  };
}

/** Analyze the next 7 planned days against the user's personal targets. */
export async function getMyWeekAnalysis() {
  return serverAction({}, async (ctx): Promise<MyWeekData> => {
    const week = await loadWeek(ctx.user.id);
    return {
      hasActivePlan: week.hasActivePlan,
      analysis: analyzeWeek(week.days, week.rda),
      improveData: week.improveData,
      profileComplete: week.profileComplete,
    };
  })(undefined);
}
```

- [ ] **Step 2: Verify types and suite**

Run: `bun tsc --noEmit && bun run test:unit`
Expected: clean / all green.

- [ ] **Step 3: Commit**

```bash
git add src/actions/nutrition-week.ts
git commit -m "feat(nutrition-hub): getMyWeekAnalysis action over schedule window"
```

---

## Phase C — Read-only My Week (shippable)

### Task 7: i18n keys (all three locales in one step)

**Files:**
- Modify: `messages/en.json`, `messages/es.json`, `messages/pl.json`

Insert a `"myWeek"` object inside the existing `"nutritionHub"` namespace (sibling of `"hub"`, `"swaps"`, …) in **each** file. The parity test compares the whole `nutritionHub` subtree, so any drift fails CI. Nutrient display names reuse `nutritionHub.nutrients.{key}.name` — do not duplicate them.

- [ ] **Step 1: Add to `messages/en.json`**

```json
"myWeek": {
  "kicker": "Your Week",
  "title": "Fix My Week",
  "description": "Your planned week, measured against your personal targets — and the one thing to change first.",
  "module": {
    "kicker": "Act",
    "title": "Fix My Week",
    "blurb": "See how your planned week really measures up, and fix it in one tap."
  },
  "hero": {
    "eyebrow": "This week",
    "ok": "Your planned week looks balanced",
    "findings": "{count, plural, one {# thing} other {# things}} worth fixing this week",
    "cta": "Open My Week"
  },
  "empty": {
    "title": "No active meal plan",
    "body": "Schedule a meal plan and we'll analyze your week against your personal nutrient targets.",
    "cta": "Go to meal plans"
  },
  "strip": { "unplanned": "No plan", "kcalShort": "{kcal} kcal" },
  "findings": {
    "heading": "What to fix first",
    "deficitTitle": "Low {nutrient}",
    "excessTitle": "Too much {nutrient}",
    "deficitMeta": "Short on {days} of {plannedDays, plural, one {# planned day} other {# planned days}}",
    "excessMeta": "Over your limit on {days} of {plannedDays, plural, one {# planned day} other {# planned days}}",
    "weekGapDeficit": "{amount} short across the week",
    "weekGapExcess": "{amount} over across the week",
    "sourcesExcess": "Biggest sources",
    "sourcesDeficit": "Best places to improve",
    "contributorShare": "{share}% of the week",
    "none": "Your planned week looks balanced. Nicely done."
  },
  "swaps": {
    "show": "Show fixes",
    "loading": "Finding fixes…",
    "closes": "closes {pct}% of the gap",
    "tradeoffs": "Watch: {nutrients}",
    "apply": "Apply",
    "applying": "Applying…",
    "applied": "Swapped to {to}",
    "undo": "Undo",
    "none": "No good fit in your recipe library for this one.",
    "generate": "Generate a recipe that fixes this",
    "generating": "Cooking up a recipe…",
    "generated": "Created \"{title}\" — nutrition verified with USDA data",
    "generateFailed": "Couldn't generate a recipe this time. Try again."
  },
  "improveData": {
    "title": "Improve your data",
    "body": "{count, plural, one {# recipe in your week has} other {# recipes in your week have}} incomplete ingredient data, so micronutrient analysis is limited.",
    "analyze": "Analyze ingredients",
    "analyzing": "Analyzing…",
    "done": "Matched {matched} of {total} ingredients"
  },
  "detail": {
    "show": "Show full week detail",
    "hide": "Hide full week detail",
    "nutrient": "Nutrient"
  },
  "basis": { "personalized": "Personalized targets", "generic": "Generic daily values" }
}
```

- [ ] **Step 2: Add to `messages/es.json`**

```json
"myWeek": {
  "kicker": "Tu Semana",
  "title": "Arregla Mi Semana",
  "description": "Tu semana planificada, medida contra tus objetivos personales — y lo primero que conviene cambiar.",
  "module": {
    "kicker": "Actúa",
    "title": "Arregla Mi Semana",
    "blurb": "Mira cómo va de verdad tu semana planificada y arréglala con un toque."
  },
  "hero": {
    "eyebrow": "Esta semana",
    "ok": "Tu semana planificada se ve equilibrada",
    "findings": "{count, plural, one {# cosa} other {# cosas}} por mejorar esta semana",
    "cta": "Abrir Mi Semana"
  },
  "empty": {
    "title": "Sin plan de comidas activo",
    "body": "Programa un plan de comidas y analizaremos tu semana contra tus objetivos nutricionales personales.",
    "cta": "Ir a planes de comida"
  },
  "strip": { "unplanned": "Sin plan", "kcalShort": "{kcal} kcal" },
  "findings": {
    "heading": "Qué arreglar primero",
    "deficitTitle": "Poco {nutrient}",
    "excessTitle": "Demasiado {nutrient}",
    "deficitMeta": "Por debajo en {days} de {plannedDays, plural, one {# día planificado} other {# días planificados}}",
    "excessMeta": "Sobre tu límite en {days} de {plannedDays, plural, one {# día planificado} other {# días planificados}}",
    "weekGapDeficit": "Faltan {amount} en la semana",
    "weekGapExcess": "{amount} de más en la semana",
    "sourcesExcess": "Mayores fuentes",
    "sourcesDeficit": "Mejores oportunidades de mejora",
    "contributorShare": "{share}% de la semana",
    "none": "Tu semana planificada se ve equilibrada. ¡Bien hecho!"
  },
  "swaps": {
    "show": "Ver soluciones",
    "loading": "Buscando soluciones…",
    "closes": "cierra el {pct}% de la brecha",
    "tradeoffs": "Ojo: {nutrients}",
    "apply": "Aplicar",
    "applying": "Aplicando…",
    "applied": "Cambiado a {to}",
    "undo": "Deshacer",
    "none": "No hay buen candidato en tus recetas para esto.",
    "generate": "Generar una receta que lo arregle",
    "generating": "Cocinando una receta…",
    "generated": "Creada \"{title}\" — nutrición verificada con datos USDA",
    "generateFailed": "No se pudo generar una receta esta vez. Intenta de nuevo."
  },
  "improveData": {
    "title": "Mejora tus datos",
    "body": "{count, plural, one {# receta de tu semana tiene} other {# recetas de tu semana tienen}} datos de ingredientes incompletos, así que el análisis de micronutrientes es limitado.",
    "analyze": "Analizar ingredientes",
    "analyzing": "Analizando…",
    "done": "Coincidieron {matched} de {total} ingredientes"
  },
  "detail": {
    "show": "Ver detalle completo de la semana",
    "hide": "Ocultar detalle completo",
    "nutrient": "Nutriente"
  },
  "basis": { "personalized": "Objetivos personalizados", "generic": "Valores diarios genéricos" }
}
```

- [ ] **Step 3: Add to `messages/pl.json`**

```json
"myWeek": {
  "kicker": "Twój Tydzień",
  "title": "Napraw Mój Tydzień",
  "description": "Twój zaplanowany tydzień zmierzony względem Twoich osobistych celów — i to, co warto zmienić najpierw.",
  "module": {
    "kicker": "Działaj",
    "title": "Napraw Mój Tydzień",
    "blurb": "Zobacz, jak naprawdę wygląda Twój zaplanowany tydzień, i napraw go jednym dotknięciem."
  },
  "hero": {
    "eyebrow": "W tym tygodniu",
    "ok": "Twój zaplanowany tydzień wygląda na zbilansowany",
    "findings": "{count, plural, one {# rzecz} few {# rzeczy} many {# rzeczy} other {# rzeczy}} do poprawy w tym tygodniu",
    "cta": "Otwórz Mój Tydzień"
  },
  "empty": {
    "title": "Brak aktywnego planu posiłków",
    "body": "Zaplanuj posiłki, a przeanalizujemy Twój tydzień względem Twoich osobistych celów żywieniowych.",
    "cta": "Przejdź do planów posiłków"
  },
  "strip": { "unplanned": "Brak planu", "kcalShort": "{kcal} kcal" },
  "findings": {
    "heading": "Co naprawić najpierw",
    "deficitTitle": "Za mało: {nutrient}",
    "excessTitle": "Za dużo: {nutrient}",
    "deficitMeta": "Poniżej celu przez {days} z {plannedDays, plural, one {# zaplanowanego dnia} few {# zaplanowanych dni} many {# zaplanowanych dni} other {# zaplanowanych dni}}",
    "excessMeta": "Powyżej limitu przez {days} z {plannedDays, plural, one {# zaplanowanego dnia} few {# zaplanowanych dni} many {# zaplanowanych dni} other {# zaplanowanych dni}}",
    "weekGapDeficit": "Brakuje {amount} w skali tygodnia",
    "weekGapExcess": "{amount} za dużo w skali tygodnia",
    "sourcesExcess": "Największe źródła",
    "sourcesDeficit": "Najlepsze okazje do poprawy",
    "contributorShare": "{share}% tygodnia",
    "none": "Twój zaplanowany tydzień wygląda na zbilansowany. Dobra robota!"
  },
  "swaps": {
    "show": "Pokaż rozwiązania",
    "loading": "Szukanie rozwiązań…",
    "closes": "zamyka {pct}% luki",
    "tradeoffs": "Uwaga: {nutrients}",
    "apply": "Zastosuj",
    "applying": "Stosowanie…",
    "applied": "Zmieniono na {to}",
    "undo": "Cofnij",
    "none": "Brak dobrego kandydata w Twoich przepisach.",
    "generate": "Wygeneruj przepis, który to naprawi",
    "generating": "Gotowanie przepisu…",
    "generated": "Utworzono \"{title}\" — wartości odżywcze zweryfikowane danymi USDA",
    "generateFailed": "Nie udało się wygenerować przepisu. Spróbuj ponownie."
  },
  "improveData": {
    "title": "Popraw swoje dane",
    "body": "{count, plural, one {# przepis w Twoim tygodniu ma} few {# przepisy w Twoim tygodniu mają} many {# przepisów w Twoim tygodniu ma} other {# przepisów w Twoim tygodniu ma}} niekompletne dane składników, więc analiza mikroelementów jest ograniczona.",
    "analyze": "Analizuj składniki",
    "analyzing": "Analizowanie…",
    "done": "Dopasowano {matched} z {total} składników"
  },
  "detail": {
    "show": "Pokaż pełne szczegóły tygodnia",
    "hide": "Ukryj pełne szczegóły",
    "nutrient": "Składnik"
  },
  "basis": { "personalized": "Cele spersonalizowane", "generic": "Ogólne wartości dzienne" }
}
```

- [ ] **Step 4: Run the parity test**

Run: `bun run test:unit tests/unit/i18n-nutrition-hub-parity.test.ts`
Expected: PASS — if it fails it prints the missing/extra key paths; fix the JSON until parity is exact.

- [ ] **Step 5: Commit**

```bash
git add messages/en.json messages/es.json messages/pl.json
git commit -m "feat(nutrition-hub): myWeek i18n strings (en/es/pl)"
```

---

### Task 8: My Week route — read-only board

**Files:**
- Create: `src/app/[locale]/(protected-pages)/nutrition/my-week/page.tsx`
- Create: `src/components/nutrition-hub/my-week/MyWeekBoard.tsx`
- Create: `src/components/nutrition-hub/my-week/WeekStrip.tsx`
- Create: `src/components/nutrition-hub/my-week/FindingCard.tsx` (read-only for now; swaps wired in Task 10)
- Create: `src/components/nutrition-hub/my-week/WeekHeatmap.tsx`
- Modify: `src/app/[locale]/(protected-pages)/nutrition/page.tsx` (module entry)

Design-system rules (from v1): coral `brand` = action/over, `sage` = healthy/on-track, `gold` = watch, `font-display` headings, `font-mono` numbers, `animate-fade-up` staggered reveals, em-dash for unknown values. Reuse `displayUnit`/`formatNutrientAmount` from `src/components/nutrition-hub/format.ts`, `EducationalDisclaimer` from `shared/`, `ProfileNudge` from `vs-day/`.

- [ ] **Step 1: Route page**

```tsx
// src/app/[locale]/(protected-pages)/nutrition/my-week/page.tsx
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { CalendarRange, CalendarPlus } from "lucide-react";
import { PageContainer } from "@/components/ui/page-container";
import { getMyWeekAnalysis } from "@/actions/nutrition-week";
import { MyWeekBoard } from "@/components/nutrition-hub/my-week/MyWeekBoard";
import { EducationalDisclaimer } from "@/components/nutrition-hub/shared/EducationalDisclaimer";

export default async function MyWeekPage() {
  const t = await getTranslations("nutritionHub.myWeek");
  const result = await getMyWeekAnalysis();

  return (
    <div className="min-h-screen relative bg-background">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-sage-100/30 dark:bg-sage-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-80 h-80 bg-brand-100/20 dark:bg-brand-500/5 rounded-full blur-3xl" />
      </div>

      <PageContainer className="space-y-8">
        <div className="space-y-3 animate-fade-up">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-gradient-to-br from-sage-100 to-sage-50 dark:from-sage-500/20 dark:to-sage-500/10 border border-sage-200/50 dark:border-sage-500/20">
              <CalendarRange className="w-5 h-5 text-sage-600 dark:text-sage-400" />
            </div>
            <span className="text-xs font-semibold text-sage-600 dark:text-sage-400 uppercase tracking-widest">
              {t("kicker")}
            </span>
          </div>
          <h1 className="text-3xl lg:text-4xl font-display font-bold text-foreground tracking-tight">
            {t("title")}
          </h1>
          <p className="text-muted-foreground max-w-lg leading-relaxed">{t("description")}</p>
        </div>

        {result.error !== null || !result.data.hasActivePlan ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center space-y-4 animate-fade-up">
            <CalendarPlus className="w-10 h-10 mx-auto text-muted-foreground" />
            <h2 className="font-display font-bold text-xl">{t("empty.title")}</h2>
            <p className="text-muted-foreground max-w-md mx-auto">{t("empty.body")}</p>
            <Link
              href="/meal-plans"
              className="inline-flex items-center rounded-full bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 text-sm font-medium transition-colors"
            >
              {t("empty.cta")}
            </Link>
          </div>
        ) : (
          <MyWeekBoard initial={result.data} />
        )}

        <EducationalDisclaimer />
      </PageContainer>
    </div>
  );
}
```

- [ ] **Step 2: Client board**

```tsx
// src/components/nutrition-hub/my-week/MyWeekBoard.tsx
"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { getMyWeekAnalysis, type MyWeekData } from "@/actions/nutrition-week";
import { WeekStrip } from "@/components/nutrition-hub/my-week/WeekStrip";
import { FindingCard } from "@/components/nutrition-hub/my-week/FindingCard";
import { WeekHeatmap } from "@/components/nutrition-hub/my-week/WeekHeatmap";
import { ImproveDataCard } from "@/components/nutrition-hub/my-week/ImproveDataCard";
import { ProfileNudge } from "@/components/nutrition-hub/vs-day/ProfileNudge";

const TOP_FINDINGS = 3;

export function MyWeekBoard({ initial }: { initial: MyWeekData }) {
  const t = useTranslations("nutritionHub.myWeek");
  const [data, setData] = useState(initial);

  const refresh = useCallback(async () => {
    const result = await getMyWeekAnalysis();
    if (result.error === null) setData(result.data);
  }, []);

  const { analysis } = data;
  const topFindings = analysis.findings.slice(0, TOP_FINDINGS);

  return (
    <div className="space-y-8">
      {!data.profileComplete && <ProfileNudge />}

      <div className="animate-fade-up">
        <WeekStrip days={analysis.days} />
      </div>

      {data.improveData.length > 0 && (
        <div className="animate-fade-up" style={{ animationDelay: "50ms" }}>
          <ImproveDataCard
            items={data.improveData}
            prominent={!analysis.microFindingsReliable}
            onMatched={refresh}
          />
        </div>
      )}

      <section className="space-y-4">
        <h2 className="font-display font-bold text-xl animate-fade-up">
          {t("findings.heading")}
        </h2>
        {topFindings.length === 0 ? (
          <p className="text-muted-foreground rounded-2xl border border-sage-200 dark:border-sage-500/20 bg-sage-50/50 dark:bg-sage-500/10 p-6 animate-fade-up">
            {t("findings.none")}
          </p>
        ) : (
          topFindings.map((finding, i) => (
            <div
              key={finding.id}
              className="animate-fade-up"
              style={{ animationDelay: `${100 + i * 75}ms` }}
            >
              <FindingCard
                finding={finding}
                allFindings={analysis.findings}
                onChanged={refresh}
              />
            </div>
          ))
        )}
      </section>

      <div className="animate-fade-up" style={{ animationDelay: "300ms" }}>
        <WeekHeatmap analysis={analysis} />
      </div>

      <p className="text-xs text-muted-foreground">
        {analysis.personalized ? `✦ ${t("basis.personalized")}` : `▢ ${t("basis.generic")}`}
      </p>
    </div>
  );
}
```

- [ ] **Step 3: WeekStrip**

```tsx
// src/components/nutrition-hub/my-week/WeekStrip.tsx
"use client";

import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { NUTRIENT_REGISTRY, type NutrientKey } from "@/lib/nutrients/registry";
import type { DayAnalysis } from "@/lib/nutrients/week-analysis";

type DayStatus = "good" | "watch" | "over" | "unplanned";

function dayStatus(day: DayAnalysis): DayStatus {
  if (!day.planned || day.meals.length === 0) return "unplanned";
  for (const [key, fill] of Object.entries(day.fill) as [NutrientKey, number][]) {
    if (NUTRIENT_REGISTRY[key].direction === "limit" && fill > 1) return "over";
  }
  const kcal = day.fill.kcal;
  if (kcal !== undefined && (kcal < 0.7 || kcal > 1.15)) return "watch";
  return "good";
}

const STATUS_RING: Record<DayStatus, string> = {
  good: "border-sage-300 dark:border-sage-500/40 bg-sage-50/50 dark:bg-sage-500/10",
  watch: "border-gold-300 dark:border-gold-500/40 bg-gold-50/50 dark:bg-gold-500/10",
  over: "border-brand-300 dark:border-brand-500/40 bg-brand-50/50 dark:bg-brand-500/10",
  unplanned: "border-dashed border-border bg-muted/30",
};

export function WeekStrip({ days }: { days: DayAnalysis[] }) {
  const locale = useLocale();
  const t = useTranslations("nutritionHub.myWeek.strip");
  const dayName = new Intl.DateTimeFormat(locale, { weekday: "short" });

  return (
    <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
      {days.map((day) => {
        const status = dayStatus(day);
        // parse as local date (avoid UTC shift of new Date("YYYY-MM-DD"))
        const [y, m, d] = day.date.split("-").map(Number);
        return (
          <div
            key={day.date}
            className={cn("rounded-xl border px-1 py-2 text-center", STATUS_RING[status])}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {dayName.format(new Date(y, m - 1, d))}
            </p>
            {status === "unplanned" ? (
              <p className="text-[10px] text-muted-foreground mt-1">{t("unplanned")}</p>
            ) : (
              <p className="font-mono text-xs mt-1">
                {day.totals.kcal !== undefined
                  ? t("kcalShort", { kcal: Math.round(day.totals.kcal) })
                  : "—"}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: FindingCard (read-only version)**

```tsx
// src/components/nutrition-hub/my-week/FindingCard.tsx
"use client";

import { useTranslations } from "next-intl";
import { TrendingDown, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { NUTRIENT_REGISTRY } from "@/lib/nutrients/registry";
import type { Finding } from "@/lib/nutrients/week-analysis";
import { displayUnit, formatNutrientAmount } from "@/components/nutrition-hub/format";

interface FindingCardProps {
  finding: Finding;
  allFindings: Finding[];
  onChanged: () => Promise<void>;
}

export function FindingCard({ finding }: FindingCardProps) {
  const t = useTranslations("nutritionHub.myWeek.findings");
  const tNutrients = useTranslations("nutritionHub.nutrients");
  const nutrientName = tNutrients(`${finding.nutrient}.name`);
  const isExcess = finding.kind === "excess";
  const unit = NUTRIENT_REGISTRY[finding.nutrient].unit;
  const gapText = `${formatNutrientAmount(finding.weekGapAmount, unit)} ${displayUnit(unit)}`;

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-5 space-y-4",
        isExcess
          ? "border-brand-200 dark:border-brand-500/30"
          : "border-gold-200 dark:border-gold-500/30"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {isExcess ? (
              <TriangleAlert className="w-4 h-4 text-brand-500" />
            ) : (
              <TrendingDown className="w-4 h-4 text-gold-600 dark:text-gold-400" />
            )}
            <h3 className="font-display font-bold text-lg">
              {t(isExcess ? "excessTitle" : "deficitTitle", { nutrient: nutrientName })}
            </h3>
          </div>
          <p className="text-sm text-muted-foreground">
            {t(isExcess ? "excessMeta" : "deficitMeta", {
              days: finding.daysAffected,
              plannedDays: finding.plannedDays,
            })}
            {" · "}
            {t(isExcess ? "weekGapExcess" : "weekGapDeficit", { amount: gapText })}
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {t(isExcess ? "sourcesExcess" : "sourcesDeficit")}
        </p>
        {finding.topContributors.map((c) => (
          <div key={c.mealId} className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate">{c.recipeTitle}</span>
            {isExcess && c.share > 0 && (
              <span className="font-mono text-xs text-muted-foreground shrink-0">
                {t("contributorShare", { share: Math.round(c.share * 100) })}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: WeekHeatmap**

```tsx
// src/components/nutrition-hub/my-week/WeekHeatmap.tsx
"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ALL_NUTRIENT_KEYS, NUTRIENT_REGISTRY, type NutrientKey } from "@/lib/nutrients/registry";
import type { WeekAnalysis } from "@/lib/nutrients/week-analysis";

function cellClass(key: NutrientKey, fill: number | undefined): string {
  if (fill === undefined) return "text-muted-foreground";
  const limit = NUTRIENT_REGISTRY[key].direction === "limit";
  if (limit) {
    return fill > 1
      ? "bg-brand-100 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300"
      : "bg-sage-50 dark:bg-sage-500/10";
  }
  if (fill >= 0.7) return "bg-sage-50 dark:bg-sage-500/10";
  return "bg-gold-50 dark:bg-gold-500/10 text-gold-700 dark:text-gold-400";
}

export function WeekHeatmap({ analysis }: { analysis: WeekAnalysis }) {
  const t = useTranslations("nutritionHub.myWeek.detail");
  const tNutrients = useTranslations("nutritionHub.nutrients");
  const [open, setOpen] = useState(false);
  const plannedDays = analysis.days.filter((d) => d.planned);

  return (
    <div className="rounded-2xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-medium"
      >
        {open ? t("hide") : t("show")}
        <ChevronDown className={cn("w-4 h-4 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="overflow-x-auto px-5 pb-5">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="text-left font-medium text-muted-foreground py-1.5 pr-3">
                  {t("nutrient")}
                </th>
                {plannedDays.map((d) => (
                  <th key={d.date} className="font-mono font-normal text-muted-foreground px-1.5">
                    {d.date.slice(8)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ALL_NUTRIENT_KEYS.map((key) => (
                <tr key={key} className="border-t border-border/50">
                  <td className="py-1.5 pr-3 whitespace-nowrap">{tNutrients(`${key}.name`)}</td>
                  {plannedDays.map((d) => {
                    const fill = d.fill[key];
                    return (
                      <td
                        key={d.date}
                        className={cn(
                          "text-center font-mono px-1.5 py-1.5 rounded",
                          cellClass(key, fill)
                        )}
                      >
                        {fill === undefined ? "—" : `${Math.round(fill * 100)}%`}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Stub `ImproveDataCard`** (full version in Task 9 — create now so the board compiles)

```tsx
// src/components/nutrition-hub/my-week/ImproveDataCard.tsx
"use client";

import { useTranslations } from "next-intl";
import { DatabaseZap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ImproveDataItem } from "@/actions/nutrition-week";

export interface ImproveDataCardProps {
  items: ImproveDataItem[];
  prominent: boolean;
  onMatched: () => Promise<void>;
}

export function ImproveDataCard({ items, prominent }: ImproveDataCardProps) {
  const t = useTranslations("nutritionHub.myWeek.improveData");
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-5 space-y-3",
        prominent ? "border-gold-300 dark:border-gold-500/40" : "border-border"
      )}
    >
      <div className="flex items-center gap-2">
        <DatabaseZap className="w-4 h-4 text-gold-600 dark:text-gold-400" />
        <h3 className="font-display font-bold">{t("title")}</h3>
      </div>
      <p className="text-sm text-muted-foreground">{t("body", { count: items.length })}</p>
    </div>
  );
}
```

- [ ] **Step 7: Add the module card to the hub landing**

In `src/app/[locale]/(protected-pages)/nutrition/page.tsx`, add `CalendarRange` to the lucide import and prepend to the `modules` array:

```tsx
    {
      href: "/nutrition/my-week",
      icon: CalendarRange,
      accent: "sage" as const,
      kicker: t("modules.myWeek.kicker"),
      title: t("modules.myWeek.title"),
      blurb: t("modules.myWeek.blurb"),
    },
```

And add to each locale's `nutritionHub.hub.modules` object (en/es/pl respectively):

```json
"myWeek": { "kicker": "Act", "title": "Fix My Week", "blurb": "See how your planned week really measures up, and fix it in one tap." }
```
```json
"myWeek": { "kicker": "Actúa", "title": "Arregla Mi Semana", "blurb": "Mira cómo va de verdad tu semana planificada y arréglala con un toque." }
```
```json
"myWeek": { "kicker": "Działaj", "title": "Napraw Mój Tydzień", "blurb": "Zobacz, jak naprawdę wygląda Twój zaplanowany tydzień, i napraw go jednym dotknięciem." }
```

- [ ] **Step 8: Verify**

Run: `bun tsc --noEmit && bun run test:unit`
Expected: clean / all green (parity test still passes because all three locales got the same keys).

Then verify in the browser (preview tools): start the dev server, open `/nutrition/my-week`. With an active meal plan you should see the strip, findings (or the "balanced" message), and the heatmap; without one, the empty state. Check `/es/nutrition/my-week`, dark mode, and 375 px width. No console errors.

- [ ] **Step 9: Commit**

```bash
git add src/app src/components/nutrition-hub/my-week messages
git commit -m "feat(nutrition-hub): read-only Fix My Week board (strip, findings, heatmap)"
```

---

### Task 9: One-tap "Improve your data"

**Files:**
- Modify: `src/components/nutrition-hub/my-week/ImproveDataCard.tsx` (replace the stub)

- [ ] **Step 1: Full implementation**

```tsx
// src/components/nutrition-hub/my-week/ImproveDataCard.tsx
"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { DatabaseZap, Check, LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  matchRecipeIngredients,
  type ImproveDataItem,
} from "@/actions/nutrition-week";

export interface ImproveDataCardProps {
  items: ImproveDataItem[];
  prominent: boolean;
  onMatched: () => Promise<void>;
}

type RowState =
  | { status: "idle" }
  | { status: "working" }
  | { status: "done"; matched: number; total: number }
  | { status: "error"; message: string };

export function ImproveDataCard({ items, prominent, onMatched }: ImproveDataCardProps) {
  const t = useTranslations("nutritionHub.myWeek.improveData");
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [, startTransition] = useTransition();

  function analyze(recipeId: string) {
    setRows((prev) => ({ ...prev, [recipeId]: { status: "working" } }));
    startTransition(async () => {
      const result = await matchRecipeIngredients({ recipeId });
      if (result.error !== null) {
        const message = typeof result.error === "string" ? result.error : "Error";
        setRows((prev) => ({ ...prev, [recipeId]: { status: "error", message } }));
        return;
      }
      setRows((prev) => ({ ...prev, [recipeId]: { status: "done", ...result.data } }));
      await onMatched();
    });
  }

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-5 space-y-3",
        prominent ? "border-gold-300 dark:border-gold-500/40" : "border-border"
      )}
    >
      <div className="flex items-center gap-2">
        <DatabaseZap className="w-4 h-4 text-gold-600 dark:text-gold-400" />
        <h3 className="font-display font-bold">{t("title")}</h3>
      </div>
      <p className="text-sm text-muted-foreground">{t("body", { count: items.length })}</p>

      <ul className="space-y-2">
        {items.map((item) => {
          const state = rows[item.recipeId] ?? { status: "idle" };
          return (
            <li key={item.recipeId} className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate">{item.title}</span>
              {state.status === "done" ? (
                <span className="inline-flex items-center gap-1 text-sage-600 dark:text-sage-400 text-xs shrink-0">
                  <Check className="w-3.5 h-3.5" />
                  {t("done", { matched: state.matched, total: state.total })}
                </span>
              ) : state.status === "error" ? (
                <span className="text-xs text-brand-600 dark:text-brand-400 shrink-0">
                  {state.message}
                </span>
              ) : (
                <button
                  type="button"
                  disabled={state.status === "working"}
                  onClick={() => analyze(item.recipeId)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-gold-300 dark:border-gold-500/40 px-3 py-1 text-xs font-medium hover:bg-gold-50 dark:hover:bg-gold-500/10 transition-colors disabled:opacity-60 shrink-0"
                >
                  {state.status === "working" ? (
                    <>
                      <LoaderCircle className="w-3 h-3 animate-spin" />
                      {t("analyzing")}
                    </>
                  ) : (
                    t("analyze")
                  )}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
```

- [ ] **Step 2: Verify in the browser**

`bun tsc --noEmit`, then in preview: open my-week with a recipe that has unmatched ingredients, click "Analyze ingredients", confirm the chip flips to "Matched X of Y" and the board refreshes (coverage badge changes, possibly new findings appear). This exercises the FDC search API — expect a few seconds per recipe.

- [ ] **Step 3: Commit**

```bash
git add src/components/nutrition-hub/my-week/ImproveDataCard.tsx
git commit -m "feat(nutrition-hub): one-tap USDA ingredient matching from My Week"
```

---

## Phase D — Closing the loop

### Task 10: `getSwapSuggestions` + `applySwap`

**Files:**
- Modify: `src/actions/nutrition-week.ts` (append)

- [ ] **Step 1: Append imports**

```typescript
import { ALL_NUTRIENT_KEYS, type NutrientKey } from "@/lib/nutrients/registry";
import { scoreSwaps, type SwapCandidate, type SwapSuggestion } from "@/lib/nutrients/swap-scorer";
import { formatIngredientsForNutrition as formatLines } from "@/lib/ingredients";
```

(Note: `formatIngredientsForNutrition` is already imported in Task 5 — do NOT alias-import twice; reuse the existing import and skip the third line above.)

- [ ] **Step 2: Append the actions**

```typescript
const CANDIDATE_POOL_SIZE = 60;
const MAX_SUGGESTIONS = 5;

const getSwapSuggestionsSchema = z.object({
  mealId: z.string().uuid(),
  nutrient: z.enum(ALL_NUTRIENT_KEYS as [NutrientKey, ...NutrientKey[]]),
  kind: z.enum(["deficit", "excess"]),
});

/** Rank the user's own recipes as replacements for one planned meal. */
export async function getSwapSuggestions(input: {
  mealId: string;
  nutrient: NutrientKey;
  kind: "deficit" | "excess";
}) {
  return serverAction(
    { input: getSwapSuggestionsSchema },
    async (ctx, validated): Promise<SwapSuggestion[]> => {
      const week = await loadWeek(ctx.user.id);
      const meal = week.mealsById.get(validated.mealId);
      if (!meal) throw new Error("Meal not found in your current week");

      const analysis = analyzeWeek(week.days, week.rda);
      const target = analysis.findings.find(
        (f) => f.nutrient === validated.nutrient && f.kind === validated.kind
      );
      if (!target) return [];

      const profile = await prisma.userProfile.findUnique({
        where: { userId: ctx.user.id },
        select: { allergies: true },
      });

      const pool = await prisma.recipe.findMany({
        where: { userId: ctx.user.id },
        select: { id: true, ingredients: true },
        orderBy: { updatedAt: "desc" },
        take: CANDIDATE_POOL_SIZE,
      });
      const profiles = await getRecipeNutrientProfiles(
        pool.map((r) => r.id),
        ctx.user.id
      );
      const linesById = new Map(
        pool.map((r) => [r.id, formatIngredientsForNutrition(r.ingredients)])
      );

      const candidates: SwapCandidate[] = [...profiles.values()].map((p) => ({
        recipeId: p.recipeId,
        title: p.title,
        perServing: p.perServing,
        coverage: p.coverage,
        ingredientNames: linesById.get(p.recipeId) ?? [],
      }));

      return scoreSwaps(
        {
          meal,
          target,
          findings: analysis.findings,
          allergies: profile?.allergies ?? [],
        },
        candidates
      ).slice(0, MAX_SUGGESTIONS);
    }
  )(input);
}

const applySwapSchema = z.object({
  mealId: z.string().uuid(),
  newRecipeId: z.string().uuid(),
});

export interface ApplySwapResult {
  /** For one-tap undo: applySwap(mealId, previousRecipeId) */
  previousRecipeId: string;
}

/**
 * Replace the recipe of one planned meal, in place — slot, sortOrder and
 * servings are preserved. Both the meal and the replacement recipe must
 * belong to the caller.
 */
export async function applySwap(input: { mealId: string; newRecipeId: string }) {
  return serverAction(
    {
      input: applySwapSchema,
      revalidates: ["/meal-plans", "/nutrition/my-week"],
    },
    async (ctx, validated): Promise<ApplySwapResult> => {
      const [meal, recipe] = await Promise.all([
        prisma.mealPlanMeal.findUnique({
          where: { id: validated.mealId },
          include: { mealPlanDay: { include: { template: { select: { userId: true } } } } },
        }),
        prisma.recipe.findUnique({
          where: { id: validated.newRecipeId },
          select: { id: true, userId: true },
        }),
      ]);

      if (!meal || meal.mealPlanDay.template.userId !== ctx.user.id) {
        throw new Error("Meal not found");
      }
      if (!recipe || recipe.userId !== ctx.user.id) {
        throw new Error("Recipe not found");
      }
      if (!meal.recipeId) {
        throw new Error("Meal has no recipe to replace");
      }

      const previousRecipeId = meal.recipeId;
      await prisma.mealPlanMeal.update({
        where: { id: meal.id },
        data: { recipeId: recipe.id, generationFailed: false, generationError: null },
      });

      return { previousRecipeId };
    }
  )(input);
}
```

- [ ] **Step 3: Verify types and suite**

Run: `bun tsc --noEmit && bun run test:unit`
Expected: clean / all green.

- [ ] **Step 4: Commit**

```bash
git add src/actions/nutrition-week.ts
git commit -m "feat(nutrition-hub): swap suggestions and in-place applySwap with undo handle"
```

---

### Task 11: Swap UI in FindingCard (apply + undo)

**Files:**
- Modify: `src/components/nutrition-hub/my-week/FindingCard.tsx` (replace entirely)

- [ ] **Step 1: Replace `FindingCard.tsx`**

```tsx
// src/components/nutrition-hub/my-week/FindingCard.tsx
"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  Check,
  LoaderCircle,
  TrendingDown,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { NUTRIENT_REGISTRY } from "@/lib/nutrients/registry";
import type { Finding, MealContribution } from "@/lib/nutrients/week-analysis";
import type { SwapSuggestion } from "@/lib/nutrients/swap-scorer";
import {
  applySwap,
  getSwapSuggestions,
} from "@/actions/nutrition-week";
import { displayUnit, formatNutrientAmount } from "@/components/nutrition-hub/format";

interface FindingCardProps {
  finding: Finding;
  allFindings: Finding[];
  onChanged: () => Promise<void>;
}

interface AppliedSwap {
  mealId: string;
  previousRecipeId: string;
  toTitle: string;
}

export function FindingCard({ finding, onChanged }: FindingCardProps) {
  const t = useTranslations("nutritionHub.myWeek.findings");
  const tSwaps = useTranslations("nutritionHub.myWeek.swaps");
  const tNutrients = useTranslations("nutritionHub.nutrients");

  const [suggestions, setSuggestions] = useState<SwapSuggestion[] | null>(null);
  const [openMealId, setOpenMealId] = useState<string | null>(null);
  const [applied, setApplied] = useState<AppliedSwap | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  const nutrientName = tNutrients(`${finding.nutrient}.name`);
  const isExcess = finding.kind === "excess";
  const unit = NUTRIENT_REGISTRY[finding.nutrient].unit;
  const gapText = `${formatNutrientAmount(finding.weekGapAmount, unit)} ${displayUnit(unit)}`;

  function loadSuggestions(meal: MealContribution) {
    setOpenMealId(meal.mealId);
    setSuggestions(null);
    startTransition(async () => {
      const result = await getSwapSuggestions({
        mealId: meal.mealId,
        nutrient: finding.nutrient,
        kind: finding.kind,
      });
      setSuggestions(result.error === null ? result.data : []);
    });
  }

  function apply(suggestion: SwapSuggestion) {
    setBusy(true);
    startTransition(async () => {
      const result = await applySwap({
        mealId: suggestion.mealId,
        newRecipeId: suggestion.candidateRecipeId,
      });
      if (result.error === null) {
        setApplied({
          mealId: suggestion.mealId,
          previousRecipeId: result.data.previousRecipeId,
          toTitle: suggestion.candidateTitle,
        });
        setOpenMealId(null);
        setSuggestions(null);
        await onChanged();
      }
      setBusy(false);
    });
  }

  function undo() {
    if (!applied) return;
    setBusy(true);
    startTransition(async () => {
      await applySwap({ mealId: applied.mealId, newRecipeId: applied.previousRecipeId });
      setApplied(null);
      await onChanged();
      setBusy(false);
    });
  }

  return (
    <div
      className={cn(
        "rounded-2xl border bg-card p-5 space-y-4",
        isExcess
          ? "border-brand-200 dark:border-brand-500/30"
          : "border-gold-200 dark:border-gold-500/30"
      )}
    >
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          {isExcess ? (
            <TriangleAlert className="w-4 h-4 text-brand-500" />
          ) : (
            <TrendingDown className="w-4 h-4 text-gold-600 dark:text-gold-400" />
          )}
          <h3 className="font-display font-bold text-lg">
            {t(isExcess ? "excessTitle" : "deficitTitle", { nutrient: nutrientName })}
          </h3>
        </div>
        <p className="text-sm text-muted-foreground">
          {t(isExcess ? "excessMeta" : "deficitMeta", {
            days: finding.daysAffected,
            plannedDays: finding.plannedDays,
          })}
          {" · "}
          {t(isExcess ? "weekGapExcess" : "weekGapDeficit", { amount: gapText })}
        </p>
      </div>

      {applied && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-sage-50 dark:bg-sage-500/10 border border-sage-200 dark:border-sage-500/20 px-3 py-2 text-sm">
          <span className="inline-flex items-center gap-1.5 text-sage-700 dark:text-sage-300">
            <Check className="w-4 h-4" />
            {tSwaps("applied", { to: applied.toTitle })}
          </span>
          <button
            type="button"
            onClick={undo}
            disabled={busy}
            className="inline-flex items-center gap-1 text-xs font-medium hover:underline disabled:opacity-60"
          >
            <Undo2 className="w-3.5 h-3.5" />
            {tSwaps("undo")}
          </button>
        </div>
      )}

      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {t(isExcess ? "sourcesExcess" : "sourcesDeficit")}
        </p>
        {finding.topContributors.map((c) => (
          <div key={c.mealId} className="space-y-2">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate">{c.recipeTitle}</span>
              <div className="flex items-center gap-2 shrink-0">
                {isExcess && c.share > 0 && (
                  <span className="font-mono text-xs text-muted-foreground">
                    {t("contributorShare", { share: Math.round(c.share * 100) })}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => loadSuggestions(c)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 dark:text-brand-400 hover:underline"
                >
                  {tSwaps("show")}
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            {openMealId === c.mealId && (
              <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
                {suggestions === null ? (
                  <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <LoaderCircle className="w-3.5 h-3.5 animate-spin" />
                    {tSwaps("loading")}
                  </p>
                ) : suggestions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{tSwaps("none")}</p>
                ) : (
                  suggestions.map((s) => (
                    <div
                      key={s.candidateRecipeId}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium">{s.candidateTitle}</p>
                        <p className="text-xs text-muted-foreground">
                          {tSwaps("closes", { pct: Math.round(s.gapClosure * 100) })}
                          {s.tradeoffs.length > 0 && (
                            <>
                              {" · "}
                              <span className="text-gold-700 dark:text-gold-400">
                                {tSwaps("tradeoffs", {
                                  nutrients: s.tradeoffs
                                    .map((n) => tNutrients(`${n}.name`))
                                    .join(", "),
                                })}
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => apply(s)}
                        className="rounded-full bg-sage-600 hover:bg-sage-700 text-white px-3 py-1 text-xs font-medium transition-colors disabled:opacity-60 shrink-0"
                      >
                        {busy ? tSwaps("applying") : tSwaps("apply")}
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify in the browser**

`bun tsc --noEmit`, then in preview: open my-week → a finding card → "Show fixes" → suggestions render with gap-closure % and tradeoffs → Apply → green "Swapped to …" bar appears, strip/heatmap numbers change after refresh → Undo restores the original. Verify the swap is visible in `/meal-plans` too.

- [ ] **Step 3: Commit**

```bash
git add src/components/nutrition-hub/my-week/FindingCard.tsx
git commit -m "feat(nutrition-hub): one-tap swap apply with undo in finding cards"
```

---

## Phase E — AI fallback

### Task 12: `generateGapRecipe`

**Files:**
- Modify: `src/actions/nutrition-week.ts` (append)
- Modify: `src/components/nutrition-hub/my-week/FindingCard.tsx` (generate button in the empty-suggestions branch)

The model **drafts** a recipe; USDA **verifies** it: the draft is persisted, run through `persistIngredientMatches` (Task 5), and the returned numbers come from `getRecipeNutrientProfiles` — never from the LLM. Nothing is auto-applied.

- [ ] **Step 1: Append imports**

```typescript
import { generateText } from "ai";
import { getSkeletonModel } from "@/mastra/workflows/_llm";
import { assertCanCreateRecipe, assertCanUseAiMealPlan } from "@/lib/entitlements";
import type { RecipeNutrientProfile } from "@/lib/recipeNutrients";
```

- [ ] **Step 2: Append the action**

```typescript
const gapRecipeDraftSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().max(500).optional(),
  servings: z.number().int().min(1).max(12),
  ingredients: z
    .array(z.object({ name: z.string(), amount: z.number(), unit: z.string() }))
    .min(2)
    .max(25),
  instructions: z.array(z.string().min(1)).min(1).max(20),
});

const generateGapRecipeSchema = z.object({
  mealId: z.string().uuid(),
  nutrient: z.enum(ALL_NUTRIENT_KEYS as [NutrientKey, ...NutrientKey[]]),
  kind: z.enum(["deficit", "excess"]),
});

export interface GeneratedGapRecipe {
  recipeId: string;
  title: string;
  /** USDA-verified — never the model's own claims */
  profile: RecipeNutrientProfile;
}

/**
 * AI cold-start fallback: draft a recipe targeted at a finding, persist it,
 * verify its nutrition through USDA ingredient matching, and return the
 * verified profile. The user applies it through the normal swap flow.
 */
export async function generateGapRecipe(input: {
  mealId: string;
  nutrient: NutrientKey;
  kind: "deficit" | "excess";
}) {
  return serverAction(
    {
      input: generateGapRecipeSchema,
      requires: async (_input, ctx) => {
        await assertCanUseAiMealPlan(ctx.user);
        await assertCanCreateRecipe(ctx.user);
      },
      revalidates: ["/recipes", "/nutrition/my-week"],
    },
    async (ctx, validated): Promise<GeneratedGapRecipe> => {
      const week = await loadWeek(ctx.user.id);
      const meal = week.mealsById.get(validated.mealId);
      if (!meal) throw new Error("Meal not found in your current week");

      const profile = await prisma.userProfile.findUnique({
        where: { userId: ctx.user.id },
        select: { allergies: true, dietaryType: true, cuisinePrefs: true },
      });

      const mealKcal = meal.perServing.kcal;
      const goal =
        validated.kind === "deficit"
          ? `high in ${validated.nutrient}`
          : `low in ${validated.nutrient}`;

      const { text } = await generateText({
        model: getSkeletonModel(),
        prompt: [
          `Create one ${meal.mealType} recipe that is ${goal}.`,
          mealKcal !== undefined
            ? `Target roughly ${Math.round(mealKcal * 0.85)}-${Math.round(mealKcal * 1.15)} kcal per serving.`
            : "",
          profile?.dietaryType?.length
            ? `Dietary style: ${profile.dietaryType.join(", ")}.`
            : "",
          profile?.allergies?.length
            ? `STRICTLY avoid these allergens: ${profile.allergies.join(", ")}.`
            : "",
          profile?.cuisinePrefs?.length
            ? `Preferred cuisines: ${profile.cuisinePrefs.join(", ")}.`
            : "",
          "Use common whole ingredients with standard units (g, kg, ml, cup, tbsp, tsp, piece).",
          'Respond with ONLY a JSON object, no markdown fences, matching: {"title": string, "description": string, "servings": number, "ingredients": [{"name": string, "amount": number, "unit": string}], "instructions": [string]}',
        ]
          .filter(Boolean)
          .join(" "),
      });

      const cleaned = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      const draft = gapRecipeDraftSchema.parse(JSON.parse(cleaned));

      const recipe = await prisma.recipe.create({
        data: {
          userId: ctx.user.id,
          title: draft.title,
          description: draft.description ?? null,
          servings: draft.servings,
          ingredients: draft.ingredients,
          instructions: draft.instructions,
          source: "generated",
          tags: ["generated", "nutrition-fix"],
        },
        select: { id: true, ingredients: true, servings: true },
      });

      // Honesty rule: verify with USDA before showing any numbers.
      await persistIngredientMatches(recipe);

      const profiles = await getRecipeNutrientProfiles([recipe.id], ctx.user.id);
      const verified = profiles.get(recipe.id);
      if (!verified) throw new Error("Failed to verify generated recipe");

      return { recipeId: recipe.id, title: verified.title, profile: verified };
    }
  )(input);
}
```

- [ ] **Step 3: Wire the button into `FindingCard`**

In `FindingCard.tsx`, add to the imports: `Sparkles` from `lucide-react`, `generateGapRecipe` from `@/actions/nutrition-week`. Add state `const [generating, setGenerating] = useState(false);` and this handler:

```tsx
  function generate(meal: MealContribution) {
    setGenerating(true);
    startTransition(async () => {
      const result = await generateGapRecipe({
        mealId: meal.mealId,
        nutrient: finding.nutrient,
        kind: finding.kind,
      });
      if (result.error === null) {
        // surface the verified recipe as a fresh suggestion for this meal
        await loadSuggestionsAsync(meal);
      }
      setGenerating(false);
    });
  }
```

Refactor `loadSuggestions` so its body is an extracted `async function loadSuggestionsAsync(meal: MealContribution)` that both the click handler and `generate` await. Replace the empty-suggestions branch (`suggestions.length === 0`) with:

```tsx
                ) : suggestions.length === 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">{tSwaps("none")}</p>
                    <button
                      type="button"
                      disabled={generating}
                      onClick={() => generate(c)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-gold-300 dark:border-gold-500/40 px-3 py-1.5 text-xs font-medium hover:bg-gold-50 dark:hover:bg-gold-500/10 transition-colors disabled:opacity-60"
                    >
                      {generating ? (
                        <>
                          <LoaderCircle className="w-3 h-3 animate-spin" />
                          {tSwaps("generating")}
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3 h-3" />
                          {tSwaps("generate")}
                        </>
                      )}
                    </button>
                  </div>
                ) : (
```

- [ ] **Step 4: Verify**

`bun tsc --noEmit && bun run test:unit`, then in the browser: trigger a finding whose suggestions are empty (or temporarily empty the pool by raising `MIN_GAP_CLOSURE` — revert after), click Generate, confirm a recipe is created (visible in `/recipes` with the `nutrition-fix` tag), suggestions reload including it, and its numbers come from FDC-matched data (coverage badge not macrosOnly). This costs one Sonnet call.

- [ ] **Step 5: Commit**

```bash
git add src/actions/nutrition-week.ts src/components/nutrition-hub/my-week/FindingCard.tsx
git commit -m "feat(nutrition-hub): USDA-verified AI gap-recipe fallback"
```

---

## Phase F — Surfacing & polish

### Task 13: Landing hero + planner banner

**Files:**
- Create: `src/components/nutrition-hub/my-week/MyWeekHero.tsx`
- Create: `src/components/nutrition-hub/my-week/PlannerNutritionBanner.tsx`
- Modify: `src/app/[locale]/(protected-pages)/nutrition/page.tsx`
- Modify: `src/app/[locale]/(protected-pages)/meal-plans/page.tsx`

- [ ] **Step 1: Hero card (server component, resilient)**

```tsx
// src/components/nutrition-hub/my-week/MyWeekHero.tsx
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, CalendarRange } from "lucide-react";
import { getMyWeekAnalysis } from "@/actions/nutrition-week";

/** Landing hero: live one-line verdict of the user's planned week. */
export async function MyWeekHero() {
  const t = await getTranslations("nutritionHub.myWeek.hero");

  let line: string | null = null;
  try {
    const result = await getMyWeekAnalysis();
    if (result.error === null && result.data.hasActivePlan) {
      const count = result.data.analysis.findings.length;
      line = count === 0 ? t("ok") : t("findings", { count });
    }
  } catch {
    return null;
  }
  if (line === null) return null;

  return (
    <Link
      href="/nutrition/my-week"
      className="group flex items-center justify-between gap-4 rounded-2xl border-2 border-sage-300/60 dark:border-sage-500/40 bg-sage-50/50 dark:bg-sage-500/10 p-5 transition-colors hover:bg-sage-100/60 dark:hover:bg-sage-500/15"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="p-2.5 rounded-xl bg-sage-100 dark:bg-sage-500/20 shrink-0">
          <CalendarRange className="w-5 h-5 text-sage-600 dark:text-sage-400" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-sage-600 dark:text-sage-400">
            {t("eyebrow")}
          </p>
          <p className="font-display font-bold truncate">{line}</p>
        </div>
      </div>
      <span className="inline-flex items-center gap-1 text-sm font-medium text-sage-700 dark:text-sage-300 shrink-0">
        {t("cta")}
        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
```

- [ ] **Step 2: Mount on the landing, above the face-off**

In `src/app/[locale]/(protected-pages)/nutrition/page.tsx`, import `MyWeekHero` and insert between the header block and the face-off block:

```tsx
        <div className="animate-fade-up" style={{ animationDelay: "50ms" }}>
          <MyWeekHero />
        </div>
```

- [ ] **Step 3: Planner banner**

```tsx
// src/components/nutrition-hub/my-week/PlannerNutritionBanner.tsx
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, HeartPulse } from "lucide-react";
import { getMyWeekAnalysis } from "@/actions/nutrition-week";

/** Slim link from the meal planner into My Week — a link, not an embed. */
export async function PlannerNutritionBanner() {
  const t = await getTranslations("nutritionHub.myWeek.hero");

  let count: number | null = null;
  try {
    const result = await getMyWeekAnalysis();
    if (result.error === null && result.data.hasActivePlan) {
      count = result.data.analysis.findings.length;
    }
  } catch {
    return null;
  }
  if (count === null || count === 0) return null;

  return (
    <div className="px-4 pt-4 sm:px-6">
      <Link
        href="/nutrition/my-week"
        className="flex items-center justify-between gap-3 rounded-xl border border-gold-300/60 dark:border-gold-500/30 bg-gold-50/60 dark:bg-gold-500/10 px-4 py-2.5 text-sm hover:bg-gold-100/60 dark:hover:bg-gold-500/15 transition-colors"
      >
        <span className="inline-flex items-center gap-2 min-w-0">
          <HeartPulse className="w-4 h-4 text-gold-600 dark:text-gold-400 shrink-0" />
          <span className="truncate font-medium">{t("findings", { count })}</span>
        </span>
        <span className="inline-flex items-center gap-1 font-medium text-gold-700 dark:text-gold-300 shrink-0">
          {t("cta")}
          <ArrowRight className="w-3.5 h-3.5" />
        </span>
      </Link>
    </div>
  );
}
```

In `src/app/[locale]/(protected-pages)/meal-plans/page.tsx`, import it and render above the planner:

```tsx
import { PlannerNutritionBanner } from "@/components/nutrition-hub/my-week/PlannerNutritionBanner";
// …
  return (
    <Suspense>
      <PlannerNutritionBanner />
      <MealPlanner />
    </Suspense>
  );
```

- [ ] **Step 4: Verify in the browser**

Landing shows the hero with a live verdict; `/meal-plans` shows the banner when findings exist and nothing when the week is clean or unplanned. Check es + pl, dark mode, 375 px.

- [ ] **Step 5: Commit**

```bash
git add src/components/nutrition-hub/my-week src/app
git commit -m "feat(nutrition-hub): My Week hero on hub landing and meal-planner banner"
```

---

### Task 14: Final verification + docs

**Files:**
- Modify: `.agent/Tasks/nutrition_learning_hub.md` (v2 section)

- [ ] **Step 1: Full local gates**

```bash
bun tsc --noEmit
bun run test:unit
```
Expected: clean; all tests green (v1's 510 + the ~25 new ones).

- [ ] **Step 2: Browser sweep (preview tools)**

- `/nutrition` — hero verdict + My Week module card first in the grid.
- `/nutrition/my-week` — strip, top-3 findings with attribution, show-fixes → apply → undo, improve-data one-tap, heatmap, basis glyph.
- `/es/nutrition/my-week` and `/pl/nutrition/my-week` — no raw ICU keys (restart dev server after message edits!).
- Dark mode + 375 px on my-week.
- `/meal-plans` — banner present, swap applied earlier is reflected.
- Console: zero errors.

- [ ] **Step 3: Update `.agent/Tasks/nutrition_learning_hub.md`**

Append a `## v2 — Fix My Week (shipped)` section documenting: the new routes/modules, the engines (`schedule-window`, `week-analysis`, `swap-scorer`, `recipeNutrients`), the `matchRecipeIngredients` discovery (no RecipeIngredient write path existed before), the AI honesty rule, and the gotcha that suggestions depend on ingredient-match coverage.

- [ ] **Step 4: Commit**

```bash
git add .agent/Tasks/nutrition_learning_hub.md
git commit -m "docs(nutrition-hub): document Fix My Week v2"
```

---

## Self-review checklist (run after writing, before execution)

1. **Spec coverage:** window resolution ✓ (T1), findings + attribution ✓ (T2), multi-objective scorer ✓ (T3), batched profiles ✓ (T4), improve-data loop ✓ (T5/T9), week action ✓ (T6), i18n ✓ (T7), read-only board ✓ (T8), apply+undo ✓ (T10/T11), AI fallback with USDA verification, never auto-applied ✓ (T12), hero + banner ✓ (T13), coverage gating ✓ (engine `microFindingsReliable` + prominent ImproveDataCard), no-plan empty state ✓ (T8), allergen best-effort ✓ (T3), disclaimer ✓ (T8).
2. **Type consistency:** `PlannedMealInput`/`Finding`/`WeekAnalysis` defined in T2 and imported by T3/T6/T8/T11; `SwapSuggestion` defined T3, used T10/T11; `RecipeNutrientProfile` defined T4, re-exported and used T12; `ImproveDataItem`/`MyWeekData` defined T6, used T8/T9.
3. **No placeholders:** every code step contains complete code; the only intentionally deferred piece is the ImproveDataCard stub (T8 Step 6) which T9 replaces wholesale.
