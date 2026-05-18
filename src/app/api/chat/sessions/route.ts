import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { getStore } from "@/lib/chat/runtime-instance";
import { listSessionsForUser } from "@/lib/chat/conversation-prisma";

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

/** GET /api/chat/sessions — list all sessions for the authenticated user */
export async function GET() {
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessions = await listSessionsForUser(prisma, userId);
  return NextResponse.json({ sessions });
}

/** POST /api/chat/sessions — archive the current active session and create a fresh one */
export async function POST() {
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Archive the currently-active conversation if one exists
  const active = await prisma.conversation.findFirst({
    where: { userId, archivedAt: null },
    select: { id: true },
  });
  if (active) {
    await getStore().clear(active.id);
  }

  // Create a new conversation
  const newConversation = await prisma.conversation.create({
    data: { userId },
    select: { id: true },
  });

  return NextResponse.json({ id: newConversation.id }, { status: 201 });
}
