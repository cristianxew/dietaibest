import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Mock server-only module to allow testing server-side code
vi.mock("server-only", () => ({}));

// Global test utilities
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock window.matchMedia
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

// Mock HTMLElement methods
Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
  value: () => {},
  writable: true,
});
