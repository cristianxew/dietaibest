import { describe, it, expect } from "vitest";
import type { Finding, PlannedMealInput } from "@/lib/nutrients/week-analysis";
import {
  scoreSwaps,
  type SwapCandidate,
  type SwapContext,
} from "@/lib/nutrients/swap-scorer";

const oldMeal: PlannedMealInput = {
  mealId: "meal1",
  recipeId: "old",
  recipeTitle: "Carbonara",
  mealType: "dinner",
  servings: 1,
  coverage: "full",
  perServing: { kcal: 800, sodium: 1500, protein: 30 },
};

const sodiumExcess: Finding = {
  id: "excess:sodium",
  kind: "excess",
  nutrient: "sodium",
  daysAffected: 2,
  plannedDays: 3,
  weekGapAmount: 900,
  severity: 0.11,
  topContributors: [],
};

const proteinDeficit: Finding = {
  id: "deficit:protein",
  kind: "deficit",
  nutrient: "protein",
  daysAffected: 2,
  plannedDays: 3,
  weekGapAmount: 65,
  severity: 0.29,
  topContributors: [],
};

function candidate(
  id: string,
  perServing: SwapCandidate["perServing"],
  over: Partial<SwapCandidate> = {}
): SwapCandidate {
  return {
    recipeId: id,
    title: id,
    perServing,
    coverage: "full",
    ingredientNames: ["tomato", "rice"],
    ...over,
  };
}

function ctx(over: Partial<SwapContext> = {}): SwapContext {
  return {
    meal: oldMeal,
    target: sodiumExcess,
    findings: [proteinDeficit, sodiumExcess],
    allergies: [],
    ...over,
  };
}

describe("scoreSwaps", () => {
  it("ranks by gap closure and quantifies week deltas", () => {
    const out = scoreSwaps(ctx(), [
      candidate("good", { kcal: 750, sodium: 600, protein: 28 }),
      candidate("weak", { kcal: 780, sodium: 1200, protein: 30 }),
    ]);
    expect(out.map((s) => s.candidateRecipeId)).toEqual(["good", "weak"]);
    expect(out[0].deltas.sodium).toBeCloseTo(-900);
    expect(out[0].gapClosure).toBeCloseTo(1); // closes the whole 900mg gap
    expect(out[1].gapClosure).toBeCloseTo(300 / 900);
  });

  it("penalizes swaps that worsen another finding and lists the tradeoff", () => {
    const out = scoreSwaps(ctx(), [
      candidate("clean", { kcal: 780, sodium: 900, protein: 30 }),
      candidate("costly", { kcal: 780, sodium: 900, protein: 10 }),
    ]);
    const clean = out.find((s) => s.candidateRecipeId === "clean")!;
    const costly = out.find((s) => s.candidateRecipeId === "costly")!;
    // both close 600/900; costly loses 20g protein → penalty 20/65
    expect(clean.score).toBeGreaterThan(costly.score);
    expect(costly.score).toBeCloseTo(600 / 900 - 0.5 * (20 / 65), 4);
    expect(costly.tradeoffs).toContain("protein");
    expect(clean.tradeoffs).toEqual([]);
  });

  it("excludes candidates outside the ±25% kcal band", () => {
    const out = scoreSwaps(ctx(), [candidate("huge", { kcal: 1200, sodium: 100 })]);
    expect(out).toEqual([]);
  });

  it("excludes candidates that do not know the target nutrient", () => {
    const out = scoreSwaps(ctx(), [candidate("blind", { kcal: 790 })]);
    expect(out).toEqual([]);
  });

  it("excludes the current recipe and allergen matches", () => {
    const out = scoreSwaps(ctx({ allergies: ["peanut"] }), [
      candidate("old", { kcal: 800, sodium: 100 }),
      candidate(
        "nutty",
        { kcal: 800, sodium: 100 },
        { ingredientNames: ["peanut butter"] }
      ),
    ]);
    expect(out).toEqual([]);
  });

  it("drops suggestions that close less than 5% of the gap", () => {
    const out = scoreSwaps(ctx(), [candidate("noop", { kcal: 800, sodium: 1480 })]);
    expect(out).toEqual([]); // closes 20/900 ≈ 2%
  });

  it("supports deficit targets (more of the nutrient closes the gap)", () => {
    const out = scoreSwaps(ctx({ target: proteinDeficit }), [
      candidate("protein-up", { kcal: 820, sodium: 1400, protein: 55 }),
    ]);
    expect(out[0].gapClosure).toBeCloseTo(25 / 65);
  });

  it("ignores below-floor noise in tradeoffs", () => {
    const out = scoreSwaps(ctx(), [
      candidate("noise", { kcal: 790, sodium: 600, protein: 28 }), // protein −2g < 5g floor
    ]);
    expect(out[0].tradeoffs).toEqual([]);
  });
});
