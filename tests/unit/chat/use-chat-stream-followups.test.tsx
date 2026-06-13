import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { useChatStream } from "@/components/chat/useChatStream";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/en/dashboard",
  useRouter: () => ({ push: pushMock }),
}));

const translate = {
  status: () => "status",
  confirmDelete: () => "confirm",
  confirmGenerateImage: () => "confirm",
  generateImageYes: () => "yes",
  generateImageNo: () => "no",
  generateImageSkipped: () => "skipped",
  error: () => "error",
  guardrailRedacted: () => "redacted",
  success: () => "ok",
  deleted: () => "deleted",
  cancelled: () => "cancelled",
  costCapReached: () => "cap",
};

function sse(events: unknown[]): Response {
  const body = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

const sseQueue: Response[] = [];

beforeEach(() => {
  pushMock.mockClear();
  sseQueue.length = 0;
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/api/chat/conversation")) {
      return new Response(JSON.stringify({ messages: [] }), { status: 200 });
    }
    if (url.endsWith("/api/chat") || url === "/api/chat") {
      return sseQueue.shift() ?? sse([{ type: "finish" }]);
    }
    return new Response("{}", { status: 200 });
  }) as unknown as typeof fetch;
});

describe("useChatStream follow-ups", () => {
  it("exposes deterministic follow-ups after a createRecipe turn, even when auto-nav fires", async () => {
    sseQueue.push(
      sse([
        {
          type: "tool.invoked",
          toolName: "createRecipe",
          callId: "c1",
          statusKey: "recipe.creating",
        },
        {
          type: "tool.completed",
          toolName: "createRecipe",
          callId: "c1",
          link: { type: "recipe", href: "/en/recipes/xyz", label: "Recipe" },
        },
        { type: "finish" },
      ])
    );

    const { result } = renderHook(() =>
      useChatStream({ locale: "en", translate })
    );

    await act(async () => {
      await result.current.send("create a pasta recipe");
    });

    expect(result.current.followUps.map((c) => c.id)).toEqual([
      "analyzeNutrition",
      "generateRecipeImage",
      "addRecipeToPlan",
    ]);
    expect(pushMock).toHaveBeenCalledWith("/en/recipes/xyz");
  });

  it("clears follow-ups on the next send and stays empty for unmapped tools", async () => {
    sseQueue.push(
      sse([
        {
          type: "tool.invoked",
          toolName: "createRecipe",
          callId: "c1",
          statusKey: "recipe.creating",
        },
        {
          type: "tool.completed",
          toolName: "createRecipe",
          callId: "c1",
        },
        { type: "finish" },
      ]),
      sse([
        {
          type: "tool.invoked",
          toolName: "searchRecipes",
          callId: "c2",
          statusKey: "recipe.searching",
        },
        {
          type: "tool.completed",
          toolName: "searchRecipes",
          callId: "c2",
        },
        { type: "finish" },
      ])
    );

    const { result } = renderHook(() =>
      useChatStream({ locale: "en", translate })
    );

    await act(async () => {
      await result.current.send("create a pasta recipe");
    });
    expect(result.current.followUps.length).toBeGreaterThan(0);

    await act(async () => {
      await result.current.send("find my recipes");
    });
    expect(result.current.followUps).toEqual([]);
  });

  it("does not surface follow-ups for text-only turns", async () => {
    sseQueue.push(sse([{ type: "text.delta", text: "Hi!" }, { type: "finish" }]));

    const { result } = renderHook(() =>
      useChatStream({ locale: "en", translate })
    );

    await act(async () => {
      await result.current.send("hello");
    });
    expect(result.current.followUps).toEqual([]);
  });
});
