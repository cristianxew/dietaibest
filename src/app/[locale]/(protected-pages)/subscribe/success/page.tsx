import Link from "next/link";
import { redirect } from "next/navigation";

import { stripe } from "@/lib/stripe";
import { getCurrentSubscription } from "@/actions/subscription";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { SuccessPoller } from "./SuccessPoller";

interface SuccessPageProps {
  searchParams?: Promise<{ session_id?: string }>;
}

/**
 * Stripe Checkout success landing. NEVER grant Pro based on the `session_id`
 * alone — the webhook is authoritative. This page just shows a friendly
 * receipt and polls `getCurrentSubscription` until the webhook lands
 * (usually <3s, up to ~20s in the worst case).
 */
export default async function SubscribeSuccessPage({
  searchParams,
}: SuccessPageProps) {
  const resolved = searchParams ? await searchParams : undefined;
  const sessionId = resolved?.session_id;

  // If no session id at all, bounce back to /subscribe.
  if (!sessionId) {
    redirect("/subscribe");
  }

  let customerEmail: string | null = null;
  let amountTotal: number | null = null;
  let currency: string | null = null;

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["customer_details"],
    });
    customerEmail = session.customer_details?.email ?? null;
    amountTotal = session.amount_total ?? null;
    currency = session.currency ?? null;
  } catch (err) {
    console.warn("[subscribe/success] could not load session:", err);
  }

  const { data } = await getCurrentSubscription();
  const alreadyPro = data?.isPro ?? false;

  const formattedAmount =
    amountTotal != null && currency
      ? new Intl.NumberFormat("en", {
          style: "currency",
          currency: currency.toUpperCase(),
        }).format(amountTotal / 100)
      : null;

  return (
    <div className="max-w-xl mx-auto py-16 px-4">
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome to DietAI Pro</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <p className="text-muted-foreground">
            Payment successful. We&apos;re activating your Pro features now —
            this usually takes a few seconds.
          </p>

          {customerEmail ? (
            <div className="text-sm text-muted-foreground">
              Receipt sent to <span className="font-medium">{customerEmail}</span>
              {formattedAmount ? (
                <>
                  {" "}— <span className="font-medium">{formattedAmount}</span>
                </>
              ) : null}
            </div>
          ) : null}

          <SuccessPoller initialIsPro={alreadyPro} />

          <Button asChild className="w-full" size="lg">
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
