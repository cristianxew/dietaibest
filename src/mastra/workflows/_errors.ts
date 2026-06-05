/**
 * Custom errors for the generateMealPlan workflow.
 */

/**
 * Thrown when the skeleton step fails after all retries.
 * Callers should abort the workflow — no slots can be resolved without the skeleton.
 */
export class SkeletonFailedError extends Error {
  readonly code = "SKELETON_FAILED" as const;
  readonly originalCause?: unknown;
  constructor(cause?: unknown) {
    super("Meal plan skeleton generation failed after all retries");
    this.name = "SkeletonFailedError";
    this.originalCause = cause;
  }
}

/**
 * Thrown by the persist step when the failure rate exceeds 25% of total slots.
 * Nothing is persisted when this is thrown.
 */
export class PlanIncompleteError extends Error {
  readonly code = "PLAN_INCOMPLETE" as const;
  constructor(
    public readonly failed: number,
    public readonly total: number
  ) {
    super(`Plan incomplete: ${failed}/${total} slots failed (>${Math.round((failed / total) * 100)}% threshold)`);
    this.name = "PlanIncompleteError";
  }
}
