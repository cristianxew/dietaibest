import { describe, it, expect } from "vitest";

import {
  stripeLocaleForNextLocale,
  currencyForLocale,
  proPriceLookupKey,
  resolveCurrentPeriodEnd,
} from "@/lib/stripe-helpers";

describe("currencyForLocale", () => {
  it("maps en → usd", () => {
    expect(currencyForLocale("en")).toBe("usd");
  });
  it("maps es → eur", () => {
    expect(currencyForLocale("es")).toBe("eur");
  });
  it("maps pl → pln", () => {
    expect(currencyForLocale("pl")).toBe("pln");
  });
  it("falls back to usd for unknown locales", () => {
    expect(currencyForLocale("fr")).toBe("usd");
    expect(currencyForLocale("")).toBe("usd");
  });
});

describe("proPriceLookupKey", () => {
  it("builds the 6 supported combinations", () => {
    expect(proPriceLookupKey("monthly", "usd")).toBe("pro_monthly_usd");
    expect(proPriceLookupKey("yearly", "usd")).toBe("pro_yearly_usd");
    expect(proPriceLookupKey("monthly", "eur")).toBe("pro_monthly_eur");
    expect(proPriceLookupKey("yearly", "eur")).toBe("pro_yearly_eur");
    expect(proPriceLookupKey("monthly", "pln")).toBe("pro_monthly_pln");
    expect(proPriceLookupKey("yearly", "pln")).toBe("pro_yearly_pln");
  });
});

describe("stripeLocaleForNextLocale", () => {
  it("maps en → en", () => {
    expect(stripeLocaleForNextLocale("en")).toBe("en");
  });
  it("maps es → es", () => {
    expect(stripeLocaleForNextLocale("es")).toBe("es");
  });
  it("maps pl → pl", () => {
    expect(stripeLocaleForNextLocale("pl")).toBe("pl");
  });
  it("falls back to auto for unknown locales", () => {
    expect(stripeLocaleForNextLocale("fr")).toBe("auto");
    expect(stripeLocaleForNextLocale("")).toBe("auto");
  });
});

describe("resolveCurrentPeriodEnd", () => {
  // Stripe Basil (2025-03-31) moved current_period_end OFF the subscription and
  // ONTO each subscription item. Our pinned API version is post-Basil, so the
  // authoritative source is items.data[0].current_period_end.
  const EPOCH_SECONDS = 1_780_000_000; // arbitrary future epoch (seconds)
  const EXPECTED_MS = EPOCH_SECONDS * 1000;

  it("reads current_period_end from the first subscription item (post-Basil shape)", () => {
    const sub = {
      items: { data: [{ current_period_end: EPOCH_SECONDS }] },
    };
    expect(resolveCurrentPeriodEnd(sub)?.getTime()).toBe(EXPECTED_MS);
  });

  it("falls back to the legacy top-level current_period_end when items are absent", () => {
    const sub = { current_period_end: EPOCH_SECONDS };
    expect(resolveCurrentPeriodEnd(sub)?.getTime()).toBe(EXPECTED_MS);
  });

  it("prefers the item period end over the legacy top-level field", () => {
    const sub = {
      current_period_end: 1,
      items: { data: [{ current_period_end: EPOCH_SECONDS }] },
    };
    expect(resolveCurrentPeriodEnd(sub)?.getTime()).toBe(EXPECTED_MS);
  });

  it("returns null when no period end is present anywhere", () => {
    expect(resolveCurrentPeriodEnd({})).toBeNull();
    expect(resolveCurrentPeriodEnd({ items: { data: [] } })).toBeNull();
  });

  it("returns null when the period end is explicitly null", () => {
    expect(
      resolveCurrentPeriodEnd({
        current_period_end: null,
        items: { data: [{ current_period_end: null }] },
      })
    ).toBeNull();
  });
});
