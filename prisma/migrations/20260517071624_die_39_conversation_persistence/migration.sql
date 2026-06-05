-- Migration: AI Chat Agent — Conversation Persistence (DIE-39)
--
-- Adds Conversation + Message tables backing the in-app AI chat agent's durable
-- conversation history. Honors decision #112 (locked 2026-05-15): ONE active
-- conversation per user. The "Limpiar" action sets archivedAt; partial unique
-- index enforces single-active-conversation invariant at the DB level.
--
-- SQL is idempotent (IF NOT EXISTS) to match the project's prisma-migrate-deploy
-- flow on the shared Supabase dev DB (see commit b9de3c1 for prior precedent).

-- ============================================================================
-- Conversation table
-- ============================================================================
CREATE TABLE IF NOT EXISTS "Conversation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'Conversation_userId_fkey'
          AND table_name = 'Conversation'
    ) THEN
        ALTER TABLE "Conversation"
            ADD CONSTRAINT "Conversation_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Conversation_userId_archivedAt_idx"
    ON "Conversation"("userId", "archivedAt");

-- Partial unique index enforces single-active-conversation invariant:
-- a user may have at most one Conversation with archivedAt IS NULL.
-- This is the DB-level guard backing decision #112.
CREATE UNIQUE INDEX IF NOT EXISTS "Conversation_userId_active_unique"
    ON "Conversation"("userId") WHERE "archivedAt" IS NULL;

-- ============================================================================
-- Message table
-- ============================================================================
-- content stores a serialized ConversationTurnItem (text | tool-call | tool-result)
-- as JSONB so partial tool inputs and tool results survive round-trips intact.
CREATE TABLE IF NOT EXISTS "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'Message_conversationId_fkey'
          AND table_name = 'Message'
    ) THEN
        ALTER TABLE "Message"
            ADD CONSTRAINT "Message_conversationId_fkey"
            FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Message_conversationId_createdAt_idx"
    ON "Message"("conversationId", "createdAt");
