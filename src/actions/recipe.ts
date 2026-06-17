"use server";

import { z } from "zod";
import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import {
  recipeFormSchema,
  recipeFilterSchema,
  type RecipeFormData,
  type RecipeFilter,
  type RecipeSource,
} from "@/types/recipe";
import { Prisma } from "@/generated/prisma";
import { revalidatePath } from "next/cache";
import { analyzeRecipeProfileAction } from "@/actions/analyzeRecipe";
import {
  assertCanCreateRecipe,
  assertCanImportRecipe,
  assertCanUseAiChat,
  getEntitlements,
} from "@/lib/entitlements";
import type { AgentContext } from "@/lib/chat/context";
import { generateRecipeImage } from "@/lib/chat/tools/generateRecipeImage";
import { serverAction } from "@/lib/server-action";
import { formatIngredientsForNutrition } from "@/lib/ingredients";
import { getAuthorName } from "@/lib/author-name";
import type { Profile } from "@/lib/fdc";

// Helper to get authenticated user
async function getAuthenticatedUser() {
  const session = await getServerSession();
  if (!session?.user?.email) {
    throw new Error("Unauthorized");
  }

  // Get user from database
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
  });

  if (!user) {
    throw new Error("User not found");
  }

  return user;
}

export interface PersistRecipeOptions {
  source?: RecipeSource;
  sourceUrl?: string;
  importedFrom?: string;
  analyzeNutrition?: boolean;
  locale?: "en" | "es" | "pl";
}

const isImportSource = (source: RecipeSource): boolean =>
  source === "url" || source === "imported";

// Single create path. Source-aware policy is encoded inline:
//   manual/generated → only assertCanCreateRecipe, nutrition opt-in
//   url/imported     → assertCanImportRecipe + assertCanCreateRecipe,
//                      `imported` (and `imported-from-X`) tags, nutrition opt-out
export async function persistRecipe(
  data: RecipeFormData,
  options: PersistRecipeOptions = {}
) {
  const source: RecipeSource = options.source ?? "manual";
  const isImport = isImportSource(source);
  // FDC is now the single nutrition engine: every creation path computes the
  // full profile by default. Callers can still opt out explicitly.
  const shouldAnalyze = options.analyzeNutrition ?? true;

  return serverAction(
    {
      input: recipeFormSchema,
      requires: async (_, ctx) => {
        if (isImport) {
          await assertCanImportRecipe(ctx.user);
        }
        await assertCanCreateRecipe(ctx.user);
      },
      revalidates: ["/recipes"],
    },
    async (ctx, validatedData) => {
      const { categoryIds = [], ...recipeData } = validatedData;

      const tags = [...(recipeData.tags ?? [])];
      if (isImport) {
        if (options.importedFrom) {
          tags.push(`imported-from-${options.importedFrom}`);
        }
        if (!tags.includes("imported")) {
          tags.push("imported");
        }
      }

      const sourceUrl = options.sourceUrl ?? recipeData.sourceUrl;

      const recipe = await prisma.recipe.create({
        data: {
          ...recipeData,
          tags,
          sourceUrl,
          userId: ctx.user.id,
          source,
          categories: {
            connect: categoryIds.map((id) => ({ id })),
          },
        },
        include: {
          categories: true,
          favoritedBy: {
            where: { userId: ctx.user.id },
          },
        },
      });

      // Side-effect: FDC nutrition orchestration. Kept body-side because a
      // failure must not roll the recipe back. Persists the full 22-nutrient
      // per-serving profile plus the per-ingredient FDC matches.
      if (shouldAnalyze) {
        try {
          const ingredientLines = formatIngredientsForNutrition(
            recipe.ingredients
          );

          if (ingredientLines.length > 0) {
            const analysis = await analyzeRecipeProfileAction({
              ingredients: ingredientLines,
              servings: recipe.servings,
            });

            if (analysis.success) {
              await prisma.recipe.update({
                where: { id: recipe.id },
                data: { ...analysis.perServing },
              });

              // Per-ingredient FDC matches. Delete-then-insert keeps re-saves
              // idempotent (a recipe is only ever re-created here, but the
              // pattern guards future re-analysis paths).
              await prisma.recipeIngredient.deleteMany({
                where: { recipeId: recipe.id },
              });
              if (analysis.items.length > 0) {
                await prisma.recipeIngredient.createMany({
                  data: analysis.items.map((item) => ({
                    recipeId: recipe.id,
                    originalText: item.original,
                    nameNorm: item.nameNorm,
                    qty: item.qty,
                    unit: item.unit,
                    fdcId: item.fdcId,
                    gramWeight: item.gramsTotal,
                    confidence: item.confidence,
                  })),
                });
              }

              console.info(
                `[Recipe] FDC-analyzed nutrition for recipe: ${recipe.id}`
              );
            } else {
              console.warn(
                `[Recipe] FDC analysis failed: ${analysis.error ?? "unknown"}`
              );
            }
          }
        } catch (nutritionError) {
          console.error("[Recipe] Nutrition analysis failed:", nutritionError);
        }
      }

      return recipe;
    }
  )(data);
}

// Update an existing recipe
export async function updateRecipe(id: string, data: RecipeFormData) {
  try {
    const user = await getAuthenticatedUser();
    const validatedData = recipeFormSchema.parse(data);

    // Check if user owns the recipe
    const existingRecipe = await prisma.recipe.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existingRecipe) {
      return { data: null, error: "Recipe not found" };
    }

    if (existingRecipe.userId !== user.id) {
      return { data: null, error: "Unauthorized" };
    }

    const { categoryIds, ...recipeData } = validatedData;

    const recipe = await prisma.recipe.update({
      where: { id },
      data: {
        ...recipeData,
        categories: {
          set: [], // Clear existing
          connect: categoryIds.map((id) => ({ id })), // Add new
        },
      },
      include: {
        categories: true,
        favoritedBy: {
          where: { userId: user.id },
        },
      },
    });

    revalidatePath("/recipes");
    revalidatePath(`/recipes/${id}`);
    return { data: recipe, error: null };
  } catch (error) {
    console.error("Update recipe error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to update recipe",
    };
  }
}

/**
 * Persist a freshly-computed per-serving nutrition profile (the full
 * 22-nutrient set — macros + micros) onto an existing recipe the user owns.
 *
 * Used by the chat `getNutrition` tool to backfill recipes that had no stored
 * profile, so the recipe detail page (and the next lookup) shows the same
 * numbers — including micronutrients — exactly as analyzed. This replaces the
 * old "LLM copies the 5 macros back via editRecipe" dance, which dropped every
 * micronutrient and risked transcription drift.
 */
export async function saveRecipeNutritionProfile(
  recipeId: string,
  profile: Profile
) {
  try {
    const user = await getAuthenticatedUser();

    const existing = await prisma.recipe.findUnique({
      where: { id: recipeId },
      select: { userId: true },
    });

    if (!existing) {
      return { data: null, error: "Recipe not found" };
    }
    if (existing.userId !== user.id) {
      return { data: null, error: "Unauthorized" };
    }

    const recipe = await prisma.recipe.update({
      where: { id: recipeId },
      data: { ...profile },
    });

    revalidatePath("/recipes");
    revalidatePath(`/recipes/${recipeId}`);
    return { data: { id: recipe.id }, error: null };
  } catch (error) {
    console.error("Save recipe nutrition profile error:", error);
    return {
      data: null,
      error:
        error instanceof Error ? error.message : "Failed to save nutrition",
    };
  }
}

// Delete a recipe
export async function deleteRecipe(id: string) {
  try {
    const user = await getAuthenticatedUser();

    // Check if user owns the recipe
    const existingRecipe = await prisma.recipe.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existingRecipe) {
      return { data: null, error: "Recipe not found" };
    }

    if (existingRecipe.userId !== user.id) {
      return { data: null, error: "Unauthorized" };
    }

    await prisma.recipe.delete({
      where: { id },
    });

    revalidatePath("/recipes");
    return { data: { success: true }, error: null };
  } catch (error) {
    console.error("Delete recipe error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to delete recipe",
    };
  }
}

// Get recipes with filtering, sorting, and pagination
export async function getRecipes(filter?: RecipeFilter) {
  try {
    const user = await getAuthenticatedUser();
    const validatedFilter = recipeFilterSchema.parse(filter || {});

    const {
      search,
      categoryId,
      difficulty,
      tags,
      minCalories,
      maxCalories,
      favorites,
      sortBy = "createdAt",
      sortOrder = "desc",
      page = 1,
      limit = 12,
    } = validatedFilter;

    // Build where clause. The favorites tab includes recipes from other
    // users, guarded by (own OR public) so privated recipes drop out.
    // The visibility OR is wrapped in AND because search claims top-level OR.
    const where: Prisma.RecipeWhereInput = {
      ...(favorites
        ? {
            favoritedBy: { some: { userId: user.id } },
            AND: [{ OR: [{ userId: user.id }, { isPublic: true }] }],
          }
        : { userId: user.id }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { tags: { hasSome: [search] } },
        ],
      }),
      ...(categoryId && {
        categories: { some: { id: categoryId } },
      }),
      ...(difficulty && { difficulty }),
      ...(tags &&
        tags.length > 0 && {
          tags: { hasSome: tags },
        }),
      ...(minCalories && { calories: { gte: minCalories } }),
      ...(maxCalories && { calories: { lte: maxCalories } }),
    };

    // Get total count
    const totalCount = await prisma.recipe.count({ where });

    // Get recipes with pagination
    const recipes = await prisma.recipe.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        categories: true,
        favoritedBy: {
          where: { userId: user.id },
        },
      },
    });

    return {
      data: {
        recipes,
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      },
      error: null,
    };
  } catch (error) {
    console.error("Get recipes error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to get recipes",
    };
  }
}

// Get public recipes from all users (excluding current user's recipes)
export async function getPublicRecipes(filter?: RecipeFilter) {
  try {
    const user = await getAuthenticatedUser();
    const validatedFilter = recipeFilterSchema.parse(filter || {});

    const {
      search,
      categoryId,
      difficulty,
      tags,
      minCalories,
      maxCalories,
      sortBy = "createdAt",
      sortOrder = "desc",
      page = 1,
      limit = 12,
    } = validatedFilter;

    // Build where clause - only public recipes, excluding user's own
    const where: Prisma.RecipeWhereInput = {
      isPublic: true,
      userId: { not: user.id },
      ...(search && {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { tags: { hasSome: [search] } },
        ],
      }),
      ...(categoryId && {
        categories: { some: { id: categoryId } },
      }),
      ...(difficulty && { difficulty }),
      ...(tags &&
        tags.length > 0 && {
          tags: { hasSome: tags },
        }),
      ...(minCalories && { calories: { gte: minCalories } }),
      ...(maxCalories && { calories: { lte: maxCalories } }),
    };

    // Get total count
    const totalCount = await prisma.recipe.count({ where });

    // Get recipes with pagination
    const recipes = await prisma.recipe.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        categories: true,
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
        favoritedBy: {
          where: { userId: user.id },
        },
      },
    });

    return {
      data: {
        // Scrub raw emails: other users only get a derived display name
        recipes: recipes.map(({ user: author, ...recipe }) => ({
          ...recipe,
          user: { id: author.id, name: getAuthorName(author) },
        })),
        pagination: {
          page,
          limit,
          totalCount,
          totalPages: Math.ceil(totalCount / limit),
        },
      },
      error: null,
    };
  } catch (error) {
    console.error("Get public recipes error:", error);
    return {
      data: null,
      error:
        error instanceof Error ? error.message : "Failed to get public recipes",
    };
  }
}

// Get a single recipe by ID
export async function getRecipe(id: string) {
  try {
    const user = await getAuthenticatedUser();

    const recipe = await prisma.recipe.findUnique({
      where: { id },
      include: {
        categories: true,
        favoritedBy: {
          where: { userId: user.id },
        },
        user: {
          select: {
            id: true,
            email: true,
            displayName: true,
          },
        },
      },
    });

    if (!recipe) {
      return { data: null, error: "Recipe not found" };
    }

    // Check if user can view this recipe
    if (recipe.userId !== user.id && !recipe.isPublic) {
      return { data: null, error: "Unauthorized" };
    }

    // Scrub the owner's email: viewers only get a derived author name
    const { user: owner, ...recipeData } = recipe;
    return {
      data: {
        ...recipeData,
        user: { id: owner.id },
        authorName: getAuthorName(owner),
        viewerIsOwner: recipe.userId === user.id,
      },
      error: null,
    };
  } catch (error) {
    console.error("Get recipe error:", error);
    return {
      data: null,
      error: error instanceof Error ? error.message : "Failed to get recipe",
    };
  }
}

// Toggle favorite status
export async function toggleFavorite(recipeId: string) {
  try {
    const user = await getAuthenticatedUser();

    // Check if already favorited
    const existing = await prisma.userFavorite.findUnique({
      where: {
        userId_recipeId: {
          userId: user.id,
          recipeId,
        },
      },
    });

    if (existing) {
      // Remove favorite — always allowed, even if the recipe went private
      await prisma.userFavorite.delete({
        where: { id: existing.id },
      });
      return { data: { favorited: false }, error: null };
    }

    // Favoriting requires visibility: own recipe or a public one
    const recipe = await prisma.recipe.findUnique({
      where: { id: recipeId },
      select: { userId: true, isPublic: true },
    });

    if (!recipe) {
      return { data: null, error: "Recipe not found" };
    }

    if (recipe.userId !== user.id && !recipe.isPublic) {
      return { data: null, error: "Unauthorized" };
    }

    await prisma.userFavorite.create({
      data: {
        userId: user.id,
        recipeId,
      },
    });
    return { data: { favorited: true }, error: null };
  } catch (error) {
    console.error("Toggle favorite error:", error);
    return {
      data: null,
      error:
        error instanceof Error ? error.message : "Failed to toggle favorite",
    };
  }
}

// Get all categories
export async function getCategories() {
  try {
    const categories = await prisma.recipeCategory.findMany({
      orderBy: { name: "asc" },
    });

    return { data: categories, error: null };
  } catch (error) {
    console.error("Get categories error:", error);
    return {
      data: null,
      error:
        error instanceof Error ? error.message : "Failed to get categories",
    };
  }
}

// Get recipe statistics
export async function getRecipeStats() {
  try {
    const user = await getAuthenticatedUser();

    const [totalRecipes, favoriteRecipes, categoryStats] = await Promise.all([
      // Total recipes
      prisma.recipe.count({
        where: { userId: user.id },
      }),
      // Favorite recipes count
      prisma.userFavorite.count({
        where: { userId: user.id },
      }),
      // Recipes per category
      prisma.recipeCategory.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          iconName: true,
          _count: {
            select: {
              recipes: {
                where: { userId: user.id },
              },
            },
          },
        },
        orderBy: { name: "asc" },
      }),
    ]);

    return {
      data: {
        totalRecipes,
        favoriteRecipes,
        categoryStats: categoryStats.map((cat) => ({
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
          iconName: cat.iconName,
          recipeCount: cat._count.recipes,
        })),
      },
      error: null,
    };
  } catch (error) {
    console.error("Get recipe stats error:", error);
    return {
      data: null,
      error:
        error instanceof Error ? error.message : "Failed to get recipe stats",
    };
  }
}

// Get recipe search suggestions
export async function getRecipeSearchSuggestions(query: string) {
  try {
    const user = await getAuthenticatedUser();

    if (!query || query.length < 2) {
      return { data: [], error: null };
    }

    // Get recipes that match the query for titles and descriptions
    const recipes = await prisma.recipe.findMany({
      where: {
        userId: user.id,
        OR: [
          {
            title: {
              contains: query,
              mode: "insensitive",
            },
          },
          {
            description: {
              contains: query,
              mode: "insensitive",
            },
          },
        ],
      },
      select: {
        title: true,
        tags: true,
      },
      take: 20,
    });

    // Extract unique titles that match
    const titles = recipes
      .filter((r) => r.title.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 5)
      .map((r) => ({
        type: "title" as const,
        value: r.title,
      }));

    // Extract and deduplicate tags
    const allTags = recipes.flatMap((r) => r.tags);
    const uniqueTags = Array.from(new Set(allTags))
      .filter((tag) => tag.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 5)
      .map((tag) => ({
        type: "tag" as const,
        value: tag,
      }));

    // Also search in categories
    const categories = await prisma.recipeCategory.findMany({
      where: {
        name: {
          contains: query,
          mode: "insensitive",
        },
      },
      select: {
        name: true,
      },
      take: 3,
    });

    const categorySuggestions = categories.map((c) => ({
      type: "category" as const,
      value: c.name,
    }));

    // Combine all suggestions
    const suggestions = [...titles, ...uniqueTags, ...categorySuggestions];

    return { data: suggestions, error: null };
  } catch (error) {
    console.error("Get search suggestions error:", error);
    return {
      data: null,
      error:
        error instanceof Error
          ? error.message
          : "Failed to get search suggestions",
    };
  }
}

// Get recent recipes for dashboard
export async function getRecentRecipes(limit: number = 6) {
  try {
    const user = await getAuthenticatedUser();

    const recipes = await prisma.recipe.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        categories: true,
        favoritedBy: {
          where: { userId: user.id },
        },
      },
    });

    return { data: recipes, error: null };
  } catch (error) {
    console.error("Get recent recipes error:", error);
    return {
      data: null,
      error:
        error instanceof Error ? error.message : "Failed to get recent recipes",
    };
  }
}

// Create default categories (run once)
export async function createDefaultCategories() {
  try {
    const defaultCategories = [
      {
        name: "Breakfast",
        slug: "breakfast",
        description: "Morning meals",
        iconName: "sunrise",
      },
      {
        name: "Lunch",
        slug: "lunch",
        description: "Midday meals",
        iconName: "sun",
      },
      {
        name: "Dinner",
        slug: "dinner",
        description: "Evening meals",
        iconName: "moon",
      },
      {
        name: "Snacks",
        slug: "snacks",
        description: "Quick bites",
        iconName: "cookie",
      },
      {
        name: "Desserts",
        slug: "desserts",
        description: "Sweet treats",
        iconName: "cake",
      },
      {
        name: "Beverages",
        slug: "beverages",
        description: "Drinks and smoothies",
        iconName: "coffee",
      },
      {
        name: "Vegetarian",
        slug: "vegetarian",
        description: "Plant-based meals",
        iconName: "leaf",
      },
      {
        name: "Vegan",
        slug: "vegan",
        description: "No animal products",
        iconName: "carrot",
      },
      {
        name: "Gluten-Free",
        slug: "gluten-free",
        description: "No gluten ingredients",
        iconName: "wheat-off",
      },
      {
        name: "Low-Carb",
        slug: "low-carb",
        description: "Low carbohydrate meals",
        iconName: "scale",
      },
    ];

    const createdCategories = await Promise.all(
      defaultCategories.map((category) =>
        prisma.recipeCategory.upsert({
          where: { slug: category.slug },
          update: {},
          create: category,
        })
      )
    );

    return { data: createdCategories, error: null };
  } catch (error) {
    console.error("Create default categories error:", error);
    return {
      data: null,
      error:
        error instanceof Error ? error.message : "Failed to create categories",
    };
  }
}

// Generate recipe image using AI
export async function generateRecipeImageWithAI(recipeId: string) {
  return serverAction(
    {
      input: z.string().min(1),
      requires: async (_, ctx) => {
        await assertCanUseAiChat(ctx.user);
      },
      revalidates: () => ["/recipes", `/recipes/${recipeId}`],
    },
    async (ctx, id) => {
      const recipe = await prisma.recipe.findUnique({
        where: { id: id },
        select: { userId: true },
      });

      if (!recipe) {
        throw new Error("Recipe not found");
      }

      if (recipe.userId !== ctx.user.id) {
        throw new Error("Only the owner can update the recipe image");
      }

      const entitlements = getEntitlements(ctx.user);
      const agentCtx: AgentContext = {
        userId: ctx.user.id,
        locale: "en",
        entitlements,
        conversationId: "server-action-direct",
      };

      const result = await generateRecipeImage.execute(
        { recipeId: id, confirmed: true },
        agentCtx
      );

      if (!result.ok) {
        throw new Error(result.message || "Failed to generate image");
      }

      return result.data;
    }
  )(recipeId);
}
