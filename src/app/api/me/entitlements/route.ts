import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import {
  getEntitlements,
  getUsage,
  serializeEntitlements,
} from "@/lib/entitlements";

/**
 * GET /api/me/entitlements
 *
 * Returns the current user's entitlement snapshot: plan status, limits,
 * feature flags, and current usage. Consumed by client components that
 * render paywalls / Pro badges / upgrade CTAs.
 *
 * Never trust the client with this — treat it as a UI hint only. All gating
 * is enforced server-side via `assertCan*` in the relevant server actions.
 */
export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, plan: true, subscriptionStatus: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const ent = getEntitlements(user);
  const usage = await getUsage(user.id);

  return NextResponse.json(serializeEntitlements(ent, usage));
}
