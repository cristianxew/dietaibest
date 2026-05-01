"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";

import { getCurrentSubscription } from "@/actions/subscription";

interface SuccessPollerProps {
  initialIsPro: boolean;
}

const POLL_INTERVAL_MS = 2000;
const MAX_ATTEMPTS = 10; // 10 × 2s ≈ 20s

/**
 * Polls `getCurrentSubscription` until the Stripe webhook lands the user on
 * the Pro plan, up to ~20s. The webhook is authoritative; this just waits for
 * it to catch up so the user sees a resolved state before navigating away.
 */
export function SuccessPoller({ initialIsPro }: SuccessPollerProps) {
  const [isPro, setIsPro] = useState(initialIsPro);
  const [attempts, setAttempts] = useState(0);
  const exhausted = attempts >= MAX_ATTEMPTS;

  useEffect(() => {
    if (isPro) return;
    if (exhausted) return;

    const handle = setTimeout(async () => {
      try {
        const { data } = await getCurrentSubscription();
        if (data?.isPro) {
          setIsPro(true);
          return;
        }
      } catch {
        // swallow — retry next tick
      }
      setAttempts((n) => n + 1);
    }, POLL_INTERVAL_MS);

    return () => clearTimeout(handle);
  }, [isPro, attempts, exhausted]);

  if (isPro) {
    return (
      <div className="flex items-center justify-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-500">
        <CheckCircle2 className="size-4" aria-hidden />
        Your Pro plan is active.
      </div>
    );
  }

  if (exhausted) {
    return (
      <div className="text-sm text-muted-foreground">
        Still activating your plan. Refresh this page in a moment, or check the
        dashboard — Pro will unlock automatically when Stripe confirms the
        payment.
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" aria-hidden />
      Activating your Pro plan…
    </div>
  );
}
