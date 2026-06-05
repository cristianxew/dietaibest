import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

import { useShoppingAutomation } from "@/hooks/use-shopping-automation";

const startShoppingTaskMock = vi.fn();
const paywallOpenMock = vi.fn();

vi.mock("@/actions/shopping-automation", () => ({
  startShoppingTask: (...args: unknown[]) => startShoppingTaskMock(...args),
}));

vi.mock("@/components/billing/PaywallProvider", () => ({
  usePaywall: () => ({
    isOpen: false,
    payload: null,
    open: paywallOpenMock,
    close: vi.fn(),
  }),
}));

class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  readyState = 0;
  close = vi.fn();
  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }
}

describe("useShoppingAutomation — paywall integration", () => {
  let originalEventSource: typeof EventSource;

  beforeEach(() => {
    originalEventSource = globalThis.EventSource;
    MockEventSource.instances = [];
    // @ts-expect-error mock
    globalThis.EventSource = MockEventSource;
    startShoppingTaskMock.mockReset();
    paywallOpenMock.mockReset();
  });

  afterEach(() => {
    globalThis.EventSource = originalEventSource;
    vi.restoreAllMocks();
  });

  const proOnlyResult = {
    data: null,
    error: { code: "PRO_ONLY" as const, feature: "shoppingAutomation" },
  };

  const quotaResult = {
    data: null,
    error: {
      code: "QUOTA_EXCEEDED" as const,
      quota: "savedRecipes",
      limit: 15,
      used: 15,
    },
  };

  const stringErrorResult = {
    data: null,
    error: "Network error",
  };

  const baseInput = { store: "carrefour" as const, items: [] };

  it("opens the paywall when startShoppingTask returns a PRO_ONLY entitlement error", async () => {
    (startShoppingTaskMock as Mock).mockResolvedValueOnce(proOnlyResult);

    const { result } = renderHook(() => useShoppingAutomation());

    await act(async () => {
      await result.current.startAutomation(baseInput);
    });

    await waitFor(() => {
      expect(paywallOpenMock).toHaveBeenCalledTimes(1);
    });
    expect(paywallOpenMock).toHaveBeenCalledWith(proOnlyResult.error);
  });

  it("opens the paywall when startShoppingTask returns a QUOTA_EXCEEDED error", async () => {
    (startShoppingTaskMock as Mock).mockResolvedValueOnce(quotaResult);

    const { result } = renderHook(() => useShoppingAutomation());

    await act(async () => {
      await result.current.startAutomation(baseInput);
    });

    await waitFor(() => {
      expect(paywallOpenMock).toHaveBeenCalledTimes(1);
    });
    expect(paywallOpenMock).toHaveBeenCalledWith(quotaResult.error);
  });

  it("does NOT open the paywall for plain string errors (network, unknown)", async () => {
    (startShoppingTaskMock as Mock).mockResolvedValueOnce(stringErrorResult);

    const { result } = renderHook(() => useShoppingAutomation());

    await act(async () => {
      await result.current.startAutomation(baseInput);
    });

    expect(paywallOpenMock).not.toHaveBeenCalled();
    expect(result.current.state.error).toBe("Network error");
  });
});
