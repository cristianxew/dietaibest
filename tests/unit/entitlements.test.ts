import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  FREE_LIMITS,
  ProOnlyError,
  QuotaExceededError,
  checkCanCreateMealPlanTemplate,
  checkCanCreateRecipe,
  checkCanImportRecipe,
  checkCanUseAiMealPlan,
  checkCanUseEdamamAnalysis,
  checkCanUseShoppingAutomation,
  enforce,
  getEntitlements,
  serializeEntitlements,
  type Usage,
} from "@/lib/entitlements";
import { getTrialDays } from "@/lib/stripe-helpers";

// ─────────────────────────────────────────────────────────────────────────────
// getEntitlements — pure, no I/O
// ─────────────────────────────────────────────────────────────────────────────

describe("getEntitlements", () => {
  it("returns starter entitlements for a brand-new user", () => {
    const ent = getEntitlements({ plan: "starter", subscriptionStatus: null });
    expect(ent.isPro).toBe(false);
    expect(ent.limits.savedRecipes).toBe(FREE_LIMITS.savedRecipes);
    expect(ent.limits.recipesCreatedPerMonth).toBe(FREE_LIMITS.recipesCreatedPerMonth);
    expect(ent.features.aiMealPlan).toBe(false);
    expect(ent.features.shoppingAutomation).toBe(false);
  });

  it("returns pro entitlements for plan=pro + status=active", () => {
    const ent = getEntitlements({ plan: "pro", subscriptionStatus: "active" });
    expect(ent.isPro).toBe(true);
    expect(ent.limits.savedRecipes).toBe(Number.POSITIVE_INFINITY);
    expect(ent.features.aiMealPlan).toBe(true);
    expect(ent.features.shoppingAutomation).toBe(true);
    expect(ent.features.recipeImport).toBe(true);
  });

  it("stays pro for past_due (Stripe dunning)", () => {
    const ent = getEntitlements({ plan: "pro", subscriptionStatus: "past_due" });
    expect(ent.isPro).toBe(true);
  });

  it("stays pro for trialing (legacy trial subs)", () => {
    const ent = getEntitlements({ plan: "pro", subscriptionStatus: "trialing" });
    expect(ent.isPro).toBe(true);
  });

  it("drops to starter on canceled", () => {
    const ent = getEntitlements({ plan: "pro", subscriptionStatus: "canceled" });
    expect(ent.isPro).toBe(false);
    expect(ent.features.aiMealPlan).toBe(false);
  });

  it("drops to starter on unpaid", () => {
    const ent = getEntitlements({ plan: "pro", subscriptionStatus: "unpaid" });
    expect(ent.isPro).toBe(false);
  });

  it("handles undefined plan gracefully", () => {
    const ent = getEntitlements({});
    expect(ent.isPro).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// check* helpers — pure, take user + (optional) usage, return violation or null
// ─────────────────────────────────────────────────────────────────────────────

const PRO = { plan: "pro" as const, subscriptionStatus: "active" as const };
const FREE = { plan: "starter" as const, subscriptionStatus: null };

const zeroUsage: Usage = {
  savedRecipes: 0,
  recipesCreatedPerMonth: 0,
  mealPlanTemplates: 0,
  mealPlanDurationDays: 0,
  edamamAnalysesPerMonth: 0,
};

describe("checkCanCreateRecipe", () => {
  it("allows pro users regardless of usage", () => {
    const v = checkCanCreateRecipe(PRO, {
      ...zeroUsage,
      savedRecipes: 9999,
      recipesCreatedPerMonth: 9999,
    });
    expect(v).toBeNull();
  });

  it("allows free users below both limits", () => {
    const v = checkCanCreateRecipe(FREE, {
      ...zeroUsage,
      savedRecipes: 5,
      recipesCreatedPerMonth: 1,
    });
    expect(v).toBeNull();
  });

  it("blocks free users at the monthly-create limit", () => {
    const v = checkCanCreateRecipe(FREE, {
      ...zeroUsage,
      savedRecipes: 5,
      recipesCreatedPerMonth: FREE_LIMITS.recipesCreatedPerMonth,
    });
    expect(v).toBeInstanceOf(QuotaExceededError);
    expect((v as QuotaExceededError).quota).toBe("recipesCreatedPerMonth");
    expect((v as QuotaExceededError).limit).toBe(FREE_LIMITS.recipesCreatedPerMonth);
  });

  it("blocks free users at the total-saved limit even with monthly headroom", () => {
    const v = checkCanCreateRecipe(FREE, {
      ...zeroUsage,
      savedRecipes: FREE_LIMITS.savedRecipes,
      recipesCreatedPerMonth: 0,
    });
    expect(v).toBeInstanceOf(QuotaExceededError);
    expect((v as QuotaExceededError).quota).toBe("savedRecipes");
  });

  it("allows exactly one below the total-saved limit", () => {
    const v = checkCanCreateRecipe(FREE, {
      ...zeroUsage,
      savedRecipes: FREE_LIMITS.savedRecipes - 1,
      recipesCreatedPerMonth: 0,
    });
    expect(v).toBeNull();
  });
});

describe("checkCanImportRecipe", () => {
  it("always blocks free users (Pro-only, no free imports)", () => {
    const v = checkCanImportRecipe(FREE);
    expect(v).toBeInstanceOf(ProOnlyError);
    expect((v as ProOnlyError).feature).toBe("recipeImport");
  });

  it("allows pro users", () => {
    expect(checkCanImportRecipe(PRO)).toBeNull();
  });
});

describe("checkCanUseAiMealPlan", () => {
  it("blocks free users (Pro-only)", () => {
    const v = checkCanUseAiMealPlan(FREE);
    expect(v).toBeInstanceOf(ProOnlyError);
    expect((v as ProOnlyError).feature).toBe("aiMealPlan");
  });
  it("allows pro users", () => {
    expect(checkCanUseAiMealPlan(PRO)).toBeNull();
  });
});

describe("checkCanUseShoppingAutomation", () => {
  it("blocks free users (Pro-only)", () => {
    const v = checkCanUseShoppingAutomation(FREE);
    expect(v).toBeInstanceOf(ProOnlyError);
    expect((v as ProOnlyError).feature).toBe("shoppingAutomation");
  });
  it("allows pro users", () => {
    expect(checkCanUseShoppingAutomation(PRO)).toBeNull();
  });
});

describe("checkCanCreateMealPlanTemplate", () => {
  it("allows pro users regardless", () => {
    const v = checkCanCreateMealPlanTemplate(PRO, {
      ...zeroUsage,
      mealPlanTemplates: 999,
    });
    expect(v).toBeNull();
  });

  it("allows free users below the template limit", () => {
    const v = checkCanCreateMealPlanTemplate(FREE, { ...zeroUsage, mealPlanTemplates: 0 });
    expect(v).toBeNull();
  });

  it("blocks free users at the template limit", () => {
    const v = checkCanCreateMealPlanTemplate(FREE, {
      ...zeroUsage,
      mealPlanTemplates: FREE_LIMITS.mealPlanTemplates,
    });
    expect(v).toBeInstanceOf(QuotaExceededError);
    expect((v as QuotaExceededError).quota).toBe("mealPlanTemplates");
  });
});

describe("checkCanUseEdamamAnalysis", () => {
  it("allows pro users regardless", () => {
    const v = checkCanUseEdamamAnalysis(PRO, {
      ...zeroUsage,
      edamamAnalysesPerMonth: 9999,
    });
    expect(v).toBeNull();
  });

  it("allows free users below the monthly analysis limit", () => {
    const v = checkCanUseEdamamAnalysis(FREE, {
      ...zeroUsage,
      edamamAnalysesPerMonth: FREE_LIMITS.edamamAnalysesPerMonth - 1,
    });
    expect(v).toBeNull();
  });

  it("blocks free users at the monthly analysis limit", () => {
    const v = checkCanUseEdamamAnalysis(FREE, {
      ...zeroUsage,
      edamamAnalysesPerMonth: FREE_LIMITS.edamamAnalysesPerMonth,
    });
    expect(v).toBeInstanceOf(QuotaExceededError);
    expect((v as QuotaExceededError).quota).toBe("edamamAnalysesPerMonth");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// enforce() — the throw-or-log shadow-mode helper
// ─────────────────────────────────────────────────────────────────────────────

describe("enforce (shadow mode)", () => {
  const originalFlag = process.env.ENTITLEMENTS_ENFORCED;
  let infoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    infoSpy.mockRestore();
    if (originalFlag === undefined) {
      delete process.env.ENTITLEMENTS_ENFORCED;
    } else {
      process.env.ENTITLEMENTS_ENFORCED = originalFlag;
    }
  });

  it("is a no-op when violation is null", () => {
    process.env.ENTITLEMENTS_ENFORCED = "true";
    expect(() => enforce(null)).not.toThrow();
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it("throws the violation when ENTITLEMENTS_ENFORCED=true", () => {
    process.env.ENTITLEMENTS_ENFORCED = "true";
    const err = new ProOnlyError("aiMealPlan");
    expect(() => enforce(err)).toThrow(ProOnlyError);
  });

  it("logs and does NOT throw when ENTITLEMENTS_ENFORCED is not 'true'", () => {
    process.env.ENTITLEMENTS_ENFORCED = "false";
    const err = new QuotaExceededError("savedRecipes", 15, 15);
    expect(() => enforce(err)).not.toThrow();
    expect(infoSpy).toHaveBeenCalledOnce();
    const msg = infoSpy.mock.calls[0]?.[0] as string;
    expect(msg).toContain("[entitlements:shadow]");
    expect(msg).toContain("savedRecipes");
  });

  it("logs and does NOT throw when ENTITLEMENTS_ENFORCED is unset", () => {
    delete process.env.ENTITLEMENTS_ENFORCED;
    expect(() => enforce(new ProOnlyError("shoppingAutomation"))).not.toThrow();
    expect(infoSpy).toHaveBeenCalledOnce();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Typed errors — serialization + instanceof
// ─────────────────────────────────────────────────────────────────────────────

describe("typed errors", () => {
  it("ProOnlyError exposes code + feature", () => {
    const err = new ProOnlyError("aiMealPlan");
    expect(err.code).toBe("PRO_ONLY");
    expect(err.feature).toBe("aiMealPlan");
    expect(err.name).toBe("ProOnlyError");
    expect(err).toBeInstanceOf(Error);
  });

  it("QuotaExceededError exposes code + quota + limit + used", () => {
    const err = new QuotaExceededError("savedRecipes", 15, 15);
    expect(err.code).toBe("QUOTA_EXCEEDED");
    expect(err.quota).toBe("savedRecipes");
    expect(err.limit).toBe(15);
    expect(err.used).toBe(15);
    expect(err.name).toBe("QuotaExceededError");
    expect(err).toBeInstanceOf(Error);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// importsPerMonth removed — recipeImport is a hard Pro-only feature, the
// per-month counter never gated anything. Guard against it sneaking back.
// ─────────────────────────────────────────────────────────────────────────────

describe("importsPerMonth removal", () => {
  it("is absent from the free limits map", () => {
    expect("importsPerMonth" in FREE_LIMITS).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// serializeEntitlements — wire-format + trial fields + shadow-mode UI unlock
// ─────────────────────────────────────────────────────────────────────────────

describe("serializeEntitlements", () => {
  const originalFlag = process.env.ENTITLEMENTS_ENFORCED;

  afterEach(() => {
    if (originalFlag === undefined) delete process.env.ENTITLEMENTS_ENFORCED;
    else process.env.ENTITLEMENTS_ENFORCED = originalFlag;
  });

  it("maps Infinity pro limits to null over the wire", () => {
    process.env.ENTITLEMENTS_ENFORCED = "true";
    const ent = getEntitlements(PRO);
    const s = serializeEntitlements(ent, zeroUsage, {
      trialEligible: false,
      trialDays: 14,
    });
    expect(s.limits.savedRecipes).toBeNull();
    expect(s.isPro).toBe(true);
  });

  it("carries trialEligible + trialDays through", () => {
    process.env.ENTITLEMENTS_ENFORCED = "true";
    const ent = getEntitlements(FREE);
    const s = serializeEntitlements(ent, zeroUsage, {
      trialEligible: true,
      trialDays: 7,
    });
    expect(s.trialEligible).toBe(true);
    expect(s.trialDays).toBe(7);
  });

  it("when enforced, a free user sees locked features (real entitlements)", () => {
    process.env.ENTITLEMENTS_ENFORCED = "true";
    const ent = getEntitlements(FREE);
    const s = serializeEntitlements(ent, zeroUsage, {
      trialEligible: true,
      trialDays: 14,
    });
    expect(s.features.aiChat).toBe(false);
    expect(s.limits.savedRecipes).toBe(FREE_LIMITS.savedRecipes);
  });

  it("when NOT enforced, a free user sees everything unlocked in the UI (kill switch)", () => {
    process.env.ENTITLEMENTS_ENFORCED = "false";
    const ent = getEntitlements(FREE);
    const s = serializeEntitlements(ent, zeroUsage, {
      trialEligible: true,
      trialDays: 14,
    });
    // Features all on, limits all unlimited (null), but isPro stays truthful.
    expect(s.features.aiChat).toBe(true);
    expect(s.features.aiMealPlan).toBe(true);
    expect(s.limits.savedRecipes).toBeNull();
    expect(s.isPro).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getTrialDays — reads STRIPE_TRIAL_DAYS, defaults to 14, rejects junk
// ─────────────────────────────────────────────────────────────────────────────

describe("getTrialDays", () => {
  const original = process.env.STRIPE_TRIAL_DAYS;

  afterEach(() => {
    if (original === undefined) delete process.env.STRIPE_TRIAL_DAYS;
    else process.env.STRIPE_TRIAL_DAYS = original;
  });

  it("defaults to 14 when unset", () => {
    delete process.env.STRIPE_TRIAL_DAYS;
    expect(getTrialDays()).toBe(14);
  });

  it("reads a valid positive integer from the env", () => {
    process.env.STRIPE_TRIAL_DAYS = "7";
    expect(getTrialDays()).toBe(7);
  });

  it("falls back to 14 on non-numeric or non-positive values", () => {
    process.env.STRIPE_TRIAL_DAYS = "abc";
    expect(getTrialDays()).toBe(14);
    process.env.STRIPE_TRIAL_DAYS = "0";
    expect(getTrialDays()).toBe(14);
    process.env.STRIPE_TRIAL_DAYS = "-5";
    expect(getTrialDays()).toBe(14);
  });
});
