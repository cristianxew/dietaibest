import { describe, expect, it } from "vitest";
import {
  MEDIA_QUERY,
  getViewportTier,
  isTouchFirst,
  tierFromMatches,
} from "@/lib/responsive";
import { splitSlotCols, stackSlotCols } from "@/components/meal-plans/layout-classes";

describe("getViewportTier", () => {
  it.each([
    [320, "phone"],
    [375, "phone"],
    [639, "phone"],
    [640, "tablet"],
    [768, "tablet"],
    [1023, "tablet"],
    [1024, "desktop"],
    [1440, "desktop"],
  ] as const)("width %i is %s", (width, tier) => {
    expect(getViewportTier(width)).toBe(tier);
  });
});

describe("tierFromMatches", () => {
  it("prefers phone when both queries match", () => {
    expect(tierFromMatches(true, true)).toBe("phone");
  });
  it("maps below-desktop only to tablet", () => {
    expect(tierFromMatches(false, true)).toBe("tablet");
  });
  it("maps no match to desktop", () => {
    expect(tierFromMatches(false, false)).toBe("desktop");
  });
});

describe("isTouchFirst", () => {
  it("is true below desktop regardless of pointer", () => {
    expect(isTouchFirst("phone", false)).toBe(true);
    expect(isTouchFirst("tablet", false)).toBe(true);
  });
  it("is true on a desktop-width coarse pointer (touch laptop, large tablet)", () => {
    expect(isTouchFirst("desktop", true)).toBe(true);
  });
  it("is false for desktop with a fine pointer", () => {
    expect(isTouchFirst("desktop", false)).toBe(false);
  });
});

describe("MEDIA_QUERY", () => {
  it("uses the same breakpoints as the tiers", () => {
    expect(MEDIA_QUERY.phone).toBe("(max-width: 639px)");
    expect(MEDIA_QUERY.belowDesktop).toBe("(max-width: 1023px)");
  });
});

describe("slot column classes", () => {
  it("starts every layout at one column so cells never drop below ~160px", () => {
    for (const n of [1, 2, 3, 4, 5, 6]) {
      expect(stackSlotCols(n).startsWith("grid-cols-1")).toBe(true);
      expect(splitSlotCols(n).startsWith("grid-cols-1")).toBe(true);
    }
  });
  it("uses four columns for four slots only from 768px", () => {
    expect(stackSlotCols(4)).toContain("min-[768px]:grid-cols-4");
    expect(splitSlotCols(4)).toContain("min-[768px]:grid-cols-4");
  });
});
