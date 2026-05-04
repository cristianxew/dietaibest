import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({
  getServerSession: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { z } from "zod";

import { getServerSession } from "next-auth";
import prisma from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { ProOnlyError, QuotaExceededError } from "@/lib/entitlements";
import { serverAction } from "@/lib/server-action";

const mockSession = (email: string | null) => {
  vi.mocked(getServerSession).mockResolvedValue(
    email ? ({ user: { email } } as Awaited<ReturnType<typeof getServerSession>>) : null
  );
};

const mockUser = (user: { id: string; email: string } | null) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  vi.mocked(prisma.user.findUnique).mockResolvedValue(user as any);
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("serverAction — happy path", () => {
  it("resolves user, runs body, wraps result in { data, error: null }", async () => {
    mockSession("user@dietai.test");
    mockUser({ id: "user-1", email: "user@dietai.test" });

    const action = serverAction({}, async (ctx) => ({
      ok: true,
      ownerId: ctx.user.id,
    }));

    const result = await action(undefined);

    expect(result).toEqual({
      data: { ok: true, ownerId: "user-1" },
      error: null,
    });
  });
});

describe("serverAction — auth", () => {
  it("returns { error: 'Unauthorized' } when no session", async () => {
    mockSession(null);

    const action = serverAction({}, async () => "ok");
    const result = await action(undefined);

    expect(result).toEqual({ data: null, error: "Unauthorized" });
  });

  it("returns { error: 'User not found' } when session exists but user row missing", async () => {
    mockSession("ghost@dietai.test");
    mockUser(null);

    const action = serverAction({}, async () => "ok");
    const result = await action(undefined);

    expect(result).toEqual({ data: null, error: "User not found" });
  });
});

describe("serverAction — validation", () => {
  it("returns 'Invalid input' error when config.input schema rejects rawInput", async () => {
    mockSession("u@dietai.test");
    mockUser({ id: "user-1", email: "u@dietai.test" });

    const schema = z.object({ count: z.number().int() });
    const action = serverAction(
      { input: schema },
      async (_ctx, input) => input.count * 2
    );

    const result = await action({
      count: "not a number",
    } as unknown as z.infer<typeof schema>);

    expect(result.data).toBeNull();
    expect(typeof result.error).toBe("string");
    expect(result.error as string).toMatch(/^Invalid input/);
  });
});

describe("serverAction — requires", () => {
  it("maps QuotaExceededError thrown from requires to structured payload", async () => {
    mockSession("u@dietai.test");
    mockUser({ id: "user-1", email: "u@dietai.test" });

    const action = serverAction(
      {
        requires: async () => {
          throw new QuotaExceededError("savedRecipes", 15, 15);
        },
      },
      async () => "should not reach body"
    );

    const result = await action(undefined);

    expect(result).toEqual({
      data: null,
      error: { code: "QUOTA_EXCEEDED", quota: "savedRecipes", limit: 15, used: 15 },
    });
  });
});

describe("serverAction — revalidates", () => {
  it("calls revalidatePath for each path in static array after successful body", async () => {
    mockSession("u@dietai.test");
    mockUser({ id: "user-1", email: "u@dietai.test" });

    const action = serverAction(
      { revalidates: ["/recipes", "/dashboard"] },
      async () => ({ id: "abc" })
    );
    await action(undefined);

    expect(revalidatePath).toHaveBeenCalledWith("/recipes");
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard");
    expect(revalidatePath).toHaveBeenCalledTimes(2);
  });

  it("does NOT call revalidatePath when body throws", async () => {
    mockSession("u@dietai.test");
    mockUser({ id: "user-1", email: "u@dietai.test" });

    const action = serverAction(
      { revalidates: ["/recipes"] },
      async () => {
        throw new Error("body failure");
      }
    );
    await action(undefined);

    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("supports revalidates as a function of the body result for dynamic paths", async () => {
    mockSession("u@dietai.test");
    mockUser({ id: "user-1", email: "u@dietai.test" });

    const action = serverAction(
      {
        revalidates: ((plan: { id: string }) => [
          "/meal-plans",
          `/meal-plans/${plan.id}`,
        ]) as unknown as string[],
      },
      async () => ({ id: "plan-42" })
    );
    await action(undefined);

    expect(revalidatePath).toHaveBeenCalledWith("/meal-plans");
    expect(revalidatePath).toHaveBeenCalledWith("/meal-plans/plan-42");
    expect(revalidatePath).toHaveBeenCalledTimes(2);
  });
});
