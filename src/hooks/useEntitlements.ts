"use client";

import { useEffect, useState } from "react";
import type { SerializedEntitlements } from "@/lib/entitlements";

type EntitlementsState =
  | { status: "loading"; data: null }
  | { status: "ready"; data: SerializedEntitlements }
  | { status: "error"; data: null };

/**
 * Fetches the current user's entitlements from /api/me/entitlements.
 *
 * Returns a stable snapshot. Callers that need live updates after a
 * subscription change should use the `refetch` function or pass
 * `initialData` from a server parent to avoid the loading flash.
 *
 * IMPORTANT: this is a UI HINT only. All real enforcement is server-side.
 */
export function useEntitlements(
  initialData?: SerializedEntitlements
): EntitlementsState & { refetch: () => void } {
  const [state, setState] = useState<EntitlementsState>(
    initialData
      ? { status: "ready", data: initialData }
      : { status: "loading", data: null }
  );
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (initialData && tick === 0) return;

    let cancelled = false;
    fetch("/api/me/entitlements")
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json() as Promise<SerializedEntitlements>;
      })
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error", data: null });
      });

    return () => {
      cancelled = true;
    };
  }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps

  const refetch = () => setTick((n) => n + 1);

  return { ...state, refetch };
}
