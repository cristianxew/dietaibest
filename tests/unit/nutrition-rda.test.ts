import { describe, it, expect } from "vitest";
import {
  getReferenceIntakes,
  percentOfReference,
} from "@/lib/nutrition-rda";

// Fixed "now" so age derivation is deterministic.
const NOW = new Date("2020-01-01T00:00:00Z");
const dobForAge = (age: number) =>
  new Date(`${2020 - age}-06-01T00:00:00Z`);

describe("getReferenceIntakes — fallback", () => {
  it("returns standard FDA Daily Values when no profile is given", () => {
    const ref = getReferenceIntakes(undefined, NOW);
    expect(ref.source).toBe("standard");
    expect(ref.values.iron).toEqual({ value: 18, type: "goal" });
    expect(ref.values.calcium).toEqual({ value: 1300, type: "goal" });
    expect(ref.values.sodium).toEqual({ value: 2300, type: "limit" });
    // Trans fat has no reference (no safe level).
    expect(ref.values.transFat).toBeUndefined();
  });

  it("falls back to standard DV for gender 'other'", () => {
    const ref = getReferenceIntakes(
      { dateOfBirth: dobForAge(25), gender: "other" },
      NOW
    );
    expect(ref.source).toBe("standard");
    expect(ref.values.iron?.value).toBe(18);
  });

  it("falls back to standard DV for a non-adult age", () => {
    const ref = getReferenceIntakes(
      { dateOfBirth: dobForAge(12), gender: "female" },
      NOW
    );
    expect(ref.source).toBe("standard");
  });
});

describe("getReferenceIntakes — personalized by age + sex", () => {
  it("uses male 19-30 RDAs", () => {
    const ref = getReferenceIntakes(
      { dateOfBirth: dobForAge(25), gender: "male" },
      NOW
    );
    expect(ref.source).toBe("personalized");
    expect(ref.values.iron?.value).toBe(8);
    expect(ref.values.vitaminC?.value).toBe(90);
    expect(ref.values.magnesium?.value).toBe(400);
    expect(ref.values.calcium?.value).toBe(1000);
  });

  it("uses female 19-50 iron (18mg) and 31-50 magnesium (320mg)", () => {
    const ref = getReferenceIntakes(
      { dateOfBirth: dobForAge(40), gender: "female" },
      NOW
    );
    expect(ref.values.iron?.value).toBe(18);
    expect(ref.values.magnesium?.value).toBe(320);
    expect(ref.values.calcium?.value).toBe(1000);
  });

  it("drops female iron to 8mg and raises calcium to 1200mg after 50", () => {
    const ref = getReferenceIntakes(
      { dateOfBirth: dobForAge(60), gender: "female" },
      NOW
    );
    expect(ref.values.iron?.value).toBe(8);
    expect(ref.values.calcium?.value).toBe(1200);
  });

  it("raises vitamin D to 20µg and calcium to 1200mg at 71+", () => {
    const ref = getReferenceIntakes(
      { dateOfBirth: dobForAge(75), gender: "male" },
      NOW
    );
    expect(ref.values.vitaminD?.value).toBe(20);
    expect(ref.values.calcium?.value).toBe(1200);
  });

  it("keeps limit nutrients constant regardless of profile", () => {
    const ref = getReferenceIntakes(
      { dateOfBirth: dobForAge(25), gender: "male" },
      NOW
    );
    expect(ref.values.sodium).toEqual({ value: 2300, type: "limit" });
    expect(ref.values.saturatedFat).toEqual({ value: 20, type: "limit" });
  });
});

describe("percentOfReference", () => {
  it("computes percent of the reference value", () => {
    expect(percentOfReference(9, { value: 18, type: "goal" })).toBe(50);
  });

  it("returns the real percent above 100 (no cap)", () => {
    expect(percentOfReference(36, { value: 18, type: "goal" })).toBe(200);
  });

  it("returns undefined when there is no reference", () => {
    expect(percentOfReference(10, undefined)).toBeUndefined();
  });

  it("returns undefined when the reference value is zero", () => {
    expect(percentOfReference(10, { value: 0, type: "goal" })).toBeUndefined();
  });
});
