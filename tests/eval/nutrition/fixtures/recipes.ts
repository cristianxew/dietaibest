/**
 * Golden recipe set for the nutrition harness.
 *
 * Each recipe carries trusted per-serving macros and a tier that sets tolerance:
 * - `anchor`  — truth is a hand-verified FDC computation (tight tolerance).
 *               These run against `anchor-foods.ts` (hand-built store).
 * - `real`    — truth is a published nutrition label (loose tolerance + floors).
 *               These run against recorded live-FDC fixtures.
 *
 * Grow this set incrementally; the harness asserts every entry on every PR.
 *
 * @module tests/eval/nutrition/fixtures/recipes
 */

import { type MacroExpectation, type Tier } from "../lib/assert-macros";

export interface GoldenRecipe {
  /** Stable slug, used as the test name. */
  id: string;
  /** Provenance of `expected`: a URL, or "hand-verified-fdc" for anchors. */
  source: string;
  tier: Tier;
  /** Free-text ingredient lines, exactly as the app receives them. */
  ingredients: string[];
  servings: number;
  /** Trusted per-serving macros. */
  expected: MacroExpectation;
}

export const goldenRecipes: GoldenRecipe[] = [
  {
    id: "egg-spinach-scramble",
    source: "hand-verified-fdc",
    tier: "anchor",
    ingredients: ["200 g egg", "100 g spinach", "14 g olive oil"],
    servings: 2,
    // total 432.76 kcal / 27.98 P / 33.41 F / 5.07 C / 2.2 fib, ÷2 servings
    expected: {
      calories: 216.38,
      protein: 13.99,
      fat: 16.705,
      carbs: 2.535,
      fiber: 1.1,
    },
  },
  {
    id: "banana-snack",
    source: "hand-verified-fdc",
    tier: "anchor",
    ingredients: ["120 g banana"],
    servings: 1,
    expected: {
      calories: 106.8,
      protein: 1.308,
      fat: 0.396,
      carbs: 27.408,
      fiber: 3.12,
    },
  },
  {
    id: "chicken-spinach-plate",
    source: "hand-verified-fdc",
    tier: "anchor",
    ingredients: ["300 g chicken breast", "200 g spinach", "20 g olive oil"],
    servings: 2,
    // total 582.8 kcal / 73.22 P / 28.64 F / 7.26 C / 4.4 fib, ÷2 servings
    expected: {
      calories: 291.4,
      protein: 36.61,
      fat: 14.32,
      carbs: 3.63,
      fiber: 2.2,
    },
  },
  {
    // Regression guard for the famous applySynonyms substring bug, where the
    // "sal" → "salt" synonym swallowed "salmon" and silently zeroed it.
    id: "salmon-fillet",
    source: "hand-verified-fdc",
    tier: "anchor",
    ingredients: ["150 g salmon"],
    servings: 1,
    expected: {
      calories: 213,
      protein: 29.76,
      fat: 9.51,
      carbs: 0,
      fiber: 0,
    },
  },

  // --- Real-world tier: Polish meal plan, label macros per meal (1 serving).
  // Original Polish units + names on purpose — exercises pl parsing, synonyms,
  // staples and gram resolution end to end. Labels give kcal/B(protein)/
  // W(carbs)/T(fat); no per-meal fiber, so fiber is not asserted.
  {
    id: "pl-d1-grahamka-kurczak",
    source: "Plan diety (Dzień 1, Posiłek 1)",
    tier: "real",
    servings: 1,
    ingredients: [
      "200 g mięso z piersi kurczaka",
      "2 sztuki bułka grahamka",
      "20 g miks sałat",
      "1 sztuka pomidor",
      "1 sztuka ogórek świeży",
      "2 łyżki oliwa z oliwek",
      "1 łyżeczka papryka słodka",
      "1 łyżeczka czosnek granulowany",
      "1 szczypta sól",
      "1 szczypta pieprz czarny",
    ],
    expected: { calories: 809, protein: 59, carbs: 93, fat: 26 },
  },
  {
    id: "pl-d1-losos-miso",
    source: "Plan diety (Dzień 1, Posiłek 2)",
    tier: "real",
    servings: 1,
    ingredients: [
      "75 g ryż basmati",
      "200 g łosoś świeży",
      "1.5 łyżeczki pasta miso",
      "1 łyżeczka miód",
      "1.5 łyżki sos sojowy",
      "1 łyżeczka olej sezamowy",
      "0.5 plastra imbir",
      "0.5 ząbku czosnek świeży",
      "200 g kapusta pak choi",
      "1 łyżeczka oliwa z oliwek",
      "1 łyżeczka sezam nasiona",
      "1 szczypta sól",
      "1 szczypta pieprz czarny",
      "0.5 łyżeczki papryka ostra suszona",
    ],
    expected: { calories: 913, protein: 52, carbs: 79, fat: 42 },
  },
  {
    id: "pl-d1-kurczak-teriyaki",
    source: "Plan diety (Dzień 1, Posiłek 3)",
    tier: "real",
    servings: 1,
    ingredients: [
      "100 g komosa ryżowa",
      "150 g mięso z piersi kurczaka",
      "1 łyżka sos sojowy",
      "1.5 łyżeczki miód",
      "4 łyżeczki olej sezamowy",
      "0.5 łyżeczki imbir mielony",
      "1 ząbek czosnek świeży",
      "175 g brokuł",
      "1 sztuka papryka czerwona",
      "1 łyżeczka sezam nasiona",
    ],
    expected: { calories: 892, protein: 56, carbs: 103, fat: 32 },
  },
];
