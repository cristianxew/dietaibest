import { describe, it, expect } from "vitest";

import {
  redactUngroundedNutrition,
  StreamingGuardrail,
} from "@/lib/chat/nutrition-guardrail";

describe("redactUngroundedNutrition — golden inputs", () => {
  it("passes through prose with no nutrition keywords", () => {
    const r = redactUngroundedNutrition(
      "I added 2 onions and 4 tomatoes to the pan",
      new Set([])
    );
    expect(r.text).toBe("I added 2 onions and 4 tomatoes to the pan");
    expect(r.redactedCount).toBe(0);
  });

  it("redacts a hallucinated calorie number near 'kcal'", () => {
    const r = redactUngroundedNutrition(
      "This recipe has around 450 kcal per serving",
      new Set([220])
    );
    expect(r.text).toContain("[…]");
    expect(r.text).not.toContain("450");
    expect(r.redactedCount).toBe(1);
  });

  it("preserves a grounded calorie number near 'kcal'", () => {
    const r = redactUngroundedNutrition(
      "This recipe has 220 kcal per serving",
      new Set([220])
    );
    expect(r.text).toContain("220");
    expect(r.redactedCount).toBe(0);
  });

  it("redacts a hallucinated protein number near 'protein'", () => {
    const r = redactUngroundedNutrition(
      "It comes in at 38 grams of protein per portion",
      new Set([12, 220])
    );
    expect(r.text).toContain("[…]");
    expect(r.text).not.toContain("38");
    expect(r.redactedCount).toBe(1);
  });

  it("preserves Spanish nutrition prose when grounded", () => {
    const r = redactUngroundedNutrition(
      "La receta tiene 150 calorías por porción",
      new Set([150])
    );
    expect(r.text).toContain("150");
    expect(r.redactedCount).toBe(0);
  });

  it("redacts comma-decimal locale-formatted hallucinated numbers", () => {
    const r = redactUngroundedNutrition(
      "Aporta 12,5 g de fibra por porción",
      new Set([8])
    );
    expect(r.text).toContain("[…]");
    expect(r.redactedCount).toBe(1);
  });

  it("rounds to integers before comparing", () => {
    const r = redactUngroundedNutrition(
      "About 220 kcal in this dish",
      new Set([219.7])
    );
    expect(r.text).toContain("220");
    expect(r.redactedCount).toBe(0);
  });

  it("does not redact numbers far away from any nutrition keyword", () => {
    const r = redactUngroundedNutrition(
      "Bake for 25 minutes at 180 degrees. Some background info here. Some thought about calorie counts.",
      new Set([])
    );
    expect(r.text).toBe(
      "Bake for 25 minutes at 180 degrees. Some background info here. Some thought about calorie counts."
    );
    expect(r.redactedCount).toBe(0);
  });

  it("redacts multiple ungrounded numbers in one sentence", () => {
    const r = redactUngroundedNutrition(
      "About 450 kcal, 30g protein and 20g fat",
      new Set([220])
    );
    expect(r.redactedCount).toBe(3);
  });
});

describe("StreamingGuardrail", () => {
  it("buffers a number split across chunks until a safe boundary", () => {
    const g = new StreamingGuardrail([220]);
    const out1 = g.push("This dish has 45");
    const out2 = g.push("0 kcal per serving.");
    const combined = out1.text + out2.text + g.flush().text;
    expect(combined).toContain("[…]");
    expect(combined).not.toContain("450");
    expect(g.totalRedactions).toBe(1);
  });

  it("emits grounded values added after construction", () => {
    const g = new StreamingGuardrail();
    g.addGroundedValues([300]);
    const out = g.push("Has 300 kcal per serving.");
    const combined = out.text + g.flush().text;
    expect(combined).toContain("300");
    expect(g.totalRedactions).toBe(0);
  });

  it("passes prose through unchanged when no nutrition keyword appears", () => {
    const g = new StreamingGuardrail();
    const out1 = g.push("Cook the onion until soft. ");
    const out2 = g.push("Add the tomatoes.");
    const combined = out1.text + out2.text + g.flush().text;
    expect(combined).toBe("Cook the onion until soft. Add the tomatoes.");
  });
});
