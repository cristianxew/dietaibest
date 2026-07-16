import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Mock server-only module to allow testing server-side code
vi.mock("server-only", () => ({}));

// Keep the nutrition pipeline's structured logs out of test output.
process.env.NUTRITION_LOG_LEVEL = "silent";

// Global test utilities
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock window.matchMedia (jsdom only — node-environment test files have no window)
if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {}, // deprecated
      removeListener: () => {}, // deprecated
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => {},
    }),
  });
}

// Mock IntersectionObserver
if (!global.IntersectionObserver) {
  global.IntersectionObserver = class MockIntersectionObserver {
    root = null;
    rootMargin = "";
    thresholds: number[] = [];

    constructor() {}
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  } as unknown as typeof IntersectionObserver;
}

// Mock HTMLElement methods (jsdom only)
if (typeof HTMLElement !== "undefined") {
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    value: () => {},
    writable: true,
  });
}
