import { prisma } from "@/lib/prisma";
import { isPro } from "@/lib/plan";

/**
 * Freemium entitlements — the single source of truth for "what can this user do?"
 *
 * Two layers:
 *   1) Pure `check*` functions — take a user + (optional) Usage snapshot and
 *      return a typed violation or null. Zero I/O, trivially unit-testable.
 *   2) Async `assertCan*` helpers — fetch current Usage from Prisma, call the
 *      matching pure check, and hand the result to `enforce()`. Use these at
 *      the top of server actions.
 *
 * Shadow mode: while `ENTITLEMENTS_ENFORCED` is not exactly "true", violations
 * are logged but never thrown — lets us roll the gating code out without
 * breaking users while we validate it in production logs.
 *
 * Usage is always DERIVED from existing tables; no counter/ledger table is
 * added. "Per month" means the current calendar month in the server's TZ.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type FeatureKey =
  | "aiMealPlan"
  | "shoppingAutomation"
  | "recipeImport"
  | "aiChat";

export type QuotaKey =
  | "savedRecipes"
  | "recipesCreatedPerMonth"
  | "importsPerMonth"
  | "mealPlanTemplates"
  | "mealPlanDurationDays"
  | "edamamAnalysesPerMonth";

export interface Entitlements {
  isPro: boolean;
  limits: Record<QuotaKey, number>;
  features: Record<FeatureKey, boolean>;
}

export type Usage = Record<QuotaKey, number>;

interface UserLike {
  plan?: string | null;
  subscriptionStatus?: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Limits — tune here; do not hardcode anywhere else
// ─────────────────────────────────────────────────────────────────────────────

export const FREE_LIMITS: Record<QuotaKey, number> = {
  savedRecipes: 15,
  recipesCreatedPerMonth: 3,
  importsPerMonth: 0,
  mealPlanTemplates: 1,
  mealPlanDurationDays: 3,
  edamamAnalysesPerMonth: 5,
};

const PRO_LIMITS: Record<QuotaKey, number> = {
  savedRecipes: Number.POSITIVE_INFINITY,
  recipesCreatedPerMonth: Number.POSITIVE_INFINITY,
  importsPerMonth: Number.POSITIVE_INFINITY,
  mealPlanTemplates: Number.POSITIVE_INFINITY,
  mealPlanDurationDays: Number.POSITIVE_INFINITY,
  edamamAnalysesPerMonth: Number.POSITIVE_INFINITY,
};

const PRO_FEATURES: Record<FeatureKey, boolean> = {
  aiMealPlan: true,
  shoppingAutomation: true,
  recipeImport: true,
  aiChat: true,
};

const FREE_FEATURES: Record<FeatureKey, boolean> = {
  aiMealPlan: false,
  shoppingAutomation: false,
  recipeImport: false,
  aiChat: false,
};

// ─────────────────────────────────────────────────────────────────────────────
// Typed errors — carry enough info for the UI to show the right paywall
// ─────────────────────────────────────────────────────────────────────────────

export class ProOnlyError extends Error {
  readonly code = "PRO_ONLY" as const;
  constructor(public readonly feature: FeatureKey) {
    super(`Pro-only feature: ${feature}`);
    this.name = "ProOnlyError";
  }
}

export class QuotaExceededError extends Error {
  readonly code = "QUOTA_EXCEEDED" as const;
  constructor(
    public readonly quota: QuotaKey,
    public readonly limit: number,
    public readonly used: number
  ) {
    super(`Quota exceeded: ${quota} (${used}/${limit})`);
    this.name = "QuotaExceededError";
  }
}

export type EntitlementViolation = ProOnlyError | QuotaExceededError;

// ─────────────────────────────────────────────────────────────────────────────
// getEntitlements — pure
// ─────────────────────────────────────────────────────────────────────────────

export function getEntitlements(user: UserLike): Entitlements {
  const pro = isPro(user);
  return {
    isPro: pro,
    limits: pro ? PRO_LIMITS : FREE_LIMITS,
    features: pro ? PRO_FEATURES : FREE_FEATURES,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure check* — no I/O, return violation or null
// ─────────────────────────────────────────────────────────────────────────────

export function checkCanCreateRecipe(
  user: UserLike,
  usage: Usage
): EntitlementViolation | null {
  const ent = getEntitlements(user);
  if (ent.isPro) return null;

  if (usage.recipesCreatedPerMonth >= ent.limits.recipesCreatedPerMonth) {
    return new QuotaExceededError(
      "recipesCreatedPerMonth",
      ent.limits.recipesCreatedPerMonth,
      usage.recipesCreatedPerMonth
    );
  }
  if (usage.savedRecipes >= ent.limits.savedRecipes) {
    return new QuotaExceededError(
      "savedRecipes",
      ent.limits.savedRecipes,
      usage.savedRecipes
    );
  }
  return null;
}

export function checkCanImportRecipe(user: UserLike): EntitlementViolation | null {
  const ent = getEntitlements(user);
  // Free gets zero imports. This is intentional — imports run Document AI / Browser-Use,
  // which are the most expensive ops we have. Modeled as a Pro-only feature.
  if (!ent.isPro) return new ProOnlyError("recipeImport");
  return null;
}

export function checkCanUseAiMealPlan(user: UserLike): EntitlementViolation | null {
  const ent = getEntitlements(user);
  if (!ent.features.aiMealPlan) return new ProOnlyError("aiMealPlan");
  return null;
}

export function checkCanUseShoppingAutomation(
  user: UserLike
): EntitlementViolation | null {
  const ent = getEntitlements(user);
  if (!ent.features.shoppingAutomation) return new ProOnlyError("shoppingAutomation");
  return null;
}

export function checkCanUseAiChat(user: UserLike): EntitlementViolation | null {
  const ent = getEntitlements(user);
  if (!ent.features.aiChat) return new ProOnlyError("aiChat");
  return null;
}

export function checkCanCreateMealPlanTemplate(
  user: UserLike,
  usage: Usage
): EntitlementViolation | null {
  const ent = getEntitlements(user);
  if (ent.isPro) return null;

  if (usage.mealPlanTemplates >= ent.limits.mealPlanTemplates) {
    return new QuotaExceededError(
      "mealPlanTemplates",
      ent.limits.mealPlanTemplates,
      usage.mealPlanTemplates
    );
  }
  return null;
}

export function checkCanUseEdamamAnalysis(
  user: UserLike,
  usage: Usage
): EntitlementViolation | null {
  const ent = getEntitlements(user);
  if (ent.isPro) return null;

  if (usage.edamamAnalysesPerMonth >= ent.limits.edamamAnalysesPerMonth) {
    return new QuotaExceededError(
      "edamamAnalysesPerMonth",
      ent.limits.edamamAnalysesPerMonth,
      usage.edamamAnalysesPerMonth
    );
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// enforce — the single throw-or-log gate (shadow-mode kill switch)
// ─────────────────────────────────────────────────────────────────────────────

export function enforce(violation: EntitlementViolation | null): void {
  if (!violation) return;
  if (process.env.ENTITLEMENTS_ENFORCED === "true") {
    throw violation;
  }
  // Shadow mode: don't block the user, but leave a breadcrumb in logs so we
  // can see who would have been gated before flipping the flag.
  console.info(`[entitlements:shadow] would block: ${violation.message}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// getUsage — derives every counter from existing tables. No UsageCounter table.
// ─────────────────────────────────────────────────────────────────────────────

function startOfCurrentMonth(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
}

export async function getUsage(userId: string): Promise<Usage> {
  const monthStart = startOfCurrentMonth();

  const [
    savedRecipes,
    recipesCreatedPerMonth,
    importsPerMonth,
    mealPlanTemplates,
    edamamAnalysesPerMonth,
  ] = await Promise.all([
    prisma.recipe.count({ where: { userId } }),
    prisma.recipe.count({
      where: { userId, createdAt: { gte: monthStart } },
    }),
    prisma.recipe.count({
      where: {
        userId,
        source: { in: ["url", "imported"] },
        createdAt: { gte: monthStart },
      },
    }),
    prisma.mealPlanTemplate.count({ where: { userId } }),
    prisma.edamamUserMacroCache.count({
      where: { userId, createdAt: { gte: monthStart } },
    }),
  ]);

  return {
    savedRecipes,
    recipesCreatedPerMonth,
    importsPerMonth,
    mealPlanTemplates,
    // mealPlanDurationDays is per-template and validated at template-create time,
    // not a running counter. Report 0 here; the assert takes duration as an arg.
    mealPlanDurationDays: 0,
    edamamAnalysesPerMonth,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// assertCan* — fetch usage, run pure check, enforce
//
// All of these accept a pre-fetched UserLike so the caller can pass the same
// user row it already loaded (avoids a second DB round-trip in server actions).
// ─────────────────────────────────────────────────────────────────────────────

export async function assertCanCreateRecipe(
  user: UserLike & { id: string }
): Promise<void> {
  const usage = await getUsage(user.id);
  enforce(checkCanCreateRecipe(user, usage));
}

export async function assertCanImportRecipe(user: UserLike): Promise<void> {
  enforce(checkCanImportRecipe(user));
}

export async function assertCanUseAiMealPlan(user: UserLike): Promise<void> {
  enforce(checkCanUseAiMealPlan(user));
}

export async function assertCanUseShoppingAutomation(
  user: UserLike
): Promise<void> {
  enforce(checkCanUseShoppingAutomation(user));
}

export async function assertCanUseAiChat(user: UserLike): Promise<void> {
  enforce(checkCanUseAiChat(user));
}

export async function assertCanCreateMealPlanTemplate(
  user: UserLike & { id: string },
  durationDays: number
): Promise<void> {
  const usage = await getUsage(user.id);
  enforce(checkCanCreateMealPlanTemplate(user, usage));
  // Duration is a per-template constraint, not a monthly counter.
  const ent = getEntitlements(user);
  if (!ent.isPro && durationDays > ent.limits.mealPlanDurationDays) {
    enforce(
      new QuotaExceededError(
        "mealPlanDurationDays",
        ent.limits.mealPlanDurationDays,
        durationDays
      )
    );
  }
}

export async function assertCanUseEdamamAnalysis(
  user: UserLike & { id: string }
): Promise<void> {
  const usage = await getUsage(user.id);
  enforce(checkCanUseEdamamAnalysis(user, usage));
}

// ─────────────────────────────────────────────────────────────────────────────
// Serialization helper for the /api/me/entitlements route
// Infinity is not valid JSON; convert Pro limits to null over the wire.
// ─────────────────────────────────────────────────────────────────────────────

export interface SerializedEntitlements {
  isPro: boolean;
  limits: Record<QuotaKey, number | null>;
  features: Record<FeatureKey, boolean>;
  usage: Usage;
}

export function serializeEntitlements(
  ent: Entitlements,
  usage: Usage
): SerializedEntitlements {
  const limits = {} as Record<QuotaKey, number | null>;
  for (const [key, value] of Object.entries(ent.limits) as Array<
    [QuotaKey, number]
  >) {
    limits[key] = Number.isFinite(value) ? value : null;
  }
  return { isPro: ent.isPro, limits, features: ent.features, usage };
}
