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

import { useRecipeExtraction, useRecipeErrorTranslation } from "@/hooks/use-recipe-extraction";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => `translated:${key}`,
}));

type MessageHandler = (event: MessageEvent) => void;
type ErrorHandler = (event: Event) => void;

class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  onmessage: MessageHandler | null = null;
  onerror: ErrorHandler | null = null;
  onopen: (() => void) | null = null;
  readyState = 0;
  close = vi.fn(() => {
    this.readyState = 2;
  });

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  emit(data: unknown) {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }

  emitError() {
    this.onerror?.(new Event("error"));
  }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("useRecipeExtraction", () => {
  let originalEventSource: typeof EventSource;

  beforeEach(() => {
    originalEventSource = globalThis.EventSource;
    MockEventSource.instances = [];
    // @ts-expect-error - assigning mock
    globalThis.EventSource = MockEventSource;
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.EventSource = originalEventSource;
    vi.restoreAllMocks();
  });

  it("starts in idle state", () => {
    const { result } = renderHook(() => useRecipeExtraction());
    expect(result.current.state.status).toBe("idle");
  });

  it("happy path: returns canonical ImportedRecipe on SSE complete event", async () => {
    (globalThis.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ taskId: "task-123" }),
    });

    const { result } = renderHook(() => useRecipeExtraction());

    let extractPromise: Promise<unknown> | undefined;
    act(() => {
      extractPromise = result.current.extract("https://example.com/recipe");
    });

    await waitFor(() => {
      expect(MockEventSource.instances.length).toBe(1);
    });

    const es = MockEventSource.instances[0];
    expect(es.url).toContain("taskId=task-123");

    await waitFor(() => {
      expect(result.current.state.status).toBe("polling");
    });

    act(() => {
      es.emit({
        type: "status",
        status: "running",
        progress: 50,
        message: "Halfway",
        currentStep: 5,
        currentUrl: "https://example.com/page",
      });
    });

    await waitFor(() => {
      expect(result.current.state.progress).toBe(50);
      expect(result.current.state.currentStep).toBe(5);
    });

    act(() => {
      es.emit({
        type: "complete",
        status: "success",
        progress: 100,
        data: {
          title: "Pasta Carbonara",
          ingredients: [{ name: "pasta", amount: 200, unit: "g" }],
          instructions: ["Boil water", "Cook pasta"],
          servings: 4,
        },
      });
    });

    const recipe = await extractPromise;
    expect(recipe).toMatchObject({
      title: "Pasta Carbonara",
      ingredients: [{ name: "pasta", amount: 200, unit: "g" }],
      instructions: ["Boil water", "Cook pasta"],
    });

    await waitFor(() => {
      expect(result.current.state.status).toBe("success");
    });
    expect(es.close).toHaveBeenCalled();
  });

  it("error path: rejects when SSE emits an error event", async () => {
    (globalThis.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ taskId: "task-err" }),
    });

    const { result } = renderHook(() => useRecipeExtraction());

    let extractPromise: Promise<unknown> | undefined;
    act(() => {
      extractPromise = result.current
        .extract("https://example.com/bad")
        .catch((err) => err);
    });

    await waitFor(() => expect(MockEventSource.instances.length).toBe(1));
    const es = MockEventSource.instances[0];

    act(() => {
      es.emit({
        type: "error",
        status: "failed",
        message: "Recipe extraction failed",
      });
    });

    const error = (await extractPromise) as Error;
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toContain("Recipe extraction failed");

    await waitFor(() => {
      expect(result.current.state.status).toBe("error");
    });
    expect(es.close).toHaveBeenCalled();
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
    expect(MockEventSource.instances.length).toBe(0);
  });

  it("rejects on SSE connection error (onerror)", async () => {
    (globalThis.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ taskId: "task-conn" }),
    });

    const { result } = renderHook(() => useRecipeExtraction());

    let extractPromise: Promise<unknown> | undefined;
    act(() => {
      extractPromise = result.current
        .extract("https://example.com/r")
        .catch((err) => err);
    });

    await waitFor(() => expect(MockEventSource.instances.length).toBe(1));
    const es = MockEventSource.instances[0];

    act(() => {
      es.emitError();
    });

    const error = (await extractPromise) as Error;
    expect(error).toBeInstanceOf(Error);
    expect(es.close).toHaveBeenCalled();
  });

  it("cancel closes EventSource and sets status to cancelled", async () => {
    (globalThis.fetch as Mock)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ taskId: "task-cancel" }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    const { result } = renderHook(() => useRecipeExtraction());

    let extractPromise: Promise<unknown> | undefined;
    act(() => {
      extractPromise = result.current
        .extract("https://example.com/r")
        .catch((err) => err);
    });

    await waitFor(() => expect(MockEventSource.instances.length).toBe(1));
    const es = MockEventSource.instances[0];

    act(() => {
      result.current.cancel();
    });

    await extractPromise;
    expect(es.close).toHaveBeenCalled();
    await waitFor(() => {
      expect(result.current.state.status).toBe("cancelled");
    });
  });

  it("closes EventSource on unmount", async () => {
    (globalThis.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ taskId: "task-unmount" }),
    });

    const { result, unmount } = renderHook(() => useRecipeExtraction());

    act(() => {
      void result.current.extract("https://example.com/r").catch(() => { });
    });

    await waitFor(() => expect(MockEventSource.instances.length).toBe(1));
    const es = MockEventSource.instances[0];

    unmount();
    await flush();

    expect(es.close).toHaveBeenCalled();
  });

  describe("Polling branch", () => {
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
          json: async () => ({ status: "running", progress: 30, message: "Step 1" }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: "completed",
            progress: 100,
            data: { title: "Test Recipe" },
          }),
        });

      const { result } = renderHook(() => useRecipeExtraction({ useSSE: false }));

      let extractPromise: Promise<unknown> | undefined;
      act(() => {
        extractPromise = result.current.extract("https://example.com/r");
      });

      // wait for initial fetch
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      // First poll
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(result.current.state.progress).toBe(30);

      // Second poll
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
          status: 404, // transient error
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            status: "completed",
            progress: 100,
            data: { title: "Test 404" },
          }),
        });

      const { result } = renderHook(() => useRecipeExtraction({ useSSE: false }));

      let extractPromise: Promise<unknown> | undefined;
      act(() => {
        extractPromise = result.current.extract("https://example.com/r");
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      // Poll 1 (404)
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

      const { result } = renderHook(() => useRecipeExtraction({ useSSE: false }));

      let extractPromise: Promise<unknown> | undefined;
      act(() => {
        extractPromise = result.current.extract("https://example.com/r").catch(e => e);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(60 * 2000);
      });

      const error = await extractPromise as Error;
      expect(error.message).toBe("translated:errors.timeout");
      expect(result.current.state.status).toBe("error");
    });
  });

  describe("useRecipeErrorTranslation (15+ error patterns)", () => {
    const errorPatterns = [
      { input: "Task stopped due to consecutive failures", expected: "translated:errors.consecutiveFailures" },
      { input: "Error 404: task not found", expected: "translated:errors.taskNotFound" },
      { input: "Task taking longer than expected", expected: "translated:errors.timeout" },
      { input: "Recipe extraction took too long", expected: "translated:errors.timeout" },
      { input: "Extraction was cancelled by user", expected: "translated:errors.cancelled" },
      { input: "A network error occurred during fetch", expected: "translated:errors.network" },
      { input: "Unauthorized access", expected: "translated:errors.unauthorized" },
      { input: "Invalid validation token", expected: "translated:errors.validation" },
      { input: "Page does not contain a recipe", expected: "translated:errors.noRecipe" },
      { input: "Blocked by popup overlay", expected: "translated:errors.blocked" },
      { input: "Anti-bot captcha protection triggered", expected: "translated:errors.antiBot" },
      { input: "A very specific middle-length error message that serves as fallback", expected: "A very specific middle-length error message that serves as fallback" },
      { input: "Short", expected: "translated:errors.processingFailed" },
      { input: "An extremely long error message that goes on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on and on...", expected: "translated:errors.processingFailed" },
      { input: new Error("network disconnect"), expected: "translated:errors.network" },
    ];

    it.each(errorPatterns)(
      "translates '$input' correctly",
      ({ input, expected }) => {
        const { result } = renderHook(() => useRecipeErrorTranslation());
        const getErrorMessage = result.current;
        expect(getErrorMessage(input)).toBe(expected);
      }
    );
  });
});
