"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { LockKeyhole } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useEntitlements } from "@/hooks/useEntitlements";
import { usePaywall } from "./PaywallProvider";

export function Paywall() {
  const t = useTranslations("billing.paywall");
  const tTrial = useTranslations("billing.trial");
  const tFeatures = useTranslations("billing.featureNames");
  const tQuotas = useTranslations("billing.quotaNames");
  const { isOpen, payload, close } = usePaywall();
  const entitlements = useEntitlements();

  if (!payload) return null;

  const isProOnly = payload.code === "PRO_ONLY";

  // If the user can still start their free trial, lead with that instead of "Upgrade".
  const trialEligible =
    entitlements.status === "ready" && entitlements.data.trialEligible;
  const trialDays =
    entitlements.status === "ready" ? entitlements.data.trialDays : 14;

  const title = isProOnly ? t("proOnly.title") : t("quotaExceeded.title");
  const cta = trialEligible
    ? tTrial("paywallCta", { days: trialDays })
    : isProOnly
      ? t("proOnly.cta")
      : t("quotaExceeded.cta");

  let description: string;
  if (payload.code === "PRO_ONLY") {
    const featureName = tFeatures(payload.feature as Parameters<typeof tFeatures>[0]);
    description = `${featureName} — ${t("proOnly.description")}`;
  } else {
    const quotaName = tQuotas(payload.quota as Parameters<typeof tQuotas>[0]);
    description = t("quotaExceeded.description", {
      used: payload.used,
      limit: payload.limit,
      quotaName,
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10">
            <LockKeyhole className="size-6 text-primary" aria-hidden />
          </div>
          <DialogTitle className="text-center">{title}</DialogTitle>
          <DialogDescription className="text-center">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button asChild className="w-full" onClick={close}>
            <Link href="/subscribe">{cta}</Link>
          </Button>
          <Button variant="ghost" className="w-full" onClick={close}>
            {t("close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
