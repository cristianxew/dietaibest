import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fdcFoodsByIds, type FdcFood } from "@/lib/fdc";

/** Build a JSON `Response` mirroring what the USDA FDC endpoint returns. */
function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("fdcFoodsByIds — resilient to non-array responses", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubEnv("FDC_API_KEY", "test-key");
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns [] when the API responds 200 with a non-array body ({})", async () => {
    // USDA has been observed returning `{}` on rate-limit/error with a 200,
    // so the `!res.ok` guard does not catch it. The `as FdcFood[]` cast would
    // otherwise leak `{}` straight to a `for...of` and throw "not iterable".
    fetchSpy.mockResolvedValueOnce(jsonResponse({}));

    const result = await fdcFoodsByIds([123, 456]);

    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([]);
  });

  it("returns the foods array unchanged on a normal array response", async () => {
    const foods: FdcFood[] = [
      { fdcId: 123, description: "Onion, raw", dataType: "Foundation" },
    ];
    fetchSpy.mockResolvedValueOnce(jsonResponse(foods));

    const result = await fdcFoodsByIds([123]);

    expect(result).toEqual(foods);
  });

  it("short-circuits to [] for an empty id list without hitting the network", async () => {
    const result = await fdcFoodsByIds([]);

    expect(result).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
