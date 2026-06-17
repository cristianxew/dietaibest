import { describe, it, expect } from "vitest";
import {
  calculateMealMicros,
  sumMicros,
  emptyMicros,
} from "@/lib/meal-plan-macros";

describe("calculateMealMicros", () => {
  it("returns per-serving micros when mealServings is 1", () => {
    const result = calculateMealMicros(
      { iron: 8, calcium: 100, vitaminC: 30 },
      1
    );
    expect(result.iron).toBe(8);
    expect(result.calcium).toBe(100);
    expect(result.vitaminC).toBe(30);
  });

  it("scales every micro by mealServings", () => {
    const result = calculateMealMicros({ iron: 8, sodium: 200 }, 2);
    expect(result.iron).toBe(16);
    expect(result.sodium).toBe(400);
  });

  it("treats null/missing micros as zero and rounds to 1 decimal", () => {
    const result = calculateMealMicros({ iron: null, zinc: 3.33 }, 1.5);
    expect(result.iron).toBe(0);
    expect(result.zinc).toBe(5); // 3.33 * 1.5 = 4.995 -> 5
    expect(result.potassium).toBe(0); // absent key defaults to 0
  });
});

describe("sumMicros", () => {
  it("sums each micronutrient across meals", () => {
    const result = sumMicros([
      calculateMealMicros({ iron: 8, calcium: 100 }, 1),
      calculateMealMicros({ iron: 4, calcium: 50, zinc: 2 }, 1),
    ]);
    expect(result.iron).toBe(12);
    expect(result.calcium).toBe(150);
    expect(result.zinc).toBe(2);
  });

  it("returns all-zero summary for an empty list", () => {
    expect(sumMicros([])).toEqual(emptyMicros());
  });
});
