"use client";

import { useCallback, useSyncExternalStore } from "react";
import { MEDIA_QUERY, isTouchFirst, tierFromMatches } from "@/lib/responsive";
import type { ViewportTier } from "@/lib/responsive";

export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query]
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  );
}

export function useViewportTier(): ViewportTier {
  const phone = useMediaQuery(MEDIA_QUERY.phone);
  const belowDesktop = useMediaQuery(MEDIA_QUERY.belowDesktop);
  return tierFromMatches(phone, belowDesktop);
}

export function useIsTouchFirst(): boolean {
  const tier = useViewportTier();
  const coarse = useMediaQuery(MEDIA_QUERY.coarsePointer);
  return isTouchFirst(tier, coarse);
}
