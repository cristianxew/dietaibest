-- Migration: AI Chat Agent — Message token usage columns (DIE-38)
--
-- Adds inputTokens / outputTokens columns to Message so per-user monthly LLM
-- cost is a derived counter (sum over current month), matching the existing
-- `getUsage` pattern in src/lib/entitlements.ts. No new ledger table.
--
-- The columns are NULLABLE because:
--   - Older messages predate the column (back-fill not needed; null = "we have
--     no usage data for this row" which is fine for a sum-with-nulls query).
--   - Not every Message row carries usage (user messages, tool-call/result
--     rows). Only the assistant message that closes an LLM step gets filled.
--
-- The extra index on createdAt supports the monthly cost query, which joins
-- Conversation → Message and filters by createdAt >= monthStart.

ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "inputTokens" INTEGER;
ALTER TABLE "Message" ADD COLUMN IF NOT EXISTS "outputTokens" INTEGER;

CREATE INDEX IF NOT EXISTS "Message_createdAt_idx" ON "Message" ("createdAt");
