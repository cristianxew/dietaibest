import { describe, it, expect } from "vitest";
import { calculateAge, calculateMacros } from "@/utils/macroCalculator";

describe("calculateAge", () => {
  it("calculates age correctly for a past birthday this year", () => {
    const today = new Date();
    const birthDate = new Date(
      today.getFullYear() - 30,
      today.getMonth() - 1,
      today.getDate()
    );
    expect(calculateAge(birthDate)).toBe(30);
  });

  it("returns one year less if birthday has not occurred yet this year", () => {
    const today = new Date();
    const birthDate = new Date(
      today.getFullYear() - 25,
      today.getMonth() + 1,
      today.getDate()
    );
    expect(calculateAge(birthDate)).toBe(24);
  });

  it("handles birthday today", () => {
    const today = new Date();
    const birthDate = new Date(
      today.getFullYear() - 20,
      today.getMonth(),
      today.getDate()
    );
    expect(calculateAge(birthDate)).toBe(20);
  });
});

describe("calculateMacros", () => {
  // Male, 30yo, 80kg, 180cm, sedentary, maintain
  // BMR = 10*80 + 6.25*180 - 5*30 + 5 = 800 + 1125 - 150 + 5 = 1780
  // TDEE = 1780 * 1.2 = 2136
  // Maintain => no adjustment => 2136 calories
  const baseParams = {
    dateOfBirth: new Date(
      new Date().getFullYear() - 30,
      new Date().getMonth() - 1,
      new Date().getDate()
    ),
    gender: "male" as const,
    heightCm: 180,
    weightKg: 80,
    activityLevel: "sedentary" as const,
    dietaryGoal: "maintain",
  };

  it("calculates correct calories for male/sedentary/maintain", () => {
    const result = calculateMacros(baseParams);
    expect(result.dailyCalories).toBe(2136);
  });

  it("applies 30/40/30 macro split correctly", () => {
    const result = calculateMacros(baseParams);
    // Protein: 30% of 2136 / 4 = 160.2 => 160
    expect(result.proteinGrams).toBe(160);
    // Carbs: 40% of 2136 / 4 = 213.6 => 214
    expect(result.carbsGrams).toBe(214);
    // Fat: 30% of 2136 / 9 = 71.2 => 71
    expect(result.fatGrams).toBe(71);
  });

  it("applies -500 calorie adjustment for lose goal", () => {
    const result = calculateMacros({ ...baseParams, dietaryGoal: "lose" });
    // TDEE 2136 - 500 = 1636, which is below BMR 1780, so clamped to 1780
    expect(result.dailyCalories).toBe(1780);
  });

  it("applies +300 calorie adjustment for gain goal", () => {
    const result = calculateMacros({ ...baseParams, dietaryGoal: "gain" });
    // TDEE 2136 + 300 = 2436
    expect(result.dailyCalories).toBe(2436);
  });

  it("never returns calories below BMR", () => {
    // Very light female with lose goal to test floor
    const result = calculateMacros({
      ...baseParams,
      gender: "female" as const,
      weightKg: 50,
      heightCm: 155,
      activityLevel: "sedentary" as const,
      dietaryGoal: "lose",
    });
    // BMR female = 10*50 + 6.25*155 - 5*30 - 161 = 500 + 968.75 - 150 - 161 = 1157.75 => 1158
    // TDEE = 1157.75 * 1.2 = 1389.3 => round = 1389
    // Lose: 1389 - 500 = 889, but floor is BMR = 1158
    expect(result.dailyCalories).toBe(1158);
  });
});
