import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { getStore } from "@/lib/chat/runtime-instance";
import { activateSession, deleteSession } from "@/lib/chat/conversation-prisma";
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

/** PUT /api/chat/sessions/[id] — activate (switch to) a specific session */
export async function PUT(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const activated = await activateSession(prisma, userId, id);
  if (!activated) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }

  const store = getStore();
  const items = await store.load(id);
  const messages = summarizeForClient(items);

  return NextResponse.json({ ok: true, messages });
}

/** DELETE /api/chat/sessions/[id] — permanently delete an archived session */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Only allow deleting sessions that are already archived (not the active one)
  const { count } = await deleteSession(prisma, userId, id);

  if (count === 0) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
