-- Add per-account trial gate: true once a Stripe trial has been started.
ALTER TABLE "User" ADD COLUMN "hasUsedTrial" BOOLEAN NOT NULL DEFAULT false;
