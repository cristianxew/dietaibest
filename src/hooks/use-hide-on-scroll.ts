import { useCallback, useEffect, useRef, useState } from "react";

/** Movement (px) the user must scroll in one direction before the element toggles. */
export const HIDE_ON_SCROLL_TOLERANCE = 8;

/**
 * One step of the "hide on scroll down, reveal on scroll up" state machine
 * shared by the hooks below. Movement under the tolerance since the anchor is
 * ignored (`hidden: null`, anchor kept); otherwise the anchor moves to `y` and
 * the element hides when the scroll went down and shows when it went up.
 */
export function stepScrollDirection(
  anchorY: number,
  y: number
): { anchorY: number; hidden: boolean | null } {
  const delta = y - anchorY;
  if (Math.abs(delta) < HIDE_ON_SCROLL_TOLERANCE) return { anchorY, hidden: null };
  return { anchorY: y, hidden: delta > 0 };
}

/**
 * Nearest ancestor that scrolls vertically. The protected-pages shell scrolls
 * inside `#main-content`, not the window, so listening on `window` would never fire.
 */
function getScrollParent(el: HTMLElement): HTMLElement | Window {
  let node = el.parentElement;
  while (node) {
    if (/(auto|scroll|overlay)/.test(getComputedStyle(node).overflowY)) {
      return node;
    }
    node = node.parentElement;
  }
  return window;
}

/**
 * "Hide on scroll down, reveal on scroll up" for a sticky bar.
 *
 * Returns a callback ref for the bar and whether it should currently be hidden.
 * The bar never hides near the top of the page, while focus is inside it (e.g.
 * the search input with the on-screen keyboard open), or while `disabled`.
 */
export function useHideOnScroll({ disabled = false }: { disabled?: boolean } = {}) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [hidden, setHidden] = useState(false);
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  useEffect(() => {
    if (disabled) setHidden(false);
  }, [disabled]);

  useEffect(() => {
    if (!node) return;

    const scroller = getScrollParent(node);
    const getY = () =>
      scroller instanceof Window ? scroller.scrollY : scroller.scrollTop;

    let anchorY = getY();
    let frame = 0;

    const update = () => {
      frame = 0;
      const y = getY();

      if (
        disabledRef.current ||
        node.contains(document.activeElement) ||
        // Keep it visible until the bar has fully scrolled past its natural spot.
        y <= node.offsetHeight * 2
      ) {
        setHidden(false);
        anchorY = y;
        return;
      }

      const step = stepScrollDirection(anchorY, y);
      anchorY = step.anchorY;
      if (step.hidden !== null) setHidden(step.hidden);
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      scroller.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [node]);

  const ref = useCallback((el: HTMLElement | null) => setNode(el), []);

  return { ref, hidden };
}

/** Vertical scroll position of a `scroll` event target, or null if it has none. */
function scrollTopOf(target: EventTarget | null): number | null {
  if (target === document) {
    return document.scrollingElement?.scrollTop ?? window.scrollY;
  }
  return target instanceof Element ? target.scrollTop : null;
}

/**
 * `useHideOnScroll` for a fixed element that lives outside the page's scroller
 * (e.g. the chat FAB). Pages scroll inside nested containers rather than the
 * window, so it listens for `scroll` on `document` in the capture phase (scroll
 * events don't bubble) and tracks each scroll target's direction separately.
 * Scrolls that don't move a target vertically (carousels) are ignored.
 *
 * The element shows again when the scrolled container is back within
 * `revealWithin` px of its top, while focus is inside it, or while `disabled`.
 */
export function useHideOnAnyScroll({
  disabled = false,
  revealWithin = 64,
}: { disabled?: boolean; revealWithin?: number } = {}) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (disabled) {
      setHidden(false);
      return;
    }

    const anchors = new WeakMap<EventTarget, number>();
    const pending = new Set<EventTarget>();
    let frame = 0;

    const update = () => {
      frame = 0;
      for (const target of pending) {
        const y = scrollTopOf(target);
        const anchorY = anchors.get(target);
        if (y === null) continue;
        // First sighting only records where this container is.
        if (anchorY === undefined) {
          anchors.set(target, y);
          continue;
        }
        if (y === anchorY) continue;

        if (y <= revealWithin || node?.contains(document.activeElement)) {
          anchors.set(target, y);
          setHidden(false);
          continue;
        }

        const step = stepScrollDirection(anchorY, y);
        anchors.set(target, step.anchorY);
        if (step.hidden !== null) setHidden(step.hidden);
      }
      pending.clear();
    };

    const onScroll = (event: Event) => {
      if (event.target) pending.add(event.target);
      if (!frame) frame = requestAnimationFrame(update);
    };

    const options = { capture: true, passive: true } as const;
    document.addEventListener("scroll", onScroll, options);
    return () => {
      document.removeEventListener("scroll", onScroll, options);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [disabled, node, revealWithin]);

  const ref = useCallback((el: HTMLElement | null) => setNode(el), []);

  return { ref, hidden };
}
