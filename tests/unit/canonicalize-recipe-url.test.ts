import { describe, expect, it } from "vitest";

import { canonicalizeRecipeUrl } from "@/lib/ingest/canonicalize-url";

describe("canonicalizeRecipeUrl — invalid inputs", () => {
  it("returns null for non-URL strings (image import media paths)", () => {
    expect(canonicalizeRecipeUrl("IMG_1234.png")).toBeNull();
    expect(canonicalizeRecipeUrl("")).toBeNull();
    expect(canonicalizeRecipeUrl("user-id/event-id/jpg")).toBeNull();
  });

  it("returns null for non-http(s) protocols", () => {
    expect(canonicalizeRecipeUrl("ftp://example.com/recipe")).toBeNull();
    expect(canonicalizeRecipeUrl("javascript:alert(1)")).toBeNull();
  });
});

describe("canonicalizeRecipeUrl — generic web URLs", () => {
  it("lowercases host, strips www., and normalizes protocol to https", () => {
    expect(canonicalizeRecipeUrl("http://WWW.Example.COM/recipes/Pasta")).toBe(
      "https://example.com/recipes/Pasta"
    );
  });

  it("preserves path case (slugs and IDs are case-sensitive)", () => {
    expect(canonicalizeRecipeUrl("https://example.com/Recipes/CarbonaraX")).toBe(
      "https://example.com/Recipes/CarbonaraX"
    );
  });

  it("drops the hash fragment", () => {
    expect(canonicalizeRecipeUrl("https://example.com/recipe#ingredients")).toBe(
      "https://example.com/recipe"
    );
  });

  it("strips tracking params but keeps meaningful ones", () => {
    expect(
      canonicalizeRecipeUrl(
        "https://example.com/recipe?utm_source=x&utm_medium=y&fbclid=abc&gclid=1&id=42"
      )
    ).toBe("https://example.com/recipe?id=42");
  });

  it("sorts surviving query params for stable equality", () => {
    expect(canonicalizeRecipeUrl("https://example.com/r?b=2&a=1")).toBe(
      canonicalizeRecipeUrl("https://example.com/r?a=1&b=2")
    );
    expect(canonicalizeRecipeUrl("https://example.com/r?b=2&a=1")).toBe(
      "https://example.com/r?a=1&b=2"
    );
  });

  it("strips the trailing slash and leaves no dangling '?'", () => {
    expect(canonicalizeRecipeUrl("https://example.com/recipe/?utm_source=x")).toBe(
      "https://example.com/recipe"
    );
    expect(canonicalizeRecipeUrl("https://example.com/")).toBe("https://example.com");
  });
});

describe("canonicalizeRecipeUrl — YouTube", () => {
  const canonical = "https://youtube.com/watch?v=dQw4w9WgXcQ";

  it("normalizes youtu.be short links", () => {
    expect(canonicalizeRecipeUrl("https://youtu.be/dQw4w9WgXcQ?si=share123")).toBe(canonical);
  });

  it("normalizes mobile and music subdomains", () => {
    expect(canonicalizeRecipeUrl("https://m.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(canonical);
    expect(canonicalizeRecipeUrl("https://music.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(canonical);
  });

  it("normalizes /shorts/, /embed/ and /live/ paths to watch?v=", () => {
    expect(canonicalizeRecipeUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe(canonical);
    expect(canonicalizeRecipeUrl("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe(canonical);
    expect(canonicalizeRecipeUrl("https://www.youtube.com/live/dQw4w9WgXcQ")).toBe(canonical);
  });

  it("keeps only the v param on /watch and preserves video-id case", () => {
    expect(
      canonicalizeRecipeUrl(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=PLx&index=3&pp=ygU&feature=share"
      )
    ).toBe(canonical);
  });

  it("returns null when no video id can be extracted (no shared collision key)", () => {
    expect(canonicalizeRecipeUrl("https://youtu.be/")).toBeNull();
    expect(canonicalizeRecipeUrl("https://youtu.be/?si=x")).toBeNull();
    expect(canonicalizeRecipeUrl("https://www.youtube.com/watch?list=PLabc")).toBeNull();
    expect(canonicalizeRecipeUrl("https://www.youtube.com/shorts/")).toBeNull();
  });
});

describe("canonicalizeRecipeUrl — Instagram", () => {
  const canonical = "https://instagram.com/reel/Cxyz123AbC";

  it("normalizes /reels/ to /reel/ and drops all params", () => {
    expect(canonicalizeRecipeUrl("https://www.instagram.com/reels/Cxyz123AbC/?igsh=t0ken")).toBe(
      canonical
    );
    expect(canonicalizeRecipeUrl("https://instagram.com/reel/Cxyz123AbC")).toBe(canonical);
  });

  it("keeps only the first two path segments for post URLs", () => {
    expect(canonicalizeRecipeUrl("https://www.instagram.com/p/Cxyz123AbC/liked_by/")).toBe(
      "https://instagram.com/p/Cxyz123AbC"
    );
  });
});

describe("canonicalizeRecipeUrl — TikTok / X / Facebook", () => {
  it("drops all TikTok query params", () => {
    expect(
      canonicalizeRecipeUrl(
        "https://www.tiktok.com/@cook/video/7284920?is_from_webapp=1&sender_device=pc"
      )
    ).toBe("https://tiktok.com/@cook/video/7284920");
  });

  it("canonicalizes vm.tiktok.com short codes as-is (host+path)", () => {
    expect(canonicalizeRecipeUrl("https://vm.tiktok.com/ZM123abc/")).toBe(
      "https://vm.tiktok.com/ZM123abc"
    );
  });

  it("maps twitter.com to x.com and drops params", () => {
    expect(canonicalizeRecipeUrl("https://twitter.com/cook/status/123?s=20&t=xyz")).toBe(
      "https://x.com/cook/status/123"
    );
    expect(canonicalizeRecipeUrl("https://x.com/cook/status/123")).toBe(
      "https://x.com/cook/status/123"
    );
  });

  it("keeps only the v param on facebook.com/watch", () => {
    expect(canonicalizeRecipeUrl("https://www.facebook.com/watch/?v=555&ref=sharing")).toBe(
      "https://facebook.com/watch?v=555"
    );
  });

  it("canonicalizes fb.watch short links as-is", () => {
    expect(canonicalizeRecipeUrl("https://fb.watch/aBcD1/")).toBe("https://fb.watch/aBcD1");
  });

  it("returns null for facebook.com/watch without a v param", () => {
    expect(canonicalizeRecipeUrl("https://www.facebook.com/watch/?ref=sharing")).toBeNull();
  });
});
