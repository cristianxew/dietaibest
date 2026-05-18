import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { deleteLastTurn } from "@/lib/chat/conversation-prisma";

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

/**
 * DELETE /api/chat/conversation/last-turn
 * Deletes the last user message and all subsequent messages (assistant/tool).
 * Used to retry a turn from scratch.
 */
export async function DELETE() {
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find the currently-active conversation
  const active = await prisma.conversation.findFirst({
    where: { userId, archivedAt: null },
    select: { id: true },
  });
  if (!active) {
    return NextResponse.json({ error: "no-active-session" }, { status: 404 });
  }

  const result = await deleteLastTurn(prisma, active.id, userId);

  if ("error" in result) {
    if (result.error === "not-found") {
      return NextResponse.json({ error: "no-messages" }, { status: 404 });
    }
    // "forbidden" — conversationId doesn't belong to userId (shouldn't happen
    // here since we looked it up by userId, but guard it anyway)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ deleted: result.deleted });
}
