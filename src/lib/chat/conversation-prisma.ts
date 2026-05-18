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

    const firstUserItem = items.find(
      (item): item is ConversationTurnItem & { kind: "text"; text: string } =>
        item.kind === "text" && item.role === "user"
    );
    const firstUserText = firstUserItem ? firstUserItem.text : null;

    await this.prisma.$transaction([
      this.prisma.message.createMany({
        data: items.map((item) => ({
          conversationId,
          role: roleFor(item),
          content: item as unknown as Prisma.InputJsonValue,
          // DIE-38: project usage tokens into queryable columns so the monthly
          // cost cap can be derived with a plain SQL aggregate (no JSON path).
          ...(item.kind === "usage" && {
            inputTokens: item.inputTokens,
            outputTokens: item.outputTokens,
          }),
        })),
      }),
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      }),
      ...(firstUserText !== null
        ? [
            this.prisma.conversation.updateMany({
              where: { id: conversationId, title: null },
              data: { title: firstUserText.substring(0, 60) },
            }),
          ]
        : []),
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
  if (item.kind === "text") return item.role;
  if (item.kind === "metadata") return "metadata";
  if (item.kind === "usage") return "usage";
  return item.kind;
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

/**
 * Returns all conversations for a user ordered by most-recently-updated first.
 * `isActive` is true for the single conversation where archivedAt IS NULL.
 */
export async function listSessionsForUser(
  prisma: PrismaClient,
  userId: string
): Promise<
  Array<{
    id: string;
    title: string | null;
    createdAt: Date;
    updatedAt: Date;
    messageCount: number;
    isActive: boolean;
  }>
> {
  const rows = await prisma.conversation.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      archivedAt: true,
      _count: { select: { messages: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    messageCount: row._count.messages,
    isActive: row.archivedAt === null,
  }));
}

/**
 * Makes `targetId` the active conversation for `userId`.
 * Archives whatever is currently active first (uses updateMany so no error is
 * thrown if there is no current active session), then unarchives the target.
 */
export async function activateSession(
  prisma: PrismaClient,
  userId: string,
  targetId: string
): Promise<void> {
  await prisma.$transaction([
    prisma.conversation.updateMany({
      where: { userId, archivedAt: null },
      data: { archivedAt: new Date() },
    }),
    prisma.conversation.updateMany({
      where: { id: targetId, userId },
      data: { archivedAt: null },
    }),
  ]);
}

/**
 * Hard-deletes a session that belongs to `userId`.
 * Guard: only deletes when archivedAt IS NOT NULL, preventing deletion of the
 * active session. Messages cascade-delete via FK.
 */
export async function deleteSession(
  prisma: PrismaClient,
  userId: string,
  sessionId: string
): Promise<void> {
  await prisma.conversation.deleteMany({
    where: { id: sessionId, userId, archivedAt: { not: null } },
  });
}

/**
 * Deletes the last user turn (and any assistant/tool messages that followed it)
 * from a conversation. Runs inside a transaction to prevent races.
 *
 * Returns `{ deleted: number }` on success, or an error discriminant:
 *   - `"forbidden"` — conversationId does not belong to userId
 *   - `"not-found"` — the conversation has no user messages to undo
 */
export async function deleteLastTurn(
  prisma: PrismaClient,
  conversationId: string,
  userId: string
): Promise<{ deleted: number } | { error: "not-found" | "forbidden" }> {
  return prisma.$transaction(async (tx) => {
    const conversation = await tx.conversation.findFirst({
      where: { id: conversationId, userId },
      select: { id: true },
    });
    if (!conversation) return { error: "forbidden" as const };

    const lastUserMsg = await tx.message.findFirst({
      where: { conversationId, role: "user" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (!lastUserMsg) return { error: "not-found" as const };

    const result = await tx.message.deleteMany({
      where: { conversationId, createdAt: { gte: lastUserMsg.createdAt } },
    });

    return { deleted: result.count };
  });
}
