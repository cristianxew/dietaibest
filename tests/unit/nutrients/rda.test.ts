import { describe, it, expect } from "vitest";
import { computeRdaProfile } from "@/lib/nutrients/rda";
import { ALL_NUTRIENT_KEYS } from "@/lib/nutrients/registry";

const AS_OF = new Date("2026-06-10");

function dobForAge(age: number): Date {
  return new Date(`${2026 - age}-01-15`);
}

describe("computeRdaProfile — personalized DRI path", () => {
  it("uses sex+age DRI brackets (30yo male)", () => {
    const profile = computeRdaProfile(
      { dateOfBirth: dobForAge(30), gender: "male" },
      AS_OF
    );
    expect(profile.personalized).toBe(true);
    expect(profile.entries.potassium.value).toBe(3400);
    expect(profile.entries.potassium.basis).toBe("dri");
    expect(profile.entries.iron.value).toBe(8);
    expect(profile.entries.magnesium.value).toBe(400); // 19–30 bracket
  });

  it("crosses bracket boundaries correctly (31yo male magnesium 420)", () => {
    const profile = computeRdaProfile(
      { dateOfBirth: dobForAge(31), gender: "male" },
      AS_OF
    );
    expect(profile.entries.magnesium.value).toBe(420); // 31–50 bracket
  });

  it("gives premenopausal women higher iron (35yo female: 18 mg)", () => {
    const profile = computeRdaProfile(
      { dateOfBirth: dobForAge(35), gender: "female" },
      AS_OF
    );
    expect(profile.entries.iron.value).toBe(18);
  });

  it("drops female iron to 8 mg from the 51+ bracket", () => {
    const profile = computeRdaProfile(
      { dateOfBirth: dobForAge(55), gender: "female" },
      AS_OF
    );
    expect(profile.entries.iron.value).toBe(8);
  });

  it("computes age relative to asOf (DOB 1990 → 36 → 31–50 bracket)", () => {
    const profile = computeRdaProfile(
      { dateOfBirth: new Date("1990-06-15"), gender: "male" },
      AS_OF
    );
    expect(profile.entries.magnesium.value).toBe(420);
  });
});

describe("computeRdaProfile — precedence and fallbacks", () => {
  it("user onboarding targets beat DRI for energy and macros", () => {
    const profile = computeRdaProfile(
      {
        dateOfBirth: dobForAge(30),
        gender: "male",
        dailyCalories: 2200,
        proteinGrams: 140,
        carbsGrams: 220,
        fatGrams: 70,
      },
      AS_OF
    );
    expect(profile.entries.kcal).toMatchObject({
      value: 2200,
      basis: "userTarget",
    });
    expect(profile.entries.protein).toMatchObject({
      value: 140,
      basis: "userTarget",
    });
    expect(profile.entries.carbs.value).toBe(220);
    expect(profile.entries.fat.value).toBe(70);
  });

  it("derives fiber from calories when sex/age unknown (14 g per 1000 kcal)", () => {
    const profile = computeRdaProfile({ dailyCalories: 2000 }, AS_OF);
    expect(profile.entries.fiber).toMatchObject({ value: 28, basis: "derived" });
  });

  it("falls back to FDA Daily Values for unknown sex (per-nutrient)", () => {
    const profile = computeRdaProfile({ gender: "other" }, AS_OF);
    expect(profile.personalized).toBe(false);
    expect(profile.entries.potassium).toMatchObject({
      value: 4700,
      basis: "fdaDv",
    });
    expect(profile.entries.iron.value).toBe(18); // FDA DV
  });

  it("flags personalization only when DRI or user targets applied", () => {
    expect(computeRdaProfile({}, AS_OF).personalized).toBe(false);
    expect(
      computeRdaProfile({ dailyCalories: 1800 }, AS_OF).personalized
    ).toBe(true);
  });
});

describe("computeRdaProfile — limit nutrients and completeness", () => {
  it("always includes intake limits with limit direction", () => {
    const profile = computeRdaProfile({}, AS_OF);
    expect(profile.entries.sodium.value).toBe(2300);
    expect(profile.entries.sodium.direction).toBe("limit");
    expect(profile.entries.satFat.value).toBe(20);
    expect(profile.entries.cholesterol.value).toBe(300);
    expect(profile.entries.sugar.value).toBe(50);
  });

  it("returns an entry for every registry nutrient, with positive values", () => {
    const profile = computeRdaProfile(
      { dateOfBirth: dobForAge(40), gender: "female" },
      AS_OF
    );
    for (const key of ALL_NUTRIENT_KEYS) {
      const entry = profile.entries[key];
      expect(entry, `missing entry for ${key}`).toBeDefined();
      expect(entry.value, `non-positive value for ${key}`).toBeGreaterThan(0);
      expect(entry.nutrient).toBe(key);
    }
  });
});
