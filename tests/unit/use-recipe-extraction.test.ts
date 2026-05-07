import { act, renderHook, waitFor } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
} from "vitest";

import {
  useRecipeExtraction,
  useRecipeErrorTranslation,
} from "@/hooks/use-recipe-extraction";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => `translated:${key}`,
}));

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("useRecipeExtraction (polling-only)", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts in idle state", () => {
    const { result } = renderHook(() => useRecipeExtraction());
    expect(result.current.state.status).toBe("idle");
  });

  it("rejects when the start request fails", async () => {
    (globalThis.fetch as Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Bad URL" }),
    });

    const { result } = renderHook(() => useRecipeExtraction());

    let extractPromise: Promise<unknown> | undefined;
    act(() => {
      extractPromise = result.current
        .extract("https://example.com/bad")
        .catch((err) => err);
    });

    const error = (await extractPromise) as Error;
    expect(error).toBeInstanceOf(Error);
    await waitFor(() => {
      expect(result.current.state.status).toBe("error");
    });
  });

  describe("polling loop", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
      vi.clearAllMocks();
    });

    it("happy path: polls and returns canonical ImportedRecipe", async () => {
      const fetchMock = globalThis.fetch as Mock;
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ taskId: "task-poll" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: "running",
            progress: 30,
            message: "Step 1",
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: "completed",
            progress: 100,
            data: { title: "Test Recipe" },
          }),
        });

      const { result } = renderHook(() => useRecipeExtraction());

      let extractPromise: Promise<unknown> | undefined;
      act(() => {
        extractPromise = result.current.extract("https://example.com/r");
      });

      // wait for initial fetch (POST start)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      // First poll
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(result.current.state.progress).toBe(30);

      // Second poll → completed
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });

      const recipe = await extractPromise;
      expect(recipe).toEqual({ title: "Test Recipe" });
      expect(result.current.state.status).toBe("success");
    });

    it("handles transient 404s and continues polling", async () => {
      const fetchMock = globalThis.fetch as Mock;
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ taskId: "task-404" }),
        })
        .mockResolvedValueOnce({
          status: 404,
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: "completed",
            progress: 100,
            data: { title: "Test 404" },
          }),
        });

      const { result } = renderHook(() => useRecipeExtraction());

      let extractPromise: Promise<unknown> | undefined;
      act(() => {
        extractPromise = result.current.extract("https://example.com/r");
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      // Poll 1 (404, transient)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(result.current.state.status).toBe("polling");

      // Poll 2 (completed)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });

      const recipe = await extractPromise;
      expect(recipe).toEqual({ title: "Test 404" });
    });

    it("rejects when polling exceeds maxPolls", async () => {
      const fetchMock = globalThis.fetch as Mock;
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ taskId: "task-timeout" }),
      });

      // all polls return running
      fetchMock.mockImplementation((url) => {
        if (url?.includes("task-timeout")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ status: "running", progress: 50 }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({}) });
      });

      const { result } = renderHook(() => useRecipeExtraction());

      let extractPromise: Promise<unknown> | undefined;
      act(() => {
        extractPromise = result.current
          .extract("https://example.com/r")
          .catch((e) => e);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(60 * 2000);
      });

      const error = (await extractPromise) as Error;
      expect(error.message).toBe("translated:errors.timeout");
      expect(result.current.state.status).toBe("error");
    });

    it("rejects when poll returns failed status", async () => {
      const fetchMock = globalThis.fetch as Mock;
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ taskId: "task-fail" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: "failed",
            message: "Recipe extraction failed",
          }),
        });

      const { result } = renderHook(() => useRecipeExtraction());

      let extractPromise: Promise<unknown> | undefined;
      act(() => {
        extractPromise = result.current
          .extract("https://example.com/r")
          .catch((e) => e);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });

      const error = (await extractPromise) as Error;
      expect(error).toBeInstanceOf(Error);
      expect(result.current.state.status).toBe("error");
    });

    it("cancel stops polling and sets status to cancelled", async () => {
      const fetchMock = globalThis.fetch as Mock;
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ taskId: "task-cancel" }),
        })
        .mockResolvedValue({
          ok: true,
          json: async () => ({ status: "running", progress: 50 }),
        });

      const { result } = renderHook(() => useRecipeExtraction());

      let extractPromise: Promise<unknown> | undefined;
      act(() => {
        extractPromise = result.current
          .extract("https://example.com/r")
          .catch((err) => err);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      await act(async () => {
        await result.current.cancel();
      });

      await extractPromise;
      expect(result.current.state.status).toBe("cancelled");
    });
  });

  it("does not throw on unmount mid-extraction", async () => {
    (globalThis.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ taskId: "task-unmount" }),
    });

    const { result, unmount } = renderHook(() => useRecipeExtraction());

    act(() => {
      void result.current.extract("https://example.com/r").catch(() => {});
    });

    await flush();
    unmount();
    await flush();

    // No assertion needed: unmount must not throw and must clean up timers/refs.
    expect(true).toBe(true);
  });

  describe("useRecipeErrorTranslation (15+ error patterns)", () => {
    const errorPatterns = [
      {
        input: "Task stopped due to consecutive failures",
        expected: "translated:errors.consecutiveFailures",
      },
      {
        input: "Error 404: task not found",
        expected: "translated:errors.taskNotFound",
      },
      {
        input: "Task taking longer than expected",
        expected: "translated:errors.timeout",
      },
      {
        input: "Recipe extraction took too long",
        expected: "translated:errors.timeout",
      },
      {
        input: "Extraction was cancelled by user",
        expected: "translated:errors.cancelled",
      },
      {
        input: "A network error occurred during fetch",
        expected: "translated:errors.network",
      },
      { input: "Unauthorized access", expected: "translated:errors.unauthorized" },
      {
        input: "Invalid validation token",
        expected: "translated:errors.validation",
      },
      {
        input: "Page does not contain a recipe",
        expected: "translated:errors.noRecipe",
      },
      { input: "Blocked by popup overlay", expected: "translated:errors.blocked" },
      {
        input: "Anti-bot captcha protection triggered",
        expected: "translated:errors.antiBot",
      },
      {
        input: "A very specific middle-length error message that serves as fallback",
        expected:
          "A very specific middle-length error message that serves as fallback",
      },
      { input: "Short", expected: "translated:errors.processingFailed" },
      {
        input:
          "An extremely long error message that goes on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on...",
        expected: "translated:errors.processingFailed",
      },
      {
        input: new Error("network disconnect"),
        expected: "translated:errors.network",
      },
    ];

    it.each(errorPatterns)(
      "translates '$input' correctly",
      ({ input, expected }) => {
        const { result } = renderHook(() => useRecipeErrorTranslation());
        const getErrorMessage = result.current;
        expect(getErrorMessage(input)).toBe(expected);
      },
    );
  });
});
