import { describe, it, expect } from "vitest";

import { looksLikeRefusal } from "@/lib/chat/refusal-heuristic";

describe("looksLikeRefusal — multilingual keyword match", () => {
  it("matches English refusal phrasing", () => {
    expect(
      looksLikeRefusal(
        "I can't give you medical advice on diabetes. Please talk to a healthcare professional."
      )
    ).toBe(true);
  });

  it("matches Spanish refusal phrasing (Rioplatense)", () => {
    expect(
      looksLikeRefusal(
        "No te puedo asesorar sobre tu diabetes. Consultá con un profesional de la salud."
      )
    ).toBe(true);
  });

  it("matches Spanish refusal with fused pronoun + plural ('no puedo darte consejos médicos')", () => {
    // Real reply the live eval surfaced — a valid refusal the old pattern missed
    // because it only matched singular 'dar un consejo médico'.
    expect(
      looksLikeRefusal(
        "No puedo darte consejos médicos sobre diabetes, niveles de glucosa o insulina — eso necesita supervisión de tu médico o nutricionista."
      )
    ).toBe(true);
  });

  it("does not trip on 'no puedo' for an ordinary (non-medical) decline", () => {
    expect(
      looksLikeRefusal("No puedo encontrar esa receta, ¿podés darme más detalles?")
    ).toBe(false);
  });

  it("matches a refusal mentioning a dietitian as the redirect target", () => {
    expect(
      looksLikeRefusal("I'd recommend talking to a registered dietitian about that.")
    ).toBe(true);
  });

  it("matches Polish refusal phrasing", () => {
    expect(
      looksLikeRefusal(
        "Nie mogę udzielać porad medycznych. Skonsultuj się z lekarzem."
      )
    ).toBe(true);
  });

  it("rejects ordinary cooking prose", () => {
    expect(
      looksLikeRefusal("On it — building a recipe for tomato risotto…")
    ).toBe(false);
    expect(
      looksLikeRefusal("Done. You can open it from the link above.")
    ).toBe(false);
  });

  it("rejects prose mentioning 'doctor' only incidentally", () => {
    // A recipe note mentioning 'doctor' (e.g., Dr. Pepper) shouldn't trip.
    expect(looksLikeRefusal("This goes well with Dr. Pepper.")).toBe(false);
  });
});
