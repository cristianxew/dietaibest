import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { format } from "date-fns";
import { CreditCard } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getCurrentSubscription } from "@/actions/subscription";
import { FREE_LIMITS } from "@/lib/entitlements";

import { CancelButton } from "./CancelButton";
import { ResumeButton } from "./ResumeButton";
import { ManageBillingButton } from "./ManageBillingButton";

function StatusBadge({ status }: { status: string | null }) {
  const variant =
    status === "active" || status === "trialing"
      ? "default"
      : status === "past_due"
        ? "destructive"
        : "secondary";
  return (
    <Badge variant={variant} className="capitalize">
      {status ?? "—"}
    </Badge>
  );
}

export async function SettingsBilling() {
  const t = await getTranslations("billing");
  const tTrial = await getTranslations("billing.trial");
  const { data: sub } = await getCurrentSubscription();

  const isPro = sub?.isPro ?? false;
  const isTrialing = sub?.subscriptionStatus === "trialing";
  const trialEligible = sub?.trialEligible ?? false;
  const cancelAtPeriodEnd = sub?.cancelAtPeriodEnd ?? false;
  const periodEnd = sub?.currentPeriodEnd
    ? format(sub.currentPeriodEnd, "MMMM d, yyyy")
    : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-4">
        <div className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <CreditCard className="size-5 text-primary" aria-hidden />
        </div>
        <div>
          <CardTitle>Plan &amp; Billing</CardTitle>
          <CardDescription>
            Manage your subscription and payment details.
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Plan row */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold">
                {isPro ? t("plans.pro") : t("plans.free")}
              </span>
              {sub?.subscriptionStatus && (
                <StatusBadge status={sub.subscriptionStatus} />
              )}
            </div>
            {isPro && periodEnd && !cancelAtPeriodEnd && isTrialing && (
              <p className="text-xs text-muted-foreground">
                {tTrial("endsOn", { date: periodEnd })}
              </p>
            )}
            {isPro && periodEnd && !cancelAtPeriodEnd && !isTrialing && (
              <p className="text-xs text-muted-foreground">
                Renews {periodEnd}
              </p>
            )}
            {isPro && periodEnd && cancelAtPeriodEnd && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Cancels {periodEnd}
              </p>
            )}
            {!isPro && (
              <p className="text-xs text-muted-foreground">
                {FREE_LIMITS.savedRecipes} saved recipes ·{" "}
                {FREE_LIMITS.recipesCreatedPerMonth} recipes/month
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {!isPro && (
              <Button asChild size="sm">
                <Link href="/subscribe">
                  {trialEligible ? tTrial("shortCta") : t("upgradeButton")}
                </Link>
              </Button>
            )}
            {isPro && cancelAtPeriodEnd && <ResumeButton />}
            {isPro && !cancelAtPeriodEnd && <CancelButton />}
            {isPro && <ManageBillingButton />}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
