import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
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

  // Archive the currently-active conversation (if any) and create a new one
  // atomically to prevent TOCTOU races against the partial unique index.
  const newConversation = await prisma.$transaction(async (tx) => {
    const active = await tx.conversation.findFirst({
      where: { userId, archivedAt: null },
      select: { id: true },
    });
    if (active) {
      await tx.conversation.update({
        where: { id: active.id },
        data: { archivedAt: new Date() },
      });
    }
    return tx.conversation.create({ data: { userId } });
  });

  return NextResponse.json({ id: newConversation.id }, { status: 201 });
}
