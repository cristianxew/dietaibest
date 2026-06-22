import { describe, it, expect, vi } from "vitest";
import { IngredientCanonicalizer } from "@/lib/ingredient-canonicalizer";

function fakeClient(text: string | (() => never)) {
  return {
    models: {
      generateContent: vi.fn(async () => {
        if (typeof text === "function") text();
        return { text };
      }),
    },
  } as never;
}

describe("IngredientCanonicalizer", () => {
  it("maps each raw name to its canonical (null preserved)", async () => {
    const c = new IngredientCanonicalizer({
      clientOverride: fakeClient(
        JSON.stringify({
          items: [
            { raw: "łosoś świeży", canonical: "salmon" },
            { raw: "Posiłek 1", canonical: null },
          ],
        })
      ),
    });
    const out = await c.canonicalize(["łosoś świeży", "Posiłek 1"]);
    expect(out.get("łosoś świeży")).toBe("salmon");
    expect(out.get("Posiłek 1")).toBeNull();
  });

  it("returns an empty map on transport failure (best-effort, never throws)", async () => {
    const c = new IngredientCanonicalizer({
      clientOverride: fakeClient(() => {
        throw new Error("vertex down");
      }),
    });
    const out = await c.canonicalize(["whatever"]);
    expect(out.size).toBe(0);
  });

  it("returns an empty map for no input without calling the model", async () => {
    const client = fakeClient("{}");
    const c = new IngredientCanonicalizer({ clientOverride: client });
    const out = await c.canonicalize([]);
    expect(out.size).toBe(0);
    expect(
      (client as never as { models: { generateContent: ReturnType<typeof vi.fn> } })
        .models.generateContent
    ).not.toHaveBeenCalled();
  });
});
