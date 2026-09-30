"use client";

import { useEffect } from "react";
import type { RefObject } from "react";

/**
 * Mirrors an element's rendered height into a CSS custom property on a target
 * element, so sticky offsets track wrapping toolbars instead of hard-coded px.
 */
export function useHeightCssVar(
  source: RefObject<HTMLElement | null>,
  target: RefObject<HTMLElement | null>,
  name: string,
  remountKey?: unknown
) {
  useEffect(() => {
    const sourceEl = source.current;
    const targetEl = target.current;
    if (!sourceEl || !targetEl) return;

    const apply = () => {
      targetEl.style.setProperty(name, `${Math.ceil(sourceEl.getBoundingClientRect().height)}px`);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(sourceEl);
    return () => observer.disconnect();
  }, [source, target, name, remountKey]);
}
