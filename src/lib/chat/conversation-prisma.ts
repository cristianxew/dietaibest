import type { Prisma, PrismaClient } from "@/generated/prisma";

import type { ConversationStore } from "./conversation-store";
import type { ConversationTurnItem } from "./llm-provider";

/**
 * Durable Postgres-backed conversation store (DIE-39).
 *
 * Persists each `ConversationTurnItem` as a row in `Message`, with the full
 * item shape (kind, role, text | callId+toolName+input | callId+toolName+result)
 * stored verbatim in `content: Json`. JSONB preserves nested + partial inputs
 * exactly, so model-emitted streaming tool inputs survive round-trips intact.
 *
 * Honors decision #112: single active conversation per user. `clear()` archives
 * (sets `archivedAt`) instead of deleting messages, leaving an audit trail.
 * Use `resolveActiveConversation(prisma, userId)` to look up or create the
 * caller's active conversation; the partial unique index on
 * `Conversation(userId) WHERE archivedAt IS NULL` enforces uniqueness at the DB
 * level so a race between concurrent requests cannot create two actives.
 */
export class PrismaConversationStore implements ConversationStore {
  constructor(private readonly prisma: PrismaClient) {}

  async load(conversationId: string): Promise<ConversationTurnItem[]> {
    const rows = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
      select: { content: true },
    });
    return rows.map((r) => r.content as unknown as ConversationTurnItem);
  }

  async append(
    conversationId: string,
    items: ConversationTurnItem[]
  ): Promise<void> {
    if (items.length === 0) return;
    await this.prisma.$transaction([
      this.prisma.message.createMany({
        data: items.map((item) => ({
          conversationId,
          role: roleFor(item),
          content: item as unknown as Prisma.InputJsonValue,
        })),
      }),
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      }),
    ]);
  }

  async clear(conversationId: string): Promise<void> {
    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { archivedAt: new Date() },
    });
  }
}

function roleFor(item: ConversationTurnItem): string {
  return item.kind === "text" ? item.role : item.kind;
}

/**
 * Returns the caller's currently-active Conversation, creating one if none
 * exists. Concurrent callers may race on creation; the partial unique index
 * (`UNIQUE(userId) WHERE archivedAt IS NULL`) guarantees only one wins, and we
 * recover by re-reading the row the winner created.
 */
export async function resolveActiveConversation(
  prisma: PrismaClient,
  userId: string
): Promise<{ id: string }> {
  const existing = await prisma.conversation.findFirst({
    where: { userId, archivedAt: null },
    select: { id: true },
  });
  if (existing) return existing;

  try {
    return await prisma.conversation.create({
      data: { userId },
      select: { id: true },
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      const winner = await prisma.conversation.findFirst({
        where: { userId, archivedAt: null },
        select: { id: true },
      });
      if (winner) return winner;
    }
    throw err;
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}
