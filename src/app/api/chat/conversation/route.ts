import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { getStore } from "@/lib/chat/runtime-instance";
import { resolveActiveConversation } from "@/lib/chat/conversation-prisma";
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
  // Look up the active conversation WITHOUT creating one for a pure read.
  // First-time visitors get an empty messages array; the POST handler is what
  // creates the conversation on the user's first turn.
  const active = await prisma.conversation.findFirst({
    where: { userId, archivedAt: null },
    select: { id: true },
  });
  if (!active) {
    return NextResponse.json({ messages: [] });
  }
  const store = getStore();
  const items = await store.load(active.id);
  return NextResponse.json({ messages: summarizeForClient(items) });
}

export async function DELETE() {
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Limpiar: archive the active conversation. The next POST will create a
  // fresh one. We resolve (not create) here — clearing an empty state is a no-op.
  const active = await prisma.conversation.findFirst({
    where: { userId, archivedAt: null },
    select: { id: true },
  });
  if (active) {
    const store = getStore();
    await store.clear(active.id);
  }
  return NextResponse.json({ ok: true });
}
