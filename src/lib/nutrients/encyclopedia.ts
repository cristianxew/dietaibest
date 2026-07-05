/**
 * Nutrient Encyclopedia — structural data only. All prose lives in the
 * message catalogs (nutritionHub.encyclopedia.{slug}.*) so every locale
 * reads naturally; this module carries identity (accent, icon) and the
 * curated USDA whole-food sources resolved live via the FDC cache.
 *
 * @module lib/nutrients/encyclopedia
 */

import type { NutrientKey } from "@/lib/nutrients/registry";

export type EncyclopediaAccent = "brand" | "sage" | "gold";

export interface EncyclopediaEntry {
  slug: string;
  nutrient: NutrientKey;
  accent: EncyclopediaAccent;
  /** Lucide icon name, mapped to a component in the UI layer */
  icon: string;
  /** Curated whole foods (SR Legacy fdcIds) shown as live top sources */
  topSourceFdcIds: number[];
}

// Verified SR Legacy ids (resolved live in the app):
// banana 173944 · apple 171688 · spinach 168462 · broccoli 170379
// avocado 171705 · almonds 170567 · egg 171287 · lentils 172421
// salmon 175167 · chicken breast 171477 · sweet potato 168482
// greek yogurt 170903 · oats 169705 · orange 169097
export const ENCYCLOPEDIA: EncyclopediaEntry[] = [
  { slug: "protein", nutrient: "protein", accent: "brand", icon: "Drumstick", topSourceFdcIds: [171477, 175167, 172421, 170903] },
  { slug: "fiber", nutrient: "fiber", accent: "sage", icon: "Wheat", topSourceFdcIds: [172421, 171705, 169705, 171688] },
  { slug: "sugar", nutrient: "sugar", accent: "gold", icon: "Candy", topSourceFdcIds: [173944, 171688, 169097, 170903] },
  { slug: "saturated-fat", nutrient: "satFat", accent: "gold", icon: "Droplets", topSourceFdcIds: [171287, 175167, 170567, 171477] },
  { slug: "sodium", nutrient: "sodium", accent: "gold", icon: "Waves", topSourceFdcIds: [170903, 171287, 168462, 175167] },
  { slug: "potassium", nutrient: "potassium", accent: "sage", icon: "Banana", topSourceFdcIds: [168482, 173944, 171705, 168462] },
  { slug: "calcium", nutrient: "calcium", accent: "brand", icon: "Milk", topSourceFdcIds: [170903, 168462, 170567, 170379] },
  { slug: "iron", nutrient: "iron", accent: "brand", icon: "Magnet", topSourceFdcIds: [168462, 172421, 169705, 170567] },
  { slug: "magnesium", nutrient: "magnesium", accent: "sage", icon: "Leaf", topSourceFdcIds: [168462, 170567, 171705, 169705] },
  { slug: "zinc", nutrient: "zinc", accent: "brand", icon: "ShieldPlus", topSourceFdcIds: [169705, 172421, 171477, 170567] },
  { slug: "vitamin-a", nutrient: "vitaminA", accent: "gold", icon: "Eye", topSourceFdcIds: [168482, 168462, 170379, 171287] },
  { slug: "vitamin-c", nutrient: "vitaminC", accent: "brand", icon: "Citrus", topSourceFdcIds: [170379, 169097, 168462, 173944] },
  { slug: "vitamin-d", nutrient: "vitaminD", accent: "gold", icon: "Sun", topSourceFdcIds: [175167, 171287] },
  { slug: "vitamin-e", nutrient: "vitaminE", accent: "sage", icon: "ShieldCheck", topSourceFdcIds: [170567, 171705, 168462, 175167] },
  { slug: "vitamin-k", nutrient: "vitaminK", accent: "sage", icon: "Sprout", topSourceFdcIds: [168462, 170379, 171705] },
  { slug: "vitamin-b6", nutrient: "vitaminB6", accent: "brand", icon: "Brain", topSourceFdcIds: [171477, 173944, 168482, 175167] },
  { slug: "vitamin-b12", nutrient: "vitaminB12", accent: "brand", icon: "Zap", topSourceFdcIds: [175167, 171287, 170903, 171477] },
  { slug: "folate", nutrient: "folate", accent: "sage", icon: "Salad", topSourceFdcIds: [172421, 168462, 170379, 171705] },
];

export function findEncyclopediaEntry(slug: string): EncyclopediaEntry | null {
  return ENCYCLOPEDIA.find((entry) => entry.slug === slug) ?? null;
}
