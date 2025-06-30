"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { MainNavCompact } from "@/components/navigation/MainNav";
import { UserDropdown } from "@/components/navigation/UserDropdown";
import { LanguageSwitcherCompact } from "@/components/LanguageSwitcher";
import { useAuth } from "@/providers/AuthProvider";
import { cn } from "@/lib/utils";

/**
 * Props interface for the MobileMenu component
 */
interface MobileMenuProps {
  /**
   * Optional CSS class name for styling customization
   */
  className?: string;
}

/**
 * Mobile menu component for small screen devices
 *
 * This component provides a responsive navigation interface using a slide-out
 * drawer for mobile and tablet devices. It includes the main navigation items,
 * authentication controls, settings access, and comprehensive keyboard navigation
 * with focus trapping.
 *
 * @param props - MobileMenu component props
 * @returns JSX.Element - The rendered mobile menu component
 */
export function MobileMenu({ className }: MobileMenuProps) {
  const tMobile = useTranslations("navigation.mobileMenu");
  const tAuth = useTranslations("auth");
  const tA11y = useTranslations("navigation.accessibility");
  const { isAuthenticated, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  /**
   * Handle keyboard shortcuts and focus trapping
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Alt + M to toggle mobile menu
      if (event.altKey && event.key.toLowerCase() === "m") {
        event.preventDefault();
        const newState = !isOpen;
        setIsOpen(newState);

        // Announce state change to screen readers
        const announcement = document.createElement("div");
        announcement.setAttribute("aria-live", "polite");
        announcement.setAttribute("aria-atomic", "true");
        announcement.className = "sr-only";
        announcement.textContent = newState
          ? tA11y("menuOpen")
          : tA11y("menuClosed");
        document.body.appendChild(announcement);
        setTimeout(() => document.body.removeChild(announcement), 1000);
        return;
      }

      // Escape key to close mobile menu
      if (event.key === "Escape" && isOpen) {
        event.preventDefault();
        closeMenu();
        return;
      }

      // Focus trapping when menu is open
      if (isOpen && event.key === "Tab") {
        trapFocus(event);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, tA11y]);

  /**
   * Focus trapping implementation
   */
  const trapFocus = useCallback((event: KeyboardEvent) => {
    if (!contentRef.current) return;

    const focusableElements = contentRef.current.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input[type="text"]:not([disabled]), input[type="radio"]:not([disabled]), input[type="checkbox"]:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
    );

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[
      focusableElements.length - 1
    ] as HTMLElement;

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement?.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement?.focus();
    }
  }, []);

  /**
   * Handle menu toggle
   */
  const toggleMenu = () => {
    const newState = !isOpen;
    setIsOpen(newState);

    // Announce state change to screen readers
    const announcement = document.createElement("div");
    announcement.setAttribute("aria-live", "polite");
    announcement.setAttribute("aria-atomic", "true");
    announcement.className = "sr-only";
    announcement.textContent = newState
      ? tA11y("menuOpen")
      : tA11y("menuClosed");
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 1000);
  };

  /**
   * Close the menu and restore focus
   */
  const closeMenu = useCallback(() => {
    setIsOpen(false);

    // Announce closure to screen readers
    const announcement = document.createElement("div");
    announcement.setAttribute("aria-live", "polite");
    announcement.setAttribute("aria-atomic", "true");
    announcement.className = "sr-only";
    announcement.textContent = tA11y("menuClosed");
    document.body.appendChild(announcement);

    // Restore focus to trigger button after closing
    setTimeout(() => {
      triggerRef.current?.focus();
      document.body.removeChild(announcement);
    }, 100);
  }, [tA11y]);

  /**
   * Handle navigation link click (close menu)
   */
  const handleNavClick = () => {
    closeMenu();
  };

  /**
   * Handle open change from Sheet component
   */
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // Restore focus when closing
      setTimeout(() => {
        triggerRef.current?.focus();
      }, 100);
    }
  };

  /**
   * Auto-focus first focusable element when opening
   */
  useEffect(() => {
    if (isOpen && contentRef.current) {
      const firstFocusable = contentRef.current.querySelector(
        'a[href], button:not([disabled]), textarea:not([disabled]), input[type="text"]:not([disabled]), input[type="radio"]:not([disabled]), input[type="checkbox"]:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])'
      ) as HTMLElement;

      setTimeout(() => {
        firstFocusable?.focus();
      }, 100);
    }
  }, [isOpen]);

  return (
    <div
      className={cn("md:hidden", className)}
      role="group"
      aria-label="Mobile navigation"
    >
      <Sheet open={isOpen} onOpenChange={handleOpenChange}>
        <SheetTrigger asChild>
          <Button
            ref={triggerRef}
            variant="ghost"
            size="icon"
            className="relative h-9 w-9 p-0 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background transition-all duration-200"
            onClick={toggleMenu}
            aria-label={isOpen ? tMobile("closeMenu") : tMobile("openMenu")}
            aria-expanded={isOpen}
            aria-controls="mobile-menu"
            aria-describedby="mobile-menu-trigger-description"
            title={`${
              isOpen ? tMobile("closeMenu") : tMobile("openMenu")
            } - Alt+M`}
          >
            {isOpen ? (
              <X className="h-5 w-5" aria-hidden="true" role="presentation" />
            ) : (
              <Menu
                className="h-5 w-5"
                aria-hidden="true"
                role="presentation"
              />
            )}
            <span className="sr-only">
              {isOpen ? tMobile("closeMenu") : tMobile("openMenu")} - Press
              Alt+M to toggle
            </span>
          </Button>
        </SheetTrigger>

        {/* Mobile menu trigger description for screen readers */}
        <div id="mobile-menu-trigger-description" className="sr-only">
          Mobile navigation menu toggle. Press Alt+M to open or close menu, or
          use Tab to navigate. Menu contains navigation links and user controls.
        </div>

        <SheetContent
          ref={contentRef}
          side="right"
          className="w-[300px] sm:w-[350px] px-0 pb-0 overflow-y-auto focus:outline-none"
          id="mobile-menu"
          role="navigation"
          aria-label="Mobile navigation menu"
          aria-describedby="mobile-menu-description"
          onOpenAutoFocus={(event) => {
            // Prevent default auto focus, we'll handle it manually
            event.preventDefault();
          }}
        >
          {/* Mobile menu description for screen readers */}
          <div id="mobile-menu-description" className="sr-only">
            Mobile navigation menu containing DietaiBest logo,{" "}
            {isAuthenticated ? "user account information, " : ""}main navigation
            links{isAuthenticated ? ", " : " and "}authentication controls
            {isAuthenticated ? ", " : " "}and language settings. Use Tab to
            navigate, Enter to select, Escape to close.
          </div>

          <SheetHeader className="px-4 pb-4">
            <SheetTitle className="text-left">
              <div
                className="flex items-center space-x-2"
                role="img"
                aria-label="DietaiBest mobile menu header"
              >
                <div
                  className="w-6 h-6 bg-primary rounded-md flex items-center justify-center"
                  role="img"
                  aria-label="DietaiBest logo"
                >
                  <span
                    className="text-primary-foreground font-bold text-xs"
                    aria-hidden="true"
                  >
                    D
                  </span>
                </div>
                <span className="font-bold text-lg">DietaiBest</span>
              </div>
            </SheetTitle>
          </SheetHeader>

          <div className="flex flex-col h-full">
            {/* User Section for Authenticated Users */}
            {isAuthenticated && user && (
              <>
                <div
                  className="px-4 py-3"
                  role="region"
                  aria-label="User account information"
                  aria-describedby="user-section-description"
                >
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      <UserDropdown />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {user.name || "User"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {user.email}
                      </p>
                    </div>
                  </div>
                </div>

                {/* User section description for screen readers */}
                <div id="user-section-description" className="sr-only">
                  Currently signed in as {user.name || "User"}, email{" "}
                  {user.email}. User menu and profile options available.
                </div>

                <Separator role="separator" aria-orientation="horizontal" />
              </>
            )}

            {/* Main Navigation */}
            <div
              className="flex-1 px-4 py-4"
              onClick={handleNavClick}
              role="region"
              aria-label="Main navigation links"
              aria-describedby="nav-section-description"
            >
              <nav aria-label={tA11y("mainNavigation")}>
                <MainNavCompact />
              </nav>
            </div>

            {/* Navigation section description for screen readers */}
            <div id="nav-section-description" className="sr-only">
              Main navigation menu with links to Dashboard, Recipes, Meal Plans,
              and Shopping. Clicking any link will close the mobile menu.
            </div>

            {/* Authentication Section for Unauthenticated Users */}
            {!isAuthenticated && (
              <>
                <Separator role="separator" aria-orientation="horizontal" />
                <div
                  className="px-4 py-4 space-y-3"
                  role="region"
                  aria-label="Authentication options"
                  aria-describedby="auth-section-description"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all duration-200"
                      onClick={handleNavClick}
                      asChild
                      aria-describedby="signin-button-description"
                    >
                      <Link href="/sign-in">{tAuth("signIn")}</Link>
                    </Button>
                    <Button
                      size="sm"
                      className="w-full focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 transition-all duration-200"
                      onClick={handleNavClick}
                      asChild
                      aria-describedby="signup-button-description"
                    >
                      <Link href="/sign-up">{tAuth("signUp")}</Link>
                    </Button>
                  </div>
                </div>

                {/* Authentication section descriptions for screen readers */}
                <div id="auth-section-description" className="sr-only">
                  Sign in or create a new account to access personalized
                  features. Both buttons will close the mobile menu and navigate
                  to the respective pages.
                </div>
                <div id="signin-button-description" className="sr-only">
                  Navigate to sign in page for existing users
                </div>
                <div id="signup-button-description" className="sr-only">
                  Navigate to sign up page to create a new account
                </div>
              </>
            )}

            {/* Footer Section */}
            <div
              className="mt-auto border-t bg-muted/50"
              role="region"
              aria-label="Settings and preferences"
              aria-describedby="footer-section-description"
            >
              <div className="px-4 py-4">
                <div className="flex items-center justify-between">
                  <span
                    className="text-sm text-muted-foreground"
                    id="language-label"
                  >
                    {tMobile("language")}
                  </span>
                  <div aria-labelledby="language-label">
                    <LanguageSwitcherCompact />
                  </div>
                </div>
              </div>
            </div>

            {/* Footer section description for screen readers */}
            <div id="footer-section-description" className="sr-only">
              Application settings including language selection. Currently
              supports English, Spanish, and Polish.
            </div>
          </div>

          {/* Close button for screen readers */}
          <Button
            variant="ghost"
            size="sm"
            className="sr-only focus:not-sr-only absolute top-4 right-4"
            onClick={closeMenu}
            aria-label="Close mobile menu"
            aria-describedby="close-button-description"
          >
            Close
          </Button>

          {/* Close button description for screen readers */}
          <div id="close-button-description" className="sr-only">
            Alternative way to close the mobile menu. You can also press Escape
            key to close.
          </div>

          {/* Keyboard shortcuts help */}
          <div
            className="sr-only"
            aria-live="polite"
            aria-atomic="true"
            role="status"
            id="mobile-menu-help"
          >
            Mobile menu open. Press Escape to close, Tab to navigate, Alt+M to
            toggle. {tA11y("focusTrapped")}
          </div>

          {/* Status announcements for screen readers */}
          <div
            id="mobile-menu-announcements"
            className="sr-only"
            aria-live="polite"
            aria-atomic="true"
            role="status"
          >
            {/* Dynamic mobile menu announcements will be inserted here */}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/**
 * Hamburger menu icon component
 * Separated for potential reuse and better organization
 */
export function HamburgerIcon({
  isOpen,
  className,
}: {
  isOpen?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn("relative h-5 w-5", className)}
      role="img"
      aria-label={isOpen ? "Close menu icon" : "Hamburger menu icon"}
    >
      <span className="sr-only">{isOpen ? "Close menu" : "Open menu"}</span>
      {isOpen ? (
        <X className="h-5 w-5" aria-hidden="true" role="presentation" />
      ) : (
        <Menu className="h-5 w-5" aria-hidden="true" role="presentation" />
      )}
    </div>
  );
}

/**
 * Export the MobileMenu component and related utilities
 */
export default MobileMenu;
