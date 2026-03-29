import { describe, it, expect } from "vitest";
import {
  formatNutrientValue,
  parseLocaleNumber,
  getLocaleFromLanguage,
} from "@/lib/localeFormatting";

describe("formatNutrientValue", () => {
  it("formats with 1 decimal by default in en-US", () => {
    expect(formatNutrientValue(123.456, "en-US")).toBe("123.5");
  });

  it("formats with 0 decimals when specified", () => {
    expect(formatNutrientValue(123.456, "en-US", 0)).toBe("123");
  });

  it("returns '0' for NaN input", () => {
    expect(formatNutrientValue(NaN, "en-US")).toBe("0");
  });

  it("returns '0' for non-number input", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(formatNutrientValue("hello" as any, "en-US")).toBe("0");
  });

  it("formats zero correctly", () => {
    expect(formatNutrientValue(0, "en-US")).toBe("0.0");
  });
});

describe("parseLocaleNumber", () => {
  it("parses period decimal separator", () => {
    expect(parseLocaleNumber("123.5")).toBe(123.5);
  });

  it("parses comma decimal separator", () => {
    expect(parseLocaleNumber("123,5")).toBe(123.5);
  });

  it("parses number with spaces (thousands separator)", () => {
    expect(parseLocaleNumber("1 234,5")).toBe(1234.5);
  });

  it("returns 0 for empty string", () => {
    expect(parseLocaleNumber("")).toBe(0);
  });

  it("returns 0 for non-numeric string", () => {
    expect(parseLocaleNumber("abc")).toBe(0);
  });
});

describe("getLocaleFromLanguage", () => {
  it("maps 'en' to 'en-US'", () => {
    expect(getLocaleFromLanguage("en")).toBe("en-US");
  });

  it("maps 'es' to 'es-ES'", () => {
    expect(getLocaleFromLanguage("es")).toBe("es-ES");
  });

  it("maps 'pl' to 'pl-PL'", () => {
    expect(getLocaleFromLanguage("pl")).toBe("pl-PL");
  });

  it("falls back to 'en-US' for unknown language", () => {
    expect(getLocaleFromLanguage("fr")).toBe("en-US");
  });
});
