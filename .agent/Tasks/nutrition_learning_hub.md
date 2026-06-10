# Nutrition Learning Hub

**Status:** v1 shipped (branch `feat/nutrition-learning-hub`)
**Last Updated:** 2026-06-10

## Overview

The `/nutrition` route is a learning destination ("Nutrition Hub") instead of a single-purpose calculator. Goal: conscious eating — users compare foods, measure meals against their personal daily needs, and learn what nutrients do.

## Routes

| Route | Module |
|---|---|
| `/nutrition` | Hub landing: module cards + daily-rotating Featured Face-Off teaser |
| `/nutrition/compare` | Food Face-Off — side-by-side full nutrition; shareable `?a=fdc:<id>&b=recipe:<uuid>` |
| `/nutrition/vs-day` | Meal vs Your Day — fill-your-day bars against personalized RDA |
| `/nutrition/nutrients` | Nutrient Encyclopedia index (18 nutrients) |
| `/nutrition/nutrients/[slug]` | Nutrient detail: prose + live USDA top sources |
| `/nutrition/swaps` | Smart Swaps — curated pairs, deltas computed from USDA data |
| `/nutrition/calculator` | The original calculator (relocated, i18n-fixed) |

## Architecture

- **Pure logic** in `src/lib/nutrients/`: `registry.ts` (22 nutrients, USDA numbers, goal/limit/neutral direction), `extract.ts` (sparse `NutrientVector` — missing key = unknown, NEVER zero), `aggregate.ts` (recipe ingredient aggregation with `full|partial|macrosOnly` coverage), `insights.ts` (deterministic threshold rules — NO LLM; UI builds sentences from ICU messages), `rda.ts` + `rda-data.ts` (NIH DRI brackets by sex×age; precedence userTarget > DRI > derived > FDA DV), `compare-url.ts`, `encyclopedia.ts`, `swaps-data.ts`.
- **Server actions** in `src/actions/nutrition-hub.ts` (`getItemProfiles`, `searchMyRecipes`, `getMyRdaProfile`) via the `serverAction` runtime.
- **Components** in `src/components/nutrition-hub/` (compare/, vs-day/, nutrients/, swaps/, shared/).
- **Data**: USDA FDC only. `fdcFoodsByIds` fetches the extended nutrient set; `FdcCache.nutrientProfile` column (`core`|`extended`) drives profile-aware cache staleness in `getFoodsCached(ids, { profile })`. **No Edamam imports anywhere in hub code** (per-user macro cache policy); Edamam-sourced recipes degrade to the 5 macros stored on `Recipe`.
- **Ask Dietai**: seeds the chat composer via the `dietai:open-chat` CustomEvent (`src/lib/chat/open-chat.ts`); user presses send. System prompt untouched (ADR-0001).
- **i18n**: namespaces `nutritionHub.*`, `nutrition.calculator.*`, `chat.seeds.nutritionHub.*` in en/es/pl. Parity locked by `tests/unit/i18n-nutrition-hub-parity.test.ts`.

## Gotchas

- Dev server caches message catalogs — restart `bun dev` after editing `messages/*.json` or keys render raw.
- USDA food descriptions are English-only in all locales (no translation layer).
- `prisma migrate dev` wants to RESET the remote dev DB (pre-existing drift). Use: hand-written migration SQL → `prisma db execute --schema` → `migrate resolve --applied` → `generate`.
- fdcIds in `swaps-data.ts`/`encyclopedia.ts` are live-verified; when adding pairs, verify via `/api/fdc/search` — memory-guessed ids WILL betray you (168421 turned out to be kale, not iceberg).
- Insight absolute floors are tuned for raw per-100g duels; `SwapCard` relaxes them (ratio story matters for swaps).

## Phase 2 (not built)

Quiz/"guess the food" game, meal-plan-day vs day comparison, gamification/streaks, per-swap prose.

## Testing

`tests/unit/nutrients/*` (registry, extract, aggregate, insights — golden banana-vs-apple case, rda brackets/fallbacks, compare-url, encyclopedia + swaps data integrity, fdcRepo profile staleness) + i18n parity. All TDD'd. Run: `bun run test:unit`.
