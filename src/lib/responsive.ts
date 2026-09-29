export const PHONE_MAX_WIDTH = 639;
export const TABLET_MAX_WIDTH = 1023;

export type ViewportTier = "phone" | "tablet" | "desktop";

export function getViewportTier(width: number): ViewportTier {
  if (width <= PHONE_MAX_WIDTH) return "phone";
  if (width <= TABLET_MAX_WIDTH) return "tablet";
  return "desktop";
}

export function tierFromMatches(phone: boolean, belowDesktop: boolean): ViewportTier {
  if (phone) return "phone";
  return belowDesktop ? "tablet" : "desktop";
}

export const MEDIA_QUERY = {
  phone: `(max-width: ${PHONE_MAX_WIDTH}px)`,
  belowDesktop: `(max-width: ${TABLET_MAX_WIDTH}px)`,
  coarsePointer: "(pointer: coarse)",
} as const;

/** Whether the tap-to-add path and long-press drag should be offered. */
export function isTouchFirst(tier: ViewportTier, coarsePointer: boolean): boolean {
  return tier !== "desktop" || coarsePointer;
}
