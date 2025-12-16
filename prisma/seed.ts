import { PrismaClient } from "../src/generated/prisma";
import { recipes } from "../src/lib/recipe-mocks";

const prisma = new PrismaClient();

async function main() {
  const userId = process.env.SEED_USER_ID;
  if (!userId) {
    console.error("Error: SEED_USER_ID environment variable is required");
    console.error("Usage: SEED_USER_ID=your-uuid bun prisma db seed");
    process.exit(1);
  }

  // Verify user exists
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    console.error(`Error: User with ID ${userId} not found`);
    process.exit(1);
  }

  console.log(`Seeding recipes for user: ${user.email}`);

  // Get existing recipe titles for this user
  const existingRecipes = await prisma.recipe.findMany({
    where: { userId },
    select: { title: true },
  });
  const existingTitles = new Set(existingRecipes.map((r) => r.title));

  // Filter out recipes that already exist
  const recipesToCreate = recipes.filter((r) => !existingTitles.has(r.title));

  console.log(`Found ${recipes.length} mock recipes`);
  console.log(`Skipping ${recipes.length - recipesToCreate.length} existing`);
  console.log(`Creating ${recipesToCreate.length} new recipes...\n`);

  // Create recipes
  let created = 0;
  for (const recipe of recipesToCreate) {
    const { categoryIds, ...recipeData } = recipe;
    await prisma.recipe.create({
      data: {
        ...recipeData,
        userId,
        source: "manual",
      },
    });
    created++;
    console.log(`  ✓ ${recipe.title}`);
  }

  console.log(`\nSeed completed! Created ${created} recipes.`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
