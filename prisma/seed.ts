import { PrismaClient } from "../src/generated/prisma";
import { recipes } from "../src/lib/recipe-mocks";

const prisma = new PrismaClient();

// Default recipe categories
const defaultCategories = [
  { name: "Breakfast", slug: "breakfast", description: "Morning meals", iconName: "sunrise" },
  { name: "Lunch", slug: "lunch", description: "Midday meals", iconName: "sun" },
  { name: "Dinner", slug: "dinner", description: "Evening meals", iconName: "moon" },
  { name: "Snacks", slug: "snacks", description: "Quick bites", iconName: "cookie" },
  { name: "Desserts", slug: "desserts", description: "Sweet treats", iconName: "cake" },
];

async function seedCategories() {
  console.log("Creating default categories...");
  let created = 0;
  for (const category of defaultCategories) {
    await prisma.recipeCategory.upsert({
      where: { slug: category.slug },
      update: {},
      create: category,
    });
    created++;
  }
  console.log(`  ✓ ${created} categories ready\n`);
}

async function main() {
  // Always seed categories first (even without user)
  await seedCategories();

  const userId = process.env.SEED_USER_ID;
  if (!userId) {
    console.log("Note: SEED_USER_ID not provided, skipping recipe seeding");
    console.log("Usage: SEED_USER_ID=your-uuid bun prisma db seed");
    return;
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
