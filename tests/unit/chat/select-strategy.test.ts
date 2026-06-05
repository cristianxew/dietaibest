import { describe, it, expect } from "vitest";

import { selectIngestStrategy } from "@/lib/chat/ingestion/select-strategy";

describe("selectIngestStrategy — table-driven host classification", () => {
  const VIDEO_CASES: ReadonlyArray<string> = [
    "https://www.youtube.com/watch?v=abc123",
    "https://m.youtube.com/watch?v=abc123",
    "https://youtu.be/abc123",
    "https://www.tiktok.com/@chef/video/123",
    "https://vm.tiktok.com/ZS1",
    "https://www.instagram.com/p/abc/",
    "https://www.instagram.com/reel/xyz/",
    "https://www.facebook.com/watch/?v=123",
    "https://fb.watch/abc",
    "https://x.com/user/status/123",
    "https://twitter.com/user/status/123",
    "https://mobile.twitter.com/user/status/123",
  ];

  const WEB_CASES: ReadonlyArray<string> = [
    "https://www.bonappetit.com/recipe/best-chocolate-chip-cookies",
    "https://cooking.nytimes.com/recipes/123-pasta",
    "https://www.seriouseats.com/recipes/abc",
    "https://recipes.example.org/foo",
    "http://blog.example.com/post/123",
    // Domains that look like video tools but aren't in our list
    "https://www.dailymotion.com/video/x123",
    "https://vimeo.com/123456789",
  ];

  for (const url of VIDEO_CASES) {
    it(`classifies ${url} as supadata-video`, () => {
      expect(selectIngestStrategy(url)).toBe("supadata-video");
    });
  }

  for (const url of WEB_CASES) {
    it(`classifies ${url} as supadata-web`, () => {
      expect(selectIngestStrategy(url)).toBe("supadata-web");
    });
  }

  it("rejects malformed input", () => {
    expect(() => selectIngestStrategy("not-a-url")).toThrow();
    expect(() => selectIngestStrategy("")).toThrow();
  });

  it("rejects non-http(s) protocols", () => {
    expect(() => selectIngestStrategy("ftp://example.com/file")).toThrow(
      /Unsupported URL protocol/
    );
    expect(() => selectIngestStrategy("javascript:alert(1)")).toThrow(
      /Unsupported URL protocol/
    );
  });
});
