import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { stepScrollDirection, useHideOnAnyScroll } from "@/hooks/use-hide-on-scroll";

describe("stepScrollDirection", () => {
  it("ignores movement under the 8px tolerance and keeps the anchor", () => {
    expect(stepScrollDirection(100, 107)).toEqual({ anchorY: 100, hidden: null });
    expect(stepScrollDirection(100, 93)).toEqual({ anchorY: 100, hidden: null });
  });

  it("hides on scroll down and shows on scroll up, moving the anchor", () => {
    expect(stepScrollDirection(100, 108)).toEqual({ anchorY: 108, hidden: true });
    expect(stepScrollDirection(100, 60)).toEqual({ anchorY: 60, hidden: false });
  });
});

describe("useHideOnAnyScroll", () => {
  let scroller: HTMLDivElement;
  let carousel: HTMLDivElement;

  /** Moves an element's scrollTop and fires a (non-bubbling) scroll event at it. */
  function scrollTo(el: HTMLElement, top: number) {
    Object.defineProperty(el, "scrollTop", { value: top, configurable: true });
    act(() => {
      el.dispatchEvent(new Event("scroll", { bubbles: false }));
      vi.advanceTimersByTime(16);
    });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 16) as unknown as number
    );
    vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
    scroller = document.createElement("div");
    carousel = document.createElement("div");
    document.body.append(scroller, carousel);
  });

  afterEach(() => {
    scroller.remove();
    carousel.remove();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("hides when a nested container scrolls down and shows when it scrolls up", () => {
    const { result } = renderHook(() => useHideOnAnyScroll());
    scrollTo(scroller, 200); // first sighting only records the position
    expect(result.current.hidden).toBe(false);

    scrollTo(scroller, 260);
    expect(result.current.hidden).toBe(true);

    scrollTo(scroller, 255); // under the tolerance
    expect(result.current.hidden).toBe(true);

    scrollTo(scroller, 230);
    expect(result.current.hidden).toBe(false);
  });

  it("shows again near the top of the scrolled container", () => {
    const { result } = renderHook(() => useHideOnAnyScroll({ revealWithin: 64 }));
    scrollTo(scroller, 200);
    scrollTo(scroller, 300);
    expect(result.current.hidden).toBe(true);

    // Jumping straight to the top (e.g. a scroll-to-top) reveals it
    scrollTo(scroller, 40);
    expect(result.current.hidden).toBe(false);
  });

  it("ignores scrolls that don't move a container vertically", () => {
    const { result } = renderHook(() => useHideOnAnyScroll());
    scrollTo(scroller, 200);
    scrollTo(scroller, 300);
    expect(result.current.hidden).toBe(true);

    // A horizontal carousel keeps scrollTop at 0
    scrollTo(carousel, 0);
    scrollTo(carousel, 0);
    expect(result.current.hidden).toBe(true);
  });

  it("stays visible while disabled", () => {
    const { result, rerender } = renderHook(
      ({ disabled }) => useHideOnAnyScroll({ disabled }),
      { initialProps: { disabled: false } }
    );
    scrollTo(scroller, 200);
    scrollTo(scroller, 300);
    expect(result.current.hidden).toBe(true);

    rerender({ disabled: true });
    expect(result.current.hidden).toBe(false);
    scrollTo(scroller, 500);
    expect(result.current.hidden).toBe(false);
  });
});
