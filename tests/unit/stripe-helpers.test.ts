import { describe, it, expect } from "vitest";

import {
  stripeLocaleForNextLocale,
  currencyForLocale,
  proPriceLookupKey,
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
