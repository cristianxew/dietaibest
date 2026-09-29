import { useCallback, useEffect, useRef, useState } from "react";

/** Movement (px) the user must scroll in one direction before the bar toggles. */
const TOLERANCE = 8;

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
      const delta = y - anchorY;

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

      if (Math.abs(delta) < TOLERANCE) return;
      setHidden(delta > 0);
      anchorY = y;
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
