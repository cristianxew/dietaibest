import { describe, it, expect } from "vitest";
import { computeRdaProfile } from "@/lib/nutrients/rda";
import {
  analyzeWeek,
  type PlannedMealInput,
  type WindowDayInput,
} from "@/lib/nutrients/week-analysis";

const rda = computeRdaProfile({}); // FDA fallback: kcal 2000, protein 50, sodium limit 2300

let mealSeq = 0;
function meal(
  perServing: PlannedMealInput["perServing"],
  over: Partial<PlannedMealInput> = {}
): PlannedMealInput {
  mealSeq += 1;
  return {
    mealId: `m${mealSeq}`,
    recipeId: `r${mealSeq}`,
    recipeTitle: `Recipe ${mealSeq}`,
    mealType: "dinner",
    servings: 1,
    coverage: "full",
    perServing,
    ...over,
  };
}

function day(date: string, meals: PlannedMealInput[]): WindowDayInput {
  return { date, planned: true, meals };
}

// Day1: sodium 2700 (over), protein 40, kcal 1500
// Day2: sodium 2800 (over), protein 25 (miss), kcal 1500
// Day3: sodium 500,         protein 20 (miss), kcal 700 (miss)
function fixture(): WindowDayInput[] {
  mealSeq = 0;
  return [
    day("2026-06-10", [
      meal({ kcal: 800, protein: 30, sodium: 1500 }), // m1
      meal({ kcal: 700, protein: 10, sodium: 1200 }), // m2
    ]),
    day("2026-06-11", [
      meal({ kcal: 900, protein: 15, sodium: 2000 }), // m3
      meal({ kcal: 600, protein: 10, sodium: 800 }), // m4
    ]),
    day("2026-06-12", [
      meal({ kcal: 700, protein: 20, sodium: 500 }), // m5
    ]),
  ];
}

describe("analyzeWeek", () => {
  it("emits a protein deficit ranked above the sodium excess", () => {
    const a = analyzeWeek(fixture(), rda);
    const kinds = a.findings.map((f) => `${f.kind}:${f.nutrient}`);
    expect(kinds[0]).toBe("deficit:protein");
    expect(kinds).toContain("excess:sodium");
  });

  it("computes deficit gap, days affected and severity", () => {
    const a = analyzeWeek(fixture(), rda);
    const p = a.findings.find((f) => f.nutrient === "protein")!;
    // gaps: (50-40)+(50-25)+(50-20) = 65 ; misses on day2+day3
    expect(p.weekGapAmount).toBeCloseTo(65);
    expect(p.daysAffected).toBe(2);
    expect(p.plannedDays).toBe(3);
    // (65 / (50*3)) * (2/3)
    expect(p.severity).toBeCloseTo(0.28889, 4);
  });

  it("computes excess gap and applies the 1.25 limit weight", () => {
    const a = analyzeWeek(fixture(), rda);
    const s = a.findings.find((f) => f.nutrient === "sodium")!;
    expect(s.kind).toBe("excess");
    expect(s.weekGapAmount).toBeCloseTo(900); // 400 + 500
    expect(s.daysAffected).toBe(2);
    // (900 / (2300*3)) * (2/3) * 1.25
    expect(s.severity).toBeCloseTo(0.108696, 4);
  });

  it("does not emit kcal findings when thresholds are not met", () => {
    const a = analyzeWeek(fixture(), rda);
    // only day3 under 0.7×2000; no day over 1.15×2000
    expect(a.findings.find((f) => f.nutrient === "kcal")).toBeUndefined();
  });

  it("attributes excess to the biggest sources, descending", () => {
    const a = analyzeWeek(fixture(), rda);
    const s = a.findings.find((f) => f.nutrient === "sodium")!;
    expect(s.topContributors.map((c) => c.mealId)).toEqual(["m3", "m1", "m2"]);
    expect(s.topContributors[0].share).toBeCloseTo(2000 / 6000);
  });

  it("attributes deficits to the lowest-amount meals, ascending", () => {
    const a = analyzeWeek(fixture(), rda);
    const p = a.findings.find((f) => f.nutrient === "protein")!;
    expect(p.topContributors.map((c) => c.mealId)).toEqual(["m2", "m4", "m3"]);
  });

  it("multiplies meal servings into day totals", () => {
    mealSeq = 0;
    const a = analyzeWeek(
      [day("2026-06-10", [meal({ kcal: 500 }, { servings: 2 })])],
      rda
    );
    expect(a.days[0].totals.kcal).toBeCloseTo(1000);
  });

  it("treats unknown nutrients as unknown, never zero", () => {
    mealSeq = 0;
    const a = analyzeWeek([day("2026-06-10", [meal({ kcal: 1000 })])], rda);
    expect("protein" in a.days[0].totals).toBe(false);
    // no known days for protein → no protein finding
    expect(a.findings.find((f) => f.nutrient === "protein")).toBeUndefined();
  });

  it("excludes unplanned days from all denominators", () => {
    const days = fixture();
    days.push({ date: "2026-06-13", planned: false, meals: [] });
    const a = analyzeWeek(days, rda);
    const p = a.findings.find((f) => f.nutrient === "protein")!;
    expect(p.plannedDays).toBe(3);
    expect(a.coverage.unplannedDays).toBe(1);
  });

  it("restricts findings to macro keys when most meals are macrosOnly", () => {
    mealSeq = 0;
    const days = [
      day("2026-06-10", [
        meal({ kcal: 700, protein: 10, fiber: 2 }, { coverage: "macrosOnly" }),
        meal({ kcal: 600, protein: 8, fiber: 1 }, { coverage: "macrosOnly" }),
        meal({ kcal: 500, protein: 9, sodium: 4000 }, { coverage: "full" }),
      ]),
    ];
    const a = analyzeWeek(days, rda);
    expect(a.microFindingsReliable).toBe(false);
    expect(a.findings.find((f) => f.nutrient === "sodium")).toBeUndefined();
    expect(a.findings.find((f) => f.nutrient === "protein")).toBeDefined();
  });

  it("reports day coverage as the worst meal coverage", () => {
    mealSeq = 0;
    const a = analyzeWeek(
      [
        day("2026-06-10", [
          meal({ kcal: 1 }),
          meal({ kcal: 1 }, { coverage: "partial" }),
        ]),
      ],
      rda
    );
    expect(a.days[0].coverage).toBe("partial");
  });
});
