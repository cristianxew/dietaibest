/**
 * Clear nutrition cache for testing
 */
import { PrismaClient } from "@/generated/prisma";

const prisma = new PrismaClient();

async function clearCache() {
  console.log("🗑️  Clearing nutrition cache...");

  // Clear nutrition calculation cache
  const cacheDeleted = await prisma.nutritionCache.deleteMany({});
  console.log(`✅ Deleted ${cacheDeleted.count} nutrition cache entries`);

  // Optionally clear ingredient nutrition data
  const ingredientsDeleted = await prisma.ingredient.deleteMany({});
  console.log(`✅ Deleted ${ingredientsDeleted.count} ingredients`);

  const nutrientsDeleted = await prisma.nutrient.deleteMany({});
  console.log(`✅ Deleted ${nutrientsDeleted.count} nutrients`);

  console.log("✅ Cache cleared successfully!");

  await prisma.$disconnect();
}

clearCache().catch((error) => {
  console.error("Error clearing cache:", error);
  process.exit(1);
});
