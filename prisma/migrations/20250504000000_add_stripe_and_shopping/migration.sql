-- Migration: Add Stripe subscription fields and Shopping automation tables

-- ============================================================================
-- STEP 1: Add Stripe subscription fields to User table
-- ============================================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'User' AND column_name = 'stripeCustomerId') THEN
        ALTER TABLE "User" ADD COLUMN "stripeCustomerId" TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'User' AND column_name = 'stripeSubscriptionId') THEN
        ALTER TABLE "User" ADD COLUMN "stripeSubscriptionId" TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'User' AND column_name = 'plan') THEN
        ALTER TABLE "User" ADD COLUMN "plan" TEXT NOT NULL DEFAULT 'starter';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'User' AND column_name = 'subscriptionStatus') THEN
        ALTER TABLE "User" ADD COLUMN "subscriptionStatus" TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'User' AND column_name = 'currentPeriodEnd') THEN
        ALTER TABLE "User" ADD COLUMN "currentPeriodEnd" TIMESTAMP(3);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'User' AND column_name = 'cancelAtPeriodEnd') THEN
        ALTER TABLE "User" ADD COLUMN "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

-- Unique indexes for Stripe IDs
CREATE UNIQUE INDEX IF NOT EXISTS "User_stripeCustomerId_key" ON "User"("stripeCustomerId");
CREATE UNIQUE INDEX IF NOT EXISTS "User_stripeSubscriptionId_key" ON "User"("stripeSubscriptionId");

-- ============================================================================
-- STEP 2: Create ShoppingPreferences table
-- ============================================================================

CREATE TABLE IF NOT EXISTS "ShoppingPreferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "selectedStore" TEXT,
    "deliveryPreference" TEXT NOT NULL DEFAULT 'delivery',
    "zipCode" TEXT,
    "preferOrganic" BOOLEAN NOT NULL DEFAULT false,
    "preferStoreBrand" BOOLEAN NOT NULL DEFAULT false,
    "allowSubstitutions" BOOLEAN NOT NULL DEFAULT true,
    "maxPricePerItem" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShoppingPreferences_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ShoppingPreferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ShoppingPreferences_userId_key" ON "ShoppingPreferences"("userId");
CREATE INDEX IF NOT EXISTS "ShoppingPreferences_userId_idx" ON "ShoppingPreferences"("userId");

-- ============================================================================
-- STEP 3: Create StoreCredential table
-- ============================================================================

CREATE TABLE IF NOT EXISTS "StoreCredential" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "store" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "encryptedPassword" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "authTag" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreCredential_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StoreCredential_userId_store_key" UNIQUE ("userId", "store"),
    CONSTRAINT "StoreCredential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "StoreCredential_userId_idx" ON "StoreCredential"("userId");
