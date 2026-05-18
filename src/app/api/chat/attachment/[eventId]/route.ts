import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import { deletePath } from "@/lib/storage/chat-recipe-media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DIE-41 — Immediate deletion of a chat-attached image. Owner-only.
// Idempotent: deleting an already-deleted event returns 200.
// Sets MultimodalImportEvent.deletedAt so the daily-cap query and the
// retention cron both treat the blob as already wiped.

function jsonError(status: number, code: string, message: string) {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return jsonError(401, "unauthorized", "Sign-in required");
  }

  const { eventId } = await params;
  if (!eventId) {
    return jsonError(400, "missing-event", "Missing eventId");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });
  if (!user) {
    return jsonError(404, "user-not-found", "User not found");
  }

  const event = await prisma.multimodalImportEvent.findUnique({
    where: { id: eventId },
    select: { id: true, userId: true, mediaPath: true, deletedAt: true },
  });
  if (!event) {
    return jsonError(404, "event-not-found", "Attachment not found");
  }
  if (event.userId !== user.id) {
    return jsonError(403, "forbidden", "Not your attachment");
  }
  if (event.deletedAt) {
    return new Response(
      JSON.stringify({ eventId, deletedAt: event.deletedAt }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    await deletePath(event.mediaPath);
  } catch (err) {
    // Log but continue — if the blob is already gone (manual cleanup, prior
    // failed delete) we still want to flag the event as deleted in our DB so
    // it doesn't haunt the cron forever.
    console.warn("[chat/attachment] storage delete failed", err);
  }

  const updated = await prisma.multimodalImportEvent.update({
    where: { id: eventId },
    data: { deletedAt: new Date() },
    select: { id: true, deletedAt: true },
  });

  return new Response(JSON.stringify(updated), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
