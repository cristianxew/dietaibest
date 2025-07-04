import { createDefaultCategories } from "@/actions/recipe";

async function init() {
  console.log("Creating default recipe categories...");

  const result = await createDefaultCategories();

  if (result.error) {
    console.error("Error creating categories:", result.error);
    process.exit(1);
  }

  console.log("✅ Successfully created categories:", result.data);
  process.exit(0);
}

init();
