import { describe, it, expect } from "vitest";

import {
  AUTH_CALLBACK_PATH,
  AUTH_RESET_PASSWORD_PATH,
  buildAuthRedirectUrl,
  classifyAuthFailure,
  localePrefix,
  readAuthCallbackParams,
  safeRedirectPath,
} from "@/lib/auth-links";

/**
 * Regression cover for the magic-link 404: the redirect URL handed to Supabase
 * must address a page that exists under `src/app/[locale]`, and the callback
 * must read the parameters Supabase actually returns (implicit flow → URL
 * fragment, not query string).
 */
describe("localePrefix", () => {
  it("omits the prefix for the default locale (localePrefix: as-needed)", () => {
    expect(localePrefix("en")).toBe("");
  });

  it("prefixes non-default locales", () => {
    expect(localePrefix("es")).toBe("/es");
    expect(localePrefix("pl")).toBe("/pl");
  });

  it("falls back to no prefix for unknown locales", () => {
    expect(localePrefix("xx")).toBe("");
  });
});

describe("buildAuthRedirectUrl", () => {
  it("builds an absolute callback URL for the default locale", () => {
    expect(
      buildAuthRedirectUrl({
        origin: "https://dietaimanager.com",
        locale: "en",
        path: AUTH_CALLBACK_PATH,
        params: { redirect: "/dashboard" },
      })
    ).toBe("https://dietaimanager.com/auth/callback?redirect=%2Fdashboard");
  });

  it("keeps the locale prefix for non-default locales", () => {
    expect(
      buildAuthRedirectUrl({
        origin: "https://dietaimanager.com",
        locale: "pl",
        path: AUTH_RESET_PASSWORD_PATH,
      })
    ).toBe("https://dietaimanager.com/pl/auth/reset-password");
  });

  it("drops empty params instead of emitting a dangling query", () => {
    expect(
      buildAuthRedirectUrl({
        origin: "http://localhost:3000",
        locale: "en",
        path: AUTH_CALLBACK_PATH,
        params: { redirect: undefined },
      })
    ).toBe("http://localhost:3000/auth/callback");
  });
});

describe("readAuthCallbackParams", () => {
  it("reads errors returned in the URL fragment", () => {
    const params = readAuthCallbackParams(
      "",
      "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired"
    );

    expect(params.error).toBe("access_denied");
    expect(params.errorCode).toBe("otp_expired");
    expect(params.errorDescription).toBe(
      "Email link is invalid or has expired"
    );
  });

  it("reads the redirect target from the query string only", () => {
    const params = readAuthCallbackParams(
      "?redirect=%2Fmeal-plans",
      "#access_token=abc&type=magiclink"
    );

    expect(params.redirect).toBe("/meal-plans");
    expect(params.type).toBe("magiclink");
  });

  it("returns an empty result when there is nothing to read", () => {
    expect(readAuthCallbackParams("", "")).toEqual({
      error: undefined,
      errorCode: undefined,
      errorDescription: undefined,
      code: undefined,
      type: undefined,
      redirect: undefined,
    });
  });
});

describe("classifyAuthFailure", () => {
  it("treats an expired OTP as expired, not as a generic error", () => {
    expect(
      classifyAuthFailure({ error: "access_denied", errorCode: "otp_expired" })
    ).toBe("expired");
  });

  it("treats a plain access_denied as denied", () => {
    expect(classifyAuthFailure({ error: "access_denied" })).toBe("denied");
  });

  it("treats malformed grants as invalid", () => {
    expect(classifyAuthFailure({ error: "invalid_grant" })).toBe("invalid");
  });

  it("falls back to a generic error", () => {
    expect(classifyAuthFailure({ error: "server_error" })).toBe("error");
  });
});

describe("safeRedirectPath", () => {
  it("keeps same-origin absolute paths", () => {
    expect(safeRedirectPath("/meal-plans")).toBe("/meal-plans");
  });

  it("rejects protocol-relative URLs that would leave the app", () => {
    expect(safeRedirectPath("//evil.example.com")).toBe("/dashboard");
  });

  it("rejects absolute URLs", () => {
    expect(safeRedirectPath("https://evil.example.com")).toBe("/dashboard");
  });

  it("falls back when no redirect is supplied", () => {
    expect(safeRedirectPath(undefined)).toBe("/dashboard");
  });
});
