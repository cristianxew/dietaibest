-- Migration: Refactor MealPlan to Template-Based Architecture
-- This migration transforms the meal planning system from fixed-date plans to reusable templates

-- ============================================================================
-- STEP 1: Create new tables (if they don't exist)
-- ============================================================================

-- Create MealPlanTemplate table (reusable templates without dates)
CREATE TABLE IF NOT EXISTS "MealPlanTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "mealSlots" TEXT[] DEFAULT ARRAY['breakfast', 'lunch', 'dinner']::TEXT[],
    "targetCalories" DOUBLE PRECISION,
    "targetProtein" DOUBLE PRECISION,
    "targetCarbs" DOUBLE PRECISION,
    "targetFat" DOUBLE PRECISION,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "shareToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MealPlanTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- Create MealPlanSchedule table (tracks when templates are used)
CREATE TABLE IF NOT EXISTS "MealPlanSchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "templateId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MealPlanSchedule_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "MealPlanTemplate"("id") ON DELETE CASCADE,
    CONSTRAINT "MealPlanSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- ============================================================================
-- STEP 2: Add new columns to MealPlanDay (nullable for now)
-- ============================================================================

DO $$
BEGIN
    -- Add templateId column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'MealPlanDay' AND column_name = 'templateId') THEN
        ALTER TABLE "MealPlanDay" ADD COLUMN "templateId" TEXT;
    END IF;

    -- Add dayNumber column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'MealPlanDay' AND column_name = 'dayNumber') THEN
        ALTER TABLE "MealPlanDay" ADD COLUMN "dayNumber" INTEGER;
    END IF;
END $$;

-- ============================================================================
-- STEP 3: Migrate data from MealPlan to new structure (only if MealPlan exists)
-- ============================================================================

DO $$
BEGIN
    -- Check if MealPlan table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'MealPlan') THEN

        -- Copy MealPlan data to MealPlanTemplate
        INSERT INTO "MealPlanTemplate" (
            "id",
            "userId",
            "name",
            "duration",
            "mealSlots",
            "targetCalories",
            "targetProtein",
            "targetCarbs",
            "targetFat",
            "isPublic",
            "shareToken",
            "createdAt",
            "updatedAt"
        )
        SELECT
            "id",
            "userId",
            "name",
            -- Calculate duration as days between start and end date
            (EXTRACT(DAY FROM ("endDate" - "startDate")) + 1)::INTEGER as "duration",
            "mealSlots",
            "targetCalories",
            "targetProtein",
            "targetCarbs",
            "targetFat",
            "isPublic",
            "shareToken",
            "createdAt",
            "updatedAt"
        FROM "MealPlan"
        ON CONFLICT (id) DO NOTHING;

        -- Create schedules for each meal plan
        INSERT INTO "MealPlanSchedule" (
            "id",
            "templateId",
            "userId",
            "startDate",
            "status",
            "createdAt",
            "updatedAt"
        )
        SELECT
            gen_random_uuid(),
            "id" as "templateId",
            "userId",
            "startDate",
            -- Determine status based on dates and isActive flag
            CASE
                WHEN "isActive" = true THEN 'active'
                WHEN "endDate" < NOW() THEN 'completed'
                ELSE 'active'
            END as "status",
            "createdAt",
            "updatedAt"
        FROM "MealPlan";

        -- Update MealPlanDay to use templateId and dayNumber
        -- Calculate dayNumber based on the order of dates within each plan
        WITH numbered_days AS (
            SELECT
                mpd."id",
                mp."id" as "templateId",
                ROW_NUMBER() OVER (PARTITION BY mpd."mealPlanId" ORDER BY mpd."date" ASC) as "dayNumber"
            FROM "MealPlanDay" mpd
            JOIN "MealPlan" mp ON mpd."mealPlanId" = mp."id"
            WHERE mpd."templateId" IS NULL  -- Only update rows that haven't been migrated
        )
        UPDATE "MealPlanDay"
        SET
            "templateId" = nd."templateId",
            "dayNumber" = nd."dayNumber"::INTEGER
        FROM numbered_days nd
        WHERE "MealPlanDay"."id" = nd."id";

    END IF;
END $$;

-- ============================================================================
-- STEP 4: Drop old columns and constraints from MealPlanDay
-- ============================================================================

DO $$
BEGIN
    -- Drop the old foreign key constraint if it exists
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints
               WHERE constraint_name = 'MealPlanDay_mealPlanId_fkey') THEN
        ALTER TABLE "MealPlanDay" DROP CONSTRAINT "MealPlanDay_mealPlanId_fkey";
    END IF;

    -- Drop the old unique constraint if it exists
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints
               WHERE constraint_name = 'MealPlanDay_mealPlanId_date_key') THEN
        ALTER TABLE "MealPlanDay" DROP CONSTRAINT "MealPlanDay_mealPlanId_date_key";
    END IF;

    -- Drop old columns if they exist
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'MealPlanDay' AND column_name = 'mealPlanId') THEN
        ALTER TABLE "MealPlanDay" DROP COLUMN "mealPlanId";
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'MealPlanDay' AND column_name = 'date') THEN
        ALTER TABLE "MealPlanDay" DROP COLUMN "date";
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'MealPlanDay' AND column_name = 'dayOfWeek') THEN
        ALTER TABLE "MealPlanDay" DROP COLUMN "dayOfWeek";
    END IF;

    -- Make templateId and dayNumber required now that data is migrated
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'MealPlanDay' AND column_name = 'templateId' AND is_nullable = 'YES') THEN
        ALTER TABLE "MealPlanDay" ALTER COLUMN "templateId" SET NOT NULL;
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_name = 'MealPlanDay' AND column_name = 'dayNumber' AND is_nullable = 'YES') THEN
        ALTER TABLE "MealPlanDay" ALTER COLUMN "dayNumber" SET NOT NULL;
    END IF;

    -- Add foreign key constraint for templateId if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                   WHERE constraint_name = 'MealPlanDay_templateId_fkey') THEN
        ALTER TABLE "MealPlanDay" ADD CONSTRAINT "MealPlanDay_templateId_fkey"
            FOREIGN KEY ("templateId") REFERENCES "MealPlanTemplate"("id") ON DELETE CASCADE;
    END IF;
END $$;

-- ============================================================================
-- STEP 5: Create indexes (if they don't exist)
-- ============================================================================

-- MealPlanTemplate indexes
CREATE INDEX IF NOT EXISTS "MealPlanTemplate_userId_idx" ON "MealPlanTemplate"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "MealPlanTemplate_shareToken_key" ON "MealPlanTemplate"("shareToken") WHERE "shareToken" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "MealPlanTemplate_shareToken_idx" ON "MealPlanTemplate"("shareToken");

-- MealPlanSchedule indexes
CREATE INDEX IF NOT EXISTS "MealPlanSchedule_userId_idx" ON "MealPlanSchedule"("userId");
CREATE INDEX IF NOT EXISTS "MealPlanSchedule_templateId_idx" ON "MealPlanSchedule"("templateId");
CREATE INDEX IF NOT EXISTS "MealPlanSchedule_startDate_idx" ON "MealPlanSchedule"("startDate");
CREATE INDEX IF NOT EXISTS "MealPlanSchedule_userId_startDate_idx" ON "MealPlanSchedule"("userId", "startDate");

-- MealPlanDay indexes
CREATE INDEX IF NOT EXISTS "MealPlanDay_templateId_idx" ON "MealPlanDay"("templateId");
CREATE UNIQUE INDEX IF NOT EXISTS "MealPlanDay_templateId_dayNumber_key" ON "MealPlanDay"("templateId", "dayNumber");

-- ============================================================================
-- STEP 6: Drop old MealPlan table (if it exists)
-- ============================================================================

DROP TABLE IF EXISTS "MealPlan";

-- ============================================================================
-- Migration complete!
-- ============================================================================
