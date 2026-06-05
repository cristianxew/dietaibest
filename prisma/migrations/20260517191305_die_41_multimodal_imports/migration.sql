-- Migration: AI Chat Agent — Multimodal Imports (DIE-41)
--
-- Adds image-based recipe import tracking for the in-app chat agent. Two
-- additions:
--
-- 1. Message.attachments (JSONB, nullable) — carries
--    [{ kind: "image", mediaRef, eventId }] on user messages with an upload.
--    Null on text-only messages.
--
-- 2. MultimodalImportEvent table — one row per upload attempt. Powers:
--    - per-user daily cap (count rows WHERE userId=? AND createdAt>=startOfDay)
--    - cron retention (delete Supabase Storage blob 7d post-success / 30d
--      post-failure, then set deletedAt)
--    - user-initiated immediate deletion (DELETE /api/chat/attachment/[id])
--
-- Architecture: decision #115 (multimodal v1) + 2026-05-17 pivot (Gemini API
-- via @ai-sdk/google with gemma-4-31b-it, NOT Vertex AI — 31B is not serverless
-- on Model Garden, only the 26B MoE is).
--
-- SQL is idempotent (IF NOT EXISTS / DO blocks) to match the prisma-migrate-deploy
-- flow on the shared Supabase dev DB (precedent: DIE-39 migration b9de3c1).

-- ============================================================================
-- Message.attachments
-- ============================================================================
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "attachments" JSONB;

-- ============================================================================
-- MultimodalImportEvent table
-- ============================================================================
CREATE TABLE IF NOT EXISTS "MultimodalImportEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT,
    "messageId" TEXT,
    "recipeId" TEXT,

    "kind" TEXT NOT NULL,
    "mediaPath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,

    "outcome" TEXT NOT NULL,
    "reason" TEXT,

    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "MultimodalImportEvent_pkey" PRIMARY KEY ("id")
);

-- Foreign keys — guarded so re-runs on a populated DB don't error.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'MultimodalImportEvent_userId_fkey'
          AND table_name = 'MultimodalImportEvent'
    ) THEN
        ALTER TABLE "MultimodalImportEvent"
            ADD CONSTRAINT "MultimodalImportEvent_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'MultimodalImportEvent_conversationId_fkey'
          AND table_name = 'MultimodalImportEvent'
    ) THEN
        ALTER TABLE "MultimodalImportEvent"
            ADD CONSTRAINT "MultimodalImportEvent_conversationId_fkey"
            FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'MultimodalImportEvent_messageId_fkey'
          AND table_name = 'MultimodalImportEvent'
    ) THEN
        ALTER TABLE "MultimodalImportEvent"
            ADD CONSTRAINT "MultimodalImportEvent_messageId_fkey"
            FOREIGN KEY ("messageId") REFERENCES "Message"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'MultimodalImportEvent_recipeId_fkey'
          AND table_name = 'MultimodalImportEvent'
    ) THEN
        ALTER TABLE "MultimodalImportEvent"
            ADD CONSTRAINT "MultimodalImportEvent_recipeId_fkey"
            FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Indexes
--   (userId, createdAt)    → daily cap scan
--   (outcome, processedAt) → success retention cleanup (7d)
--   (outcome, createdAt)   → failure retention cleanup (30d)
--   (deletedAt)            → cron skip-already-cleaned rows fast

CREATE INDEX IF NOT EXISTS "MultimodalImportEvent_userId_createdAt_idx"
    ON "MultimodalImportEvent"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "MultimodalImportEvent_outcome_processedAt_idx"
    ON "MultimodalImportEvent"("outcome", "processedAt");

CREATE INDEX IF NOT EXISTS "MultimodalImportEvent_outcome_createdAt_idx"
    ON "MultimodalImportEvent"("outcome", "createdAt");

CREATE INDEX IF NOT EXISTS "MultimodalImportEvent_deletedAt_idx"
    ON "MultimodalImportEvent"("deletedAt");
