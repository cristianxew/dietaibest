import { describe, expect, it } from "vitest";
import { getAuthorName } from "@/lib/author-name";

describe("getAuthorName", () => {
  it("falls back to the email prefix when displayName is absent", () => {
    expect(getAuthorName({ email: "alice@example.com" })).toBe("alice");
  });

  it("prefers a non-empty displayName", () => {
    expect(
      getAuthorName({ displayName: "Chef Alice", email: "alice@example.com" })
    ).toBe("Chef Alice");
  });

  it("trims the displayName", () => {
    expect(getAuthorName({ displayName: "  Chef  ", email: "a@b.c" })).toBe(
      "Chef"
    );
  });

  it("ignores whitespace-only displayName", () => {
    expect(
      getAuthorName({ displayName: "   ", email: "alice@example.com" })
    ).toBe("alice");
  });

  it("ignores null displayName", () => {
    expect(getAuthorName({ displayName: null, email: "bob@x.io" })).toBe(
      "bob"
    );
  });
});
