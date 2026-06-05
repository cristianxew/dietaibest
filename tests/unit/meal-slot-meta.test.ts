import { describe, it, expect } from "vitest";
import { MEAL_SLOT_META } from "@/lib/meal-slot-meta";
import { MEAL_TYPES } from "@/types/meal-plan";

describe("MEAL_SLOT_META", () => {
  it("has an entry for every MealType", () => {
    for (const t of MEAL_TYPES) {
      expect(MEAL_SLOT_META[t]).toBeDefined();
      expect(MEAL_SLOT_META[t].i18nKey).toMatch(/^mealTypes\./);
      expect(MEAL_SLOT_META[t].iconName).toBeTruthy();
      expect(MEAL_SLOT_META[t].colorClass).toBeTruthy();
    }
  });
});
