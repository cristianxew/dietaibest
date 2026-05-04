import { ProOnlyError, QuotaExceededError } from "@/lib/entitlements";

/**
 * Structured entitlement error shape returned from server actions.
 * The client reads `code` to open the correct paywall variant.
 */
export type EntitlementErrorPayload =
  | { code: "PRO_ONLY"; feature: string }
  | { code: "QUOTA_EXCEEDED"; quota: string; limit: number; used: number };

/**
 * If `err` is a typed entitlement violation, returns a structured payload
 * the UI can pass directly to `paywall.open()`. Otherwise returns null so
 * the caller can fall through to its generic error handler.
 */
export function toEntitlementError(
  err: unknown
): EntitlementErrorPayload | null {
  if (err instanceof ProOnlyError) {
    return { code: "PRO_ONLY", feature: err.feature };
  }
  if (err instanceof QuotaExceededError) {
    return {
      code: "QUOTA_EXCEEDED",
      quota: err.quota,
      limit: err.limit,
      used: err.used,
    };
  }
  return null;
}
