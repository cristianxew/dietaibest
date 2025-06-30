import { useEffect, useCallback, RefObject } from "react";

/**
 * Configuration options for keyboard navigation
 */
interface KeyboardNavigationOptions {
  /**
   * Whether the component/menu is currently open
   */
  isOpen?: boolean;
  /**
   * Callback to close the component/menu
   */
  onClose?: () => void;
  /**
   * Custom keyboard shortcuts map
   */
  shortcuts?: { [key: string]: () => void };
  /**
   * Whether to enable focus trapping
   */
  enableFocusTrapping?: boolean;
  /**
   * Container ref for focus trapping
   */
  containerRef?: RefObject<HTMLElement | null>;
  /**
   * Trigger element ref for focus restoration
   */
  triggerRef?: RefObject<HTMLElement | null>;
}

/**
 * Custom hook for keyboard navigation functionality
 *
 * Provides common keyboard navigation patterns including:
 * - Escape key to close
 * - Custom keyboard shortcuts
 * - Focus trapping within containers
 * - Focus restoration after closing
 *
 * @param options - Configuration options for keyboard navigation
 */
export function useKeyboardNavigation(options: KeyboardNavigationOptions = {}) {
  const {
    isOpen = false,
    onClose,
    shortcuts = {},
    enableFocusTrapping = false,
    containerRef,
    triggerRef,
  } = options;

  /**
   * Focus trapping implementation
   */
  const trapFocus = useCallback(
    (event: KeyboardEvent) => {
      if (!containerRef?.current) return;

      const focusableElements = containerRef.current.querySelectorAll(
        'a[href], button:not([disabled]), textarea:not([disabled]), input[type="text"]:not([disabled]), input[type="radio"]:not([disabled]), input[type="checkbox"]:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
      );

      const firstElement = focusableElements[0] as HTMLElement;
      const lastElement = focusableElements[
        focusableElements.length - 1
      ] as HTMLElement;

      if (!firstElement) return;

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement?.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement?.focus();
      }
    },
    [containerRef]
  );

  /**
   * Focus the first focusable element in container
   */
  const focusFirstElement = useCallback(() => {
    if (!containerRef?.current) return;

    const firstFocusable = containerRef.current.querySelector(
      'a[href], button:not([disabled]), textarea:not([disabled]), input[type="text"]:not([disabled]), input[type="radio"]:not([disabled]), input[type="checkbox"]:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
    ) as HTMLElement;

    setTimeout(() => {
      firstFocusable?.focus();
    }, 100);
  }, [containerRef]);

  /**
   * Restore focus to trigger element
   */
  const restoreFocus = useCallback(() => {
    setTimeout(() => {
      triggerRef?.current?.focus();
    }, 100);
  }, [triggerRef]);

  /**
   * Handle keyboard events
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Handle Escape key
      if (event.key === "Escape" && isOpen && onClose) {
        event.preventDefault();
        onClose();
        return;
      }

      // Handle custom shortcuts
      const shortcutKey =
        event.altKey || event.ctrlKey || event.metaKey
          ? `${event.altKey ? "Alt+" : ""}${event.ctrlKey ? "Ctrl+" : ""}${
              event.metaKey ? "Meta+" : ""
            }${event.key.toLowerCase()}`
          : event.key;

      if (shortcuts[shortcutKey]) {
        event.preventDefault();
        shortcuts[shortcutKey]();
        return;
      }

      // Handle focus trapping
      if (isOpen && enableFocusTrapping && event.key === "Tab") {
        trapFocus(event);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, shortcuts, enableFocusTrapping, trapFocus]);

  /**
   * Auto-focus first element when opening
   */
  useEffect(() => {
    if (isOpen && enableFocusTrapping) {
      focusFirstElement();
    }
  }, [isOpen, enableFocusTrapping, focusFirstElement]);

  return {
    trapFocus,
    focusFirstElement,
    restoreFocus,
  };
}

/**
 * Common keyboard shortcuts for navigation components
 */
export const KEYBOARD_SHORTCUTS = {
  CLOSE_MENU: "Escape",
  TOGGLE_MOBILE_MENU: "Alt+m",
  TOGGLE_USER_MENU: "Alt+u",
  FOCUS_HEADER: "Alt+h",
  DASHBOARD: "Alt+1",
  RECIPES: "Alt+2",
  MEAL_PLANS: "Alt+3",
  SHOPPING: "Alt+4",
} as const;

/**
 * Accessibility helpers for keyboard navigation
 */
export const A11Y_HELPERS = {
  /**
   * Get ARIA attributes for a dropdown trigger
   */
  getDropdownTriggerProps: (isOpen: boolean, menuId?: string) => ({
    "aria-expanded": isOpen,
    "aria-haspopup": "menu" as const,
    "aria-controls": menuId,
  }),

  /**
   * Get ARIA attributes for a menu container
   */
  getMenuProps: (menuId?: string) => ({
    role: "menu" as const,
    id: menuId,
  }),

  /**
   * Get ARIA attributes for a menu item
   */
  getMenuItemProps: () => ({
    role: "menuitem" as const,
  }),
} as const;
