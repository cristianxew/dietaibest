import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  default: {
    user: { findUnique: vi.fn() },
    recipe: { findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn() },
    userFavorite: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/entitlements", () => ({
  assertCanCreateRecipe: vi.fn(),
  assertCanImportRecipe: vi.fn(),
}));

import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import {
  getRecipes,
  getPublicRecipes,
  getRecipe,
  toggleFavorite,
} from "@/actions/recipe";

const viewer = { id: "user-1", email: "viewer@dietai.test" };

beforeEach(() => {
  vi.clearAllMocks();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(getServerSession).mockResolvedValue({
    user: { email: viewer.email },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(prisma.user.findUnique).mockResolvedValue(viewer as any);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(prisma.recipe.findMany).mockResolvedValue([] as any);
  vi.mocked(prisma.recipe.count).mockResolvedValue(0);
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const lastFindManyWhere = (): any =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (vi.mocked(prisma.recipe.findMany).mock.calls.at(-1)![0] as any).where;

describe("getRecipes — visibility", () => {
  it("defaults to own recipes only", async () => {
    await getRecipes();
    const where = lastFindManyWhere();
    expect(where.userId).toBe(viewer.id);
    expect(where.favoritedBy).toBeUndefined();
    expect(where.AND).toBeUndefined();
  });

  it("favorites filter includes other users' recipes guarded by (own OR public)", async () => {
    await getRecipes({ favorites: true, page: 1, limit: 12 });
    const where = lastFindManyWhere();
    expect(where.userId).toBeUndefined();
    expect(where.favoritedBy).toEqual({ some: { userId: viewer.id } });
    expect(where.AND).toEqual([
      { OR: [{ userId: viewer.id }, { isPublic: true }] },
    ]);
  });

  it("favorites visibility guard coexists with the search OR", async () => {
    await getRecipes({ favorites: true, search: "pasta", page: 1, limit: 12 });
    const where = lastFindManyWhere();
    expect(where.AND).toEqual([
      { OR: [{ userId: viewer.id }, { isPublic: true }] },
    ]);
    expect(where.OR).toHaveLength(3);
  });
});

describe("getPublicRecipes", () => {
  it("filters to public recipes from other users", async () => {
    await getPublicRecipes();
    const where = lastFindManyWhere();
    expect(where.isPublic).toBe(true);
    expect(where.userId).toEqual({ not: viewer.id });
  });

  it("returns a derived author name and never the raw email", async () => {
    vi.mocked(prisma.recipe.findMany).mockResolvedValue([
      {
        id: "r1",
        title: "Tarta",
        userId: "user-2",
        isPublic: true,
        categories: [],
        favoritedBy: [],
        user: { id: "user-2", email: "alice@example.com" },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    ]);
    vi.mocked(prisma.recipe.count).mockResolvedValue(1);

    const result = await getPublicRecipes();

    expect(result.error).toBeNull();
    expect(result.data!.recipes[0].user).toEqual({
      id: "user-2",
      name: "alice",
    });
    expect(JSON.stringify(result)).not.toContain("alice@example.com");
  });
});

describe("getRecipe — viewer ownership", () => {
  const baseRecipe = {
    id: "r1",
    title: "Tarta",
    categories: [],
    favoritedBy: [],
  };

  it("sets viewerIsOwner true for the owner", async () => {
    vi.mocked(prisma.recipe.findUnique).mockResolvedValue({
      ...baseRecipe,
      userId: viewer.id,
      isPublic: false,
      user: { id: viewer.id, email: viewer.email, displayName: null },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const result = await getRecipe("r1");
    expect(result.error).toBeNull();
    expect(result.data!.viewerIsOwner).toBe(true);
  });

  it("sets viewerIsOwner false and exposes only the author name for another user's public recipe", async () => {
    vi.mocked(prisma.recipe.findUnique).mockResolvedValue({
      ...baseRecipe,
      userId: "user-2",
      isPublic: true,
      user: { id: "user-2", email: "alice@example.com", displayName: null },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const result = await getRecipe("r1");
    expect(result.error).toBeNull();
    expect(result.data!.viewerIsOwner).toBe(false);
    expect(result.data!.authorName).toBe("alice");
    expect(result.data!.user).toEqual({ id: "user-2" });
    expect(JSON.stringify(result)).not.toContain("alice@example.com");
  });

  it("rejects another user's private recipe", async () => {
    vi.mocked(prisma.recipe.findUnique).mockResolvedValue({
      ...baseRecipe,
      userId: "user-2",
      isPublic: false,
      user: { id: "user-2", email: "alice@example.com", displayName: null },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const result = await getRecipe("r1");
    expect(result.data).toBeNull();
    expect(result.error).toBe("Unauthorized");
  });
});

describe("toggleFavorite — visibility guard", () => {
  it("rejects favoriting another user's private recipe", async () => {
    vi.mocked(prisma.userFavorite.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.recipe.findUnique).mockResolvedValue({
      userId: "user-2",
      isPublic: false,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const result = await toggleFavorite("r1");
    expect(result.data).toBeNull();
    expect(result.error).toBe("Unauthorized");
    expect(prisma.userFavorite.create).not.toHaveBeenCalled();
  });

  it("allows favoriting another user's public recipe", async () => {
    vi.mocked(prisma.userFavorite.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.recipe.findUnique).mockResolvedValue({
      userId: "user-2",
      isPublic: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.userFavorite.create).mockResolvedValue({} as any);

    const result = await toggleFavorite("r1");
    expect(result.error).toBeNull();
    expect(result.data).toEqual({ favorited: true });
    expect(prisma.userFavorite.create).toHaveBeenCalledWith({
      data: { userId: viewer.id, recipeId: "r1" },
    });
  });

  it("unfavoriting skips the guard (works even if the recipe went private)", async () => {
    vi.mocked(prisma.userFavorite.findUnique).mockResolvedValue({
      id: "fav-1",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.mocked(prisma.userFavorite.delete).mockResolvedValue({} as any);

    const result = await toggleFavorite("r1");
    expect(result.error).toBeNull();
    expect(result.data).toEqual({ favorited: false });
    expect(prisma.recipe.findUnique).not.toHaveBeenCalled();
  });
});
