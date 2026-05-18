import { describe, it, expect, beforeEach } from "vitest";

import {
  PrismaConversationStore,
  resolveActiveConversation,
} from "@/lib/chat/conversation-prisma";
import type { ConversationTurnItem } from "@/lib/chat/llm-provider";

/**
 * Minimal in-memory stand-in for the Prisma client surface that
 * PrismaConversationStore + resolveActiveConversation depend on. Mirrors the
 * subset we actually call so we can exercise serialization without a real DB.
 */
type Row = {
  id: string;
  content: unknown;
  createdAt: Date;
  role: string;
  inputTokens: number | null;
  outputTokens: number | null;
};
type Conv = {
  id: string;
  userId: string;
  archivedAt: Date | null;
  updatedAt: Date;
};

class FakePrisma {
  public messageRows: Map<string, Row[]> = new Map();
  public conversations: Map<string, Conv> = new Map();
  public failNextCreate = false;
  public createCalls = 0;
  public findFirstCalls = 0;

  conversation = {
    findFirst: async ({
      where,
    }: {
      where: { userId: string; archivedAt: null };
    }): Promise<{ id: string } | null> => {
      this.findFirstCalls++;
      for (const c of this.conversations.values()) {
        if (c.userId === where.userId && c.archivedAt === null) {
          return { id: c.id };
        }
      }
      return null;
    },
    create: async ({
      data,
    }: {
      data: { userId: string };
    }): Promise<{ id: string }> => {
      this.createCalls++;
      if (this.failNextCreate) {
        this.failNextCreate = false;
        const err = new Error("Unique constraint failed");
        (err as Error & { code?: string }).code = "P2002";
        throw err;
      }
      const id = `conv-${this.conversations.size + 1}`;
      this.conversations.set(id, {
        id,
        userId: data.userId,
        archivedAt: null,
        updatedAt: new Date(),
      });
      return { id };
    },
    update: async ({
      where,
      data,
    }: {
      where: { id: string };
      data: Partial<Conv>;
    }): Promise<Conv> => {
      const c = this.conversations.get(where.id);
      if (!c) throw new Error("not found");
      const merged = { ...c, ...data };
      this.conversations.set(where.id, merged);
      return merged;
    },
    updateMany: async ({
      where,
      data,
    }: {
      where: { id?: string; userId?: string; title?: null; archivedAt?: null };
      data: Partial<Conv & { title?: string | null }>;
    }): Promise<{ count: number }> => {
      let count = 0;
      for (const c of this.conversations.values()) {
        const matchId = where.id === undefined || c.id === where.id;
        const matchUserId = where.userId === undefined || c.userId === where.userId;
        if (matchId && matchUserId) {
          const merged = { ...c, ...data };
          this.conversations.set(c.id, merged);
          count++;
        }
      }
      return { count };
    },
  };

  message = {
    findMany: async ({
      where,
      orderBy,
    }: {
      where: { conversationId: string };
      orderBy?: { createdAt: "asc" | "desc" };
      select?: unknown;
    }): Promise<Array<{ content: unknown }>> => {
      const rows = this.messageRows.get(where.conversationId) ?? [];
      const sorted = rows
        .slice()
        .sort(
          (a, b) =>
            (orderBy?.createdAt === "desc"
              ? b.createdAt.getTime() - a.createdAt.getTime()
              : a.createdAt.getTime() - b.createdAt.getTime())
        );
      return sorted.map((r) => ({ content: r.content }));
    },
    createMany: async ({
      data,
    }: {
      data: Array<{
        conversationId: string;
        role: string;
        content: unknown;
        inputTokens?: number;
        outputTokens?: number;
      }>;
    }): Promise<{ count: number }> => {
      for (const d of data) {
        const rows = this.messageRows.get(d.conversationId) ?? [];
        rows.push({
          id: `m-${rows.length + 1}`,
          content: JSON.parse(JSON.stringify(d.content)), // round-trip through JSON like JSONB
          createdAt: new Date(Date.now() + rows.length),
          role: d.role,
          inputTokens: d.inputTokens ?? null,
          outputTokens: d.outputTokens ?? null,
        });
        this.messageRows.set(d.conversationId, rows);
      }
      return { count: data.length };
    },
  };

  // PrismaConversationStore uses $transaction([...]) so we just await
  // all operations in sequence — semantically equivalent for the FakePrisma.
  async $transaction<T>(ops: Array<Promise<T>>): Promise<T[]> {
    return Promise.all(ops);
  }
}

// PrismaClient type is heavy; cast our fake to it for the constructor.
type AnyPrisma = ConstructorParameters<typeof PrismaConversationStore>[0];

describe("PrismaConversationStore — round-trip preserves ConversationTurnItems", () => {
  let fake: FakePrisma;
  let store: PrismaConversationStore;

  beforeEach(async () => {
    fake = new FakePrisma();
    store = new PrismaConversationStore(fake as unknown as AnyPrisma);
    fake.conversations.set("c1", {
      id: "c1",
      userId: "u1",
      archivedAt: null,
      updatedAt: new Date(),
    });
  });

  it("preserves text items (both user and assistant role)", async () => {
    const items: ConversationTurnItem[] = [
      { kind: "text", role: "user", text: "Hola, agregame una receta de pasta" },
      { kind: "text", role: "assistant", text: "Dale, ¿qué tipo de pasta?" },
    ];
    await store.append("c1", items);

    const loaded = await store.load("c1");
    expect(loaded).toEqual(items);
  });

  it("preserves tool-call items including partial / nested inputs", async () => {
    const partialInput = {
      title: "Pasta al pesto",
      ingredients: [
        { name: "fideos", qty: 200, unit: "g" },
        { name: "albahaca", qty: 50, unit: "g" },
      ],
      // partial / streamed input: model emitted a half-formed nested object
      meta: { source: "chat", attemptedAt: "2026-05-17T10:00:00Z", flags: { isDraft: true } },
    };
    const items: ConversationTurnItem[] = [
      { kind: "tool-call", callId: "c-1", toolName: "createRecipe", input: partialInput },
    ];

    await store.append("c1", items);
    const loaded = await store.load("c1");

    expect(loaded).toHaveLength(1);
    expect(loaded[0]).toEqual(items[0]);
    // Sanity: the nested input must survive the JSONB round-trip intact.
    if (loaded[0].kind === "tool-call") {
      expect(loaded[0].input).toEqual(partialInput);
    }
  });

  it("preserves tool-result items including nested data + ok/reason fields", async () => {
    const items: ConversationTurnItem[] = [
      {
        kind: "tool-result",
        callId: "c-1",
        toolName: "createRecipe",
        result: {
          ok: true,
          data: {
            recipeId: "r-42",
            persisted: true,
            details: { servings: 4, calories: 520 },
          },
        },
      },
      {
        kind: "tool-result",
        callId: "c-2",
        toolName: "deleteRecipe",
        result: { ok: false, reason: "notFound", message: "Recipe r-99 doesn't exist" },
      },
    ];

    await store.append("c1", items);
    const loaded = await store.load("c1");

    expect(loaded).toEqual(items);
  });

  it("preserves a mixed user → tool-call → tool-result → assistant sequence in order", async () => {
    const items: ConversationTurnItem[] = [
      { kind: "text", role: "user", text: "Importá esta receta" },
      {
        kind: "tool-call",
        callId: "c-1",
        toolName: "importRecipeFromUrl",
        input: { url: "https://example.com/r" },
      },
      {
        kind: "tool-result",
        callId: "c-1",
        toolName: "importRecipeFromUrl",
        result: { ok: true, data: { recipeId: "r-100", title: "Tarta" } },
      },
      { kind: "text", role: "assistant", text: "Listo, agregada como Tarta." },
    ];

    await store.append("c1", items);
    const loaded = await store.load("c1");

    expect(loaded).toEqual(items);
  });

  it("projects usage turn items into inputTokens / outputTokens columns (DIE-38)", async () => {
    const items: ConversationTurnItem[] = [
      { kind: "text", role: "user", text: "hi" },
      { kind: "text", role: "assistant", text: "hello" },
      { kind: "usage", inputTokens: 230, outputTokens: 18 },
    ];

    await store.append("c1", items);

    const rows = fake.messageRows.get("c1") ?? [];
    expect(rows).toHaveLength(3);

    const usageRow = rows.find((r) => r.role === "usage");
    expect(usageRow).toBeDefined();
    expect(usageRow?.inputTokens).toBe(230);
    expect(usageRow?.outputTokens).toBe(18);

    const userRow = rows.find((r) => r.role === "user");
    expect(userRow?.inputTokens).toBeNull();
    expect(userRow?.outputTokens).toBeNull();
  });

  it("clear() archives the conversation rather than deleting messages", async () => {
    await store.append("c1", [
      { kind: "text", role: "user", text: "hola" },
    ]);

    await store.clear("c1");

    const conv = fake.conversations.get("c1");
    expect(conv?.archivedAt).toBeInstanceOf(Date);
    // Messages stay in storage (archive, not delete).
    expect(fake.messageRows.get("c1")?.length).toBe(1);
  });
});

describe("resolveActiveConversation", () => {
  let fake: FakePrisma;

  beforeEach(() => {
    fake = new FakePrisma();
  });

  it("returns the existing active conversation for a user", async () => {
    fake.conversations.set("existing", {
      id: "existing",
      userId: "u1",
      archivedAt: null,
      updatedAt: new Date(),
    });

    const result = await resolveActiveConversation(
      fake as unknown as AnyPrisma,
      "u1"
    );
    expect(result.id).toBe("existing");
    expect(fake.createCalls).toBe(0);
  });

  it("creates a new conversation when none active exists", async () => {
    const result = await resolveActiveConversation(
      fake as unknown as AnyPrisma,
      "u1"
    );
    expect(result.id).toBe("conv-1");
    expect(fake.createCalls).toBe(1);
  });

  it("does not return an archived conversation as active", async () => {
    fake.conversations.set("archived", {
      id: "archived",
      userId: "u1",
      archivedAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await resolveActiveConversation(
      fake as unknown as AnyPrisma,
      "u1"
    );
    // Must create a fresh active conversation, not surface the archived one.
    expect(result.id).not.toBe("archived");
    expect(fake.createCalls).toBe(1);
  });

  it("recovers from partial-unique race (P2002) by re-fetching the active row", async () => {
    // Simulate the race: findFirst sees nothing (no winner yet); between our
    // findFirst and our create, another worker inserts the winner row, so our
    // create attempt hits the partial-unique index and Postgres returns P2002.
    fake.conversation.create = async () => {
      fake.createCalls++;
      fake.conversations.set("winner", {
        id: "winner",
        userId: "u1",
        archivedAt: null,
        updatedAt: new Date(),
      });
      const err = new Error("Unique constraint failed");
      (err as Error & { code?: string }).code = "P2002";
      throw err;
    };

    const result = await resolveActiveConversation(
      fake as unknown as AnyPrisma,
      "u1"
    );
    expect(result.id).toBe("winner");
    expect(fake.createCalls).toBe(1);
    expect(fake.findFirstCalls).toBeGreaterThanOrEqual(2);
  });
});
