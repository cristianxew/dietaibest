import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/stripe", async () => {
  const helpers = await vi.importActual<typeof import("@/lib/stripe-helpers")>(
    "@/lib/stripe-helpers"
  );
  return {
    resolvePrice: vi.fn(),
    proPriceLookupKey: helpers.proPriceLookupKey,
    currencyForLocale: helpers.currencyForLocale,
    getTrialDays: vi.fn(() => 14),
  };
});

import { resolvePrice } from "@/lib/stripe";
import { formatPrice } from "@/lib/format-price";
import { loadLandingPricing, yearlySavingsPercent } from "@/components/landing/pricing-data";

const price = (unitAmount: number, currency: string) =>
  ({ id: `price_${unitAmount}`, unit_amount: unitAmount, currency }) as never;

describe("formatPrice", () => {
  it("drops decimals for whole amounts and keeps two for fractional ones", () => {
    expect(formatPrice(900, "usd", "en")).toBe("$9");
    expect(formatPrice(999, "usd", "en")).toBe("$9.99");
    expect(formatPrice(1990, "usd", "en")).toBe("$19.90");
  });

  it("formats in the locale's conventions", () => {
    expect(formatPrice(0, "pln", "pl")).toMatch(/^0\s?zł$/);
    expect(formatPrice(499, "eur", "es")).toMatch(/^4,99\s?€$/);
  });

  it("renders an em dash when Stripe has no unit amount", () => {
    expect(formatPrice(null, "usd", "en")).toBe("—");
  });
});

describe("yearlySavingsPercent", () => {
  it("rounds the saving against twelve monthly payments", () => {
    expect(yearlySavingsPercent(999, 7999)).toBe(33);
    expect(yearlySavingsPercent(1000, 9600)).toBe(20);
  });

  it("returns null when yearly is not cheaper or a price is missing", () => {
    expect(yearlySavingsPercent(1000, 12000)).toBeNull();
    expect(yearlySavingsPercent(1000, 15000)).toBeNull();
    expect(yearlySavingsPercent(0, 9600)).toBeNull();
  });
});

describe("loadLandingPricing", () => {
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  beforeEach(() => {
    vi.mocked(resolvePrice).mockReset();
    errorSpy.mockClear();
  });

  it("resolves the locale's lookup keys and formats both prices", async () => {
    vi.mocked(resolvePrice).mockImplementation(async (key) =>
      key === "pro_monthly_eur" ? price(999, "eur") : price(7999, "eur")
    );

    const pricing = await loadLandingPricing("es");

    expect(vi.mocked(resolvePrice).mock.calls.map(([key]) => key).sort()).toEqual([
      "pro_monthly_eur",
      "pro_yearly_eur",
    ]);
    expect(pricing.currency).toBe("EUR");
    expect(pricing.trialDays).toBe(14);
    expect(pricing.monthly?.label).toMatch(/^9,99\s?€$/);
    expect(pricing.yearly?.label).toMatch(/^79,99\s?€$/);
    expect(pricing.yearlySavingsPercent).toBe(33);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("drops only the price that failed and logs it", async () => {
    vi.mocked(resolvePrice).mockImplementation(async (key) => {
      if (key === "pro_yearly_usd") throw new Error("not found");
      return price(999, "usd");
    });

    const pricing = await loadLandingPricing("en");

    expect(pricing.monthly?.label).toBe("$9.99");
    expect(pricing.yearly).toBeNull();
    expect(pricing.yearlySavingsPercent).toBeNull();
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("never throws when Stripe is unavailable", async () => {
    vi.mocked(resolvePrice).mockRejectedValue(new Error("STRIPE_SECRET_KEY is not set"));

    const pricing = await loadLandingPricing("pl");

    expect(pricing).toMatchObject({ currency: "PLN", monthly: null, yearly: null });
    expect(pricing.freeLabel).toMatch(/^0\s?zł$/);
    expect(errorSpy).toHaveBeenCalledTimes(2);
  });
});
