import { describe, it, expect } from "vitest";

import { buildSystemPrompt } from "@/lib/chat/system-prompt";

/**
 * The system prompt is the single layer enforcing medical-advice refusal in v1
 * (decision #117 — no regex classifier). These tests pin the structural
 * elements the prompt MUST carry so refactors can't quietly drop them.
 */
describe("buildSystemPrompt — medical refusal policy", () => {
  it.each(["en", "es", "pl"] as const)(
    "%s includes the full locked conditions list",
    (locale) => {
      const prompt = buildSystemPrompt(locale).toLowerCase();
      // PRD-mandated conditions
      expect(prompt).toMatch(/diabet/);
      expect(prompt).toMatch(/allerg|alerg|alergi/);
      expect(prompt).toMatch(/pregnan|embaraz|ciąż/);
      expect(prompt).toMatch(/kidney|riñ|nerk/);
      expect(prompt).toMatch(/liver|hígad|wątrob/);
      expect(prompt).toMatch(/eating disorder|trastorno|zaburzeni/);
      // Added per locked decision #117
      expect(prompt).toMatch(/hypertens|hipertens|nadciśn|cholesterol/);
      expect(prompt).toMatch(/cancer|cánc|chemo|quimio|nowotwór|nowotw/);
      expect(prompt).toMatch(
        /endocrine|tiroid|hipotiroid|thyroid|tarczyc/
      );
      expect(prompt).toMatch(/lactanc|breastfeed|karmieni/);
      expect(prompt).toMatch(/pediatric|infant|bebé|niemowl|primera infancia/);
    }
  );

  it.each(["en", "es", "pl"] as const)(
    "%s instructs refuse + recommend healthcare professional",
    (locale) => {
      const prompt = buildSystemPrompt(locale).toLowerCase();
      expect(prompt).toMatch(
        /healthcare|professional|profesional|lekarz|specjalist/
      );
      // Must also tell the model to keep tone warm + brief (model-generated, not robotic template)
      expect(prompt).toMatch(/brief|short|brev|krót/);
    }
  );

  it.each(["en", "es", "pl"] as const)(
    "%s distinguishes preferences (allowed) from clinical conditions (refused)",
    (locale) => {
      const prompt = buildSystemPrompt(locale).toLowerCase();
      // Preference allowlist: vegetarian/vegan/high-protein/low-sodium are NOT refused
      expect(prompt).toMatch(/vegetarian|vegan|vegano|wegetariań|wegań/);
      // Concept of preference distinct from diagnosed condition
      expect(prompt).toMatch(
        /preferenc|preferenc|prefer|condic|condit|stan|warun/
      );
    }
  );

  it.each(["en", "es", "pl"] as const)(
    "%s instructs refuse-then-redirect to cooking when applicable",
    (locale) => {
      const prompt = buildSystemPrompt(locale).toLowerCase();
      // The model is told to optionally offer cooking-side help when the topic
      // has one (e.g. "low added sugar recipes" without medical opinion).
      expect(prompt).toMatch(/cook|cocin|gotow|recipe|receta|przepis/);
      expect(prompt).toMatch(/redirect|offer|ofrec|oferow|propon/);
    }
  );

  it("keeps the nutrition guardrail clause intact", () => {
    // Regression: medical work must not displace the nutrition guardrail.
    const prompt = buildSystemPrompt("en");
    expect(prompt).toMatch(/getNutrition/);
    expect(prompt).toMatch(/\[redacted\]/);
  });
});

describe("buildSystemPrompt — output formatting", () => {
  it.each(["en", "es", "pl"] as const)(
    "%s forbids markdown — the chat UI renders plain text",
    (locale) => {
      // The drawer renders message text verbatim (no markdown parser), so any
      // **bold** / ## headers / - bullets the model emits show up as literal
      // symbols. The prompt must pin plain-text output.
      const prompt = buildSystemPrompt(locale).toLowerCase();
      expect(prompt).toMatch(/markdown/);
      expect(prompt).toMatch(/plain text|plain-text/);
    }
  );
});
