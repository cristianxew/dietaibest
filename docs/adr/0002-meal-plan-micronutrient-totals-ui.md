# Meal-plan micronutrient totals: aggregation + UI

**Status:** accepted

DIE-44 surfaces the payoff of persisting full FDC nutrient profiles (DIE-42):
the daily micronutrient totals of a meal-plan day. The data layer was
straightforward, but how to present ~17 micronutrient totals needed a design
decision (the issue was marked HITL). This ADR records those decisions.

## Decisions

1. **Placement — aggregate panel everywhere + per-day panel where there's room.**
   - A full-width **aggregate panel** (`variant="aggregate"`) renders the plan's
     **average daily** micronutrient totals directly under `WeeklyMacroStrip` in
     `MealPlanner`. It is visible in every layout.
   - A **per-day panel** (`variant="day"`) renders a single day's totals inside
     `StackLayout` (each day card) and `SplitLayout` (the focused-day editor),
     which have full-width regions for it.
   - **`GridLayout` intentionally omits the per-day panel.** Its day columns are
     ~110–132px wide; a grouped micronutrient accordion per column would wrap
     illegibly. Grid users get the aggregate panel; switching to Stack/Split
     gives per-day detail. This is a layout constraint, not a scope cut.

2. **Relation to targets — % of Daily Value, personalized by age + sex.**
   Micronutrient RDAs (NASEM DRIs) are tabulated by **age + sex** (plus
   pregnancy/lactation), **not** by height/weight/activity — those drive energy
   and protein (macros). So personalization uses `UserProfile.dateOfBirth`
   (→ age) and `gender` only. See `src/lib/nutrition-rda.ts`.
   - **Fallback** (no profile / onboarding incomplete / gender "other" /
     non-adult age): the FDA **Daily Value (DV)**, i.e. the standard label "%DV".
   - **Goal vs limit:** vitamins/minerals are "goal" references (aim toward 100%).
     Sodium, saturated fat, cholesterol, added sugar are "limit" references
     (shown as "% of limit", warning colour when exceeded). **Trans fat** has no
     reference (no safe level) → raw value only.
   - **Scope boundary:** adult life-stage bands × {male, female}. Pregnancy,
     lactation, and pediatric DRIs are out of scope (→ DV fallback).

3. **Defaults — collapsed accordion, all groups inside.** `MicronutrientPanel`
   reuses the `RecipeMicronutrients` pattern: collapsed by default; on expand,
   the vitamins / minerals / other groups (`MICRONUTRIENT_GROUPS`). Fields at 0
   and empty groups are filtered out. A footnote states whether the reference is
   personalized or standard.

## Consequences

- The public share page (`/share/meal-plan/[token]`) is a separate minimal
  read-only teaser (calories only) and is **out of scope** — it does not render
  the panels. The DV-fallback path is still exercised in the authenticated
  planner when no profile exists, and by `tests/unit/nutrition-rda.test.ts`.
- `MicronutrientSummary` is keyed by the 17 `MICRONUTRIENT_KEYS` (the SSOT in
  `src/lib/nutrition-fields.ts`); fibre is a macro and is not included.
- `src/lib/nutrition-rda.ts` holds health-sensitive reference data. Any edit must
  be verified against the published NASEM DRI tables and the FDA Daily Value list;
  `tests/unit/nutrition-rda.test.ts` locks representative cells.
- Servings changes recompute micros: `updateTemplateServingsOptimistically` in
  `MealPlanner` rescales per-meal micros alongside macros.
