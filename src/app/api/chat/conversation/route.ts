import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { getStore } from "@/lib/chat/runtime-instance";
import { summarizeForClient } from "@/lib/chat/serialize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function currentUserId(): Promise<string | null> {
  const session = await getServerSession();
  if (!session?.user?.email) return null;
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  return user?.id ?? null;
}

export async function GET() {
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const store = getStore();
  const items = await store.load(`user:${userId}`);
  return NextResponse.json({ messages: summarizeForClient(items) });
}

export async function DELETE() {
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const store = getStore();
  await store.clear(`user:${userId}`);
  return NextResponse.json({ ok: true });
}
