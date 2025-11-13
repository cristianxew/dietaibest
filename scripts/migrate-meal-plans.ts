/**
 * Data Migration Script: MealPlan to MealPlanTemplate + MealPlanSchedule
 *
 * This script migrates existing MealPlan data to the new template-based architecture.
 * Run this BEFORE applying the Prisma schema migration.
 *
 * Usage: npx tsx scripts/migrate-meal-plans.ts
 */

import { PrismaClient } from "@/generated/prisma";
import { differenceInDays } from "date-fns";

const prisma = new PrismaClient();

interface OldMealPlan {
  id: string;
  userId: string;
  name: string;
  startDate: Date;
  endDate: Date;
  mealSlots: string[];
  targetCalories: number | null;
  targetProtein: number | null;
  targetCarbs: number | null;
  targetFat: number | null;
  isActive: boolean;
  isPublic: boolean;
  shareToken: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface OldMealPlanDay {
  id: string;
  mealPlanId: string;
  date: Date;
  dayOfWeek: number;
}

async function migrateMealPlans() {
  console.log("🚀 Starting meal plan migration...");

  try {
    // 1. Fetch all existing meal plans with their days and meals
    console.log("\n📊 Fetching existing meal plans...");
    const oldMealPlans = await prisma.$queryRaw<OldMealPlan[]>`
      SELECT * FROM "MealPlan" ORDER BY "createdAt" ASC
    `;

    console.log(`Found ${oldMealPlans.length} meal plans to migrate`);

    if (oldMealPlans.length === 0) {
      console.log("✅ No meal plans to migrate. Exiting.");
      return;
    }

    // 2. For each meal plan, create a template and schedule
    for (const oldPlan of oldMealPlans) {
      console.log(`\n📝 Migrating: "${oldPlan.name}"`);

      // Calculate duration from dates
      const duration = differenceInDays(oldPlan.endDate, oldPlan.startDate) + 1;
      console.log(`  Duration: ${duration} days`);

      // Check if template already exists (idempotent migration)
      const existingTemplate = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "MealPlanTemplate" WHERE id = ${oldPlan.id}
      `;

      if (existingTemplate.length > 0) {
        console.log(`  ⏭️  Template already exists, skipping...`);
        continue;
      }

      // Create the template (using the same ID for easier tracking)
      console.log(`  Creating template...`);
      await prisma.$executeRaw`
        INSERT INTO "MealPlanTemplate" (
          id, "userId", name, duration, "mealSlots",
          "targetCalories", "targetProtein", "targetCarbs", "targetFat",
          "isPublic", "shareToken", "createdAt", "updatedAt"
        ) VALUES (
          ${oldPlan.id},
          ${oldPlan.userId},
          ${oldPlan.name},
          ${duration},
          ${oldPlan.mealSlots}::text[],
          ${oldPlan.targetCalories},
          ${oldPlan.targetProtein},
          ${oldPlan.targetCarbs},
          ${oldPlan.targetFat},
          ${oldPlan.isPublic},
          ${oldPlan.shareToken},
          ${oldPlan.createdAt},
          ${oldPlan.updatedAt}
        )
      `;

      // Create a schedule for this template (only if it was active or has future dates)
      // const isScheduled = oldPlan.isActive || oldPlan.startDate >= new Date()
      const scheduleStatus = oldPlan.isActive
        ? "active"
        : oldPlan.endDate < new Date()
        ? "completed"
        : "active";

      console.log(`  Creating schedule (status: ${scheduleStatus})...`);
      await prisma.$executeRaw`
        INSERT INTO "MealPlanSchedule" (
          id, "templateId", "userId", "startDate", status, "createdAt", "updatedAt"
        ) VALUES (
          gen_random_uuid(),
          ${oldPlan.id},
          ${oldPlan.userId},
          ${oldPlan.startDate},
          ${scheduleStatus},
          ${oldPlan.createdAt},
          ${oldPlan.updatedAt}
        )
      `;

      // Migrate meal plan days to use dayNumber instead of date
      console.log(`  Migrating days...`);
      const oldDays = await prisma.$queryRaw<OldMealPlanDay[]>`
        SELECT * FROM "MealPlanDay"
        WHERE "mealPlanId" = ${oldPlan.id}
        ORDER BY date ASC
      `;

      for (let i = 0; i < oldDays.length; i++) {
        const oldDay = oldDays[i];
        const dayNumber = i + 1; // Day numbers start at 1

        // Update the day to reference template and use dayNumber
        await prisma.$executeRaw`
          UPDATE "MealPlanDay"
          SET
            "templateId" = ${oldPlan.id},
            "dayNumber" = ${dayNumber}
          WHERE id = ${oldDay.id}
        `;
      }

      console.log(`  ✅ Migrated "${oldPlan.name}"`);
    }

    console.log("\n✅ Migration completed successfully!");
    console.log("\n📝 Summary:");
    console.log(`  - Templates created: ${oldMealPlans.length}`);
    console.log(`  - Schedules created: ${oldMealPlans.length}`);
    console.log("\n⚠️  Next steps:");
    console.log("  1. Review the migrated data");
    console.log(
      "  2. Run: npx prisma migrate dev --name finalize_meal_plan_migration"
    );
    console.log("  3. Delete the old MealPlan table if everything looks good");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateMealPlans().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
