# Design: Migrate `/meal-plans` to the new Meal Planner UI

**Date:** 2026-05-20
**Status:** Design approved — pending implementation plan
**Branch:** `feature/DIE-30` (or a dedicated migration branch)

---

## 1. Goal

Replace the production `/meal-plans` UI with the visual design currently prototyped under
`/meal-planner-preview`, while keeping **100% of existing production functionality**.

This is a **visual re-skin**, not a product change. Nothing functional is dropped:
templates + schedules, 7 meal types, servings per meal, real macros, share tokens, and the
chat-agent deep-link (`?selected=<id>`) all survive.

### Decisions locked during brainstorming

| Question | Decision |
|---|---|
| Reconcile preview's simpler data model | **Visual skin only** — rebuild the preview on the real data model; discard its mock model |
| Styling system | **Port the design into Tailwind/shadcn tokens** — no CSS-variable island |
| Rollout | **Build in `/meal-planner-preview`, then one clean swap** of `/meal-plans` |
| Layout modes | **Ship all 3** (grid / stack / split) + the regular/compact density toggle |
| "Generar con IA" button | **Deep-link to the chat agent** pre-seeded with a generate-plan prompt |
| Schedule calendar | **Rebuild fresh** from the preview design; delete the 883-line `SavedPlansCalendar` |

---

## 2. Current state

### Production — `/meal-plans`
- Route: `src/app/[locale]/(protected-pages)/meal-plans/page.tsx` → `<MealPlans />`
- `src/components/MealPlans.tsx` (618 lines) — fully wired client component
- Backend: 17 server actions in `src/actions/meal-plan.ts` (1183 lines), Prisma-backed
- Data model: **Templates** (reusable structure, no dates) + **Schedules** (template placed on
  calendar dates)
- 7 `MealType`s, 2-6 slots per plan, servings per meal, real macros from recipe FKs
- `next-intl` i18n (`mealPlans.*`), shadcn/ui + Tailwind, dark/light via `next-themes`
- 10 components under `src/components/meal-plans/`

### Preview — `/meal-planner-preview`
- Route renders `<MealPlannerApp />` (329 lines) — **a visual prototype, not a real page**
- 100% mock data: hardcoded `PLANS` / `RECIPES` arrays in `data.ts`
- Every interaction (`onUpdate`, autofill, create) is local `useState` — no backend
- Parallel, incompatible type system (`Plan`, `Recipe`, `schedule[day][slot]`, 4 slot keys
  `b/l/s/d`, one recipe per slot, no servings)
- Inline styles + custom `--mp-*` CSS variables + own `data-theme` toggle
- Ships its OWN sidebar/nav (the app already has a protected layout)
- No i18n — hardcoded Spanish strings

### The gap

"Migration" here means: **keep the visual design, re-implement it on top of the real data
layer.** The preview's data model literally cannot express a 6-meal plan with servings, so its
types are deleted, not adapted.

---

## 3. The data-model bridge

The single highest-risk part of this work.

- The preview's `Plan` / `Recipe` / `SlotDef` / `schedule` types in
  `meal-planner-preview/types.ts` and `data.ts` are **deleted entirely**.
- A new **data adapter** converts the Prisma `MealPlanTemplate` payload
  (`days → meals → recipe`) into a display type. We **reuse and extend the existing
  `MealPlanTemplateDisplay`** in `src/types/meal-plan.ts` — it already carries per-day and
  average macros. The Prisma→display transform currently inlined inside `MealPlans.tsx`
  (`handleSelectPlan`, etc.) is extracted into a reusable, unit-tested adapter function.
- **Slot rendering**: the preview hardcodes 4 `SLOT_DEFS`. Production has **7 `MealType`s,
  2-6 per plan**. Replace `SLOT_DEFS` with a `MEAL_SLOT_META` map — each of the 7 `MealType`
  values → `{ icon, color, i18nKey }`. The editor renders slots from `template.mealSlots`.
- **`MealCell`** holds a real `MealDisplay` (`id`, `servings`, real macros). The preview has
  **no servings UI** — a servings control is **net-new** and must be added.
- Mutations call the real server actions: `addMealToDay`, `moveMeal`, `removeMealFromDay`,
  `updateMealServings`. Update pattern follows the current `MealPlans.tsx` approach
  (mutate → `loadTemplates()` refetch), optionally with `useOptimistic` for snappier drag-drop.

---

## 4. Component tree

New components live in `src/components/meal-planner-preview/` during the build, renamed/moved
to `src/components/meal-plans/` at swap time.

| Component | Role |
|---|---|
| `MealPlanner` (shell) | Header + tabs (planner / calendar), wires server actions. **No own sidebar** (app layout owns nav). **No own theme toggle** (`next-themes` is global). |
| `PlanSwitcher` | Real templates list, active selection, create → existing `MealPlanForm` dialog |
| `RecipeLibrary` | Real recipes, searchable / filterable / draggable |
| `GridLayout` / `StackLayout` / `SplitLayout` | The 3 editor layouts + regular/compact density |
| `MealCell` | One `(day, mealType)` slot — drag-drop, clear, **servings control** |
| `DayMacros` / `MacroBar` / `WeeklyMacroStrip` | Real macros via `src/lib/meal-plan-macros.ts` |
| `ScheduleCalendar` | Month grid; drag a template onto a date → `scheduleMealPlan` |

**Reused untouched:** the 17 server actions in `src/actions/meal-plan.ts`,
`src/lib/meal-plan-macros.ts`, the types in `src/types/meal-plan.ts`, and `MealPlanForm`
(create/edit dialog — already shadcn).

**Deleted at swap:** `MealPlans.tsx`, all 10 `components/meal-plans/*` files (including the
883-line `SavedPlansCalendar.tsx`), and the preview's mock files (`data.ts`, mock types,
`meal-planner.css`, the preview-only `Sidebar`).

---

## 5. Styling port

- Map the `--mp-*` palette onto the app's existing Tailwind theme tokens. `--mp-coral` /
  `--mp-sage` / `--mp-gold` correspond to the brand / sage / gold tokens of the existing
  "Botanical Precision" design system — **verify exact values against `globals.css`** before
  porting; adjust the Tailwind theme only if a shade is genuinely missing.
- Delete `meal-planner.css` and the `data-theme` attribute.
- Convert inline styles to Tailwind utility classes.
- Dark/light handled by the existing `next-themes` `.dark` class — the preview's own toggle is
  removed.
- shadcn components used for behavior: `Dialog`, `Tabs`, dropdowns, `Input`. The bespoke visual
  cells (meal cells, macro bars) stay as Tailwind-styled divs.

---

## 6. i18n

Every hardcoded Spanish string in the preview moves to `next-intl` keys under the existing
`mealPlans.*` namespace. Both `es` and `en` message files are updated. New keys needed for:
the 7 meal-type labels, the 3 layout-mode labels, density labels, calendar month/day names
(prefer `next-intl` / `Intl` date formatting over hardcoded `MONTH_NAMES_ES`).

---

## 7. AI button

The header "Generar con IA" button deep-links to the chat agent, pre-seeded with a
generate-a-plan prompt. It reuses existing chat infrastructure — **no new entry point** into
the Mastra `generateMealPlan` workflow is created. The preview's fake `Math.random()` autofill
is removed.

---

## 8. Schedule calendar

The production `SavedPlansCalendar.tsx` (883 lines) is **deleted**. A new `ScheduleCalendar` is
built fresh from the preview's clean ~220-line month-grid design, wired to the real
`getMealPlans` (template list) and `scheduleMealPlan` / `unscheduleMealPlan` actions. Care must
be taken to preserve real scheduling behavior (multi-day span from `template.duration`, status
handling) that the legacy component implemented.

---

## 9. Out of scope

- Backend / Prisma schema changes — the existing model is sufficient.
- The chat `generateMealPlan` Mastra workflow itself.
- Recipe CRUD.
- Persisting layout/density preference to a backend (v1: in-memory, optional localStorage).

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| Drag-drop wiring — preview's is `useState`-only; real drag must hit `moveMeal` and survive refetch | Build the adapter + `MealCell` mutation path first, test in isolation before layouts |
| 3 layouts × real data = 3× the editor surface to test | Share a single `MealCell` + slot-derivation hook across all 3 layouts |
| Servings UI is net-new — preview never modeled it | Designed into `MealCell` from the start, not bolted on |
| Rebuilt `ScheduleCalendar` may lose edge-case behavior from the 883-line legacy component | Audit `SavedPlansCalendar` behavior before deleting; carry over multi-day span + status logic |
| Tailwind token mismatch between `--mp-*` and existing theme | Verify against `globals.css` before porting |

---

## 11. Testing

Strict TDD is enabled for this project.

- **Unit:** the Prisma→display data adapter; `MEAL_SLOT_META` slot derivation; macro
  calculation reuse.
- **Component:** `MealCell` drag-drop wiring to server actions; servings control.
- **Manual:** dark/light mode; all 3 layouts; plans with 2, 4, and 6 meal slots; scheduling a
  plan on the calendar; the chat deep-link; the `?selected=<id>` deep-link from chat.

---

## 12. Migration sequence (high level)

The detailed step-by-step plan is produced by the writing-plans phase. Outline:

1. Data adapter (Prisma payload → display) + `MEAL_SLOT_META` map — with tests.
2. Styling port: `--mp-*` → Tailwind tokens; verify against `globals.css`.
3. Shell: `MealPlanner` wired to `getMealPlans`; no sidebar, no theme toggle.
4. `PlanSwitcher` + `RecipeLibrary` on real data.
5. `MealCell` + `GridLayout` wired to add/move/remove/servings actions.
6. `StackLayout` + `SplitLayout` + density toggle.
7. `WeeklyMacroStrip` + `DayMacros` on real macros.
8. `ScheduleCalendar` on real schedules.
9. AI button deep-link to chat.
10. i18n pass — `es` + `en`.
11. **Swap:** point `/meal-plans/page.tsx` at the new component; delete `MealPlans.tsx`, the
    10 `meal-plans/*` files, and the preview mock files; rename the component folder; remove
    the `/meal-planner-preview` route.
12. Update `.agent` docs (System + this Task doc).
