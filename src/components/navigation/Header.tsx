"use client";

import { Suspense, useState, useRef } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import { LanguageSwitcherCompact } from "@/components/LanguageSwitcher";
import { MainNav } from "@/components/navigation/MainNav";
import { AuthControls } from "@/components/navigation/AuthControls";
import { MobileMenu } from "@/components/navigation/MobileMenu";
import {
  useKeyboardNavigation,
  KEYBOARD_SHORTCUTS,
} from "@/hooks/use-keyboard-navigation";
import { cn } from "@/lib/utils";

/**
 * Props interface for the Header component
 */
interface HeaderProps {
  /**
   * Optional CSS class name for styling customization
   */
  className?: string;
  /**
   * Controls whether the header should be sticky on scroll
   */
  sticky?: boolean;
}

/**
 * Main application header component
 *
 * This is a client component that provides the primary navigation interface
 * for the DietAIbook application. It includes authentication-aware navigation,
 * responsive design, internationalization support, and comprehensive keyboard navigation.
 *
 * @param props - Header component props
 * @returns JSX.Element - The rendered header component
 */
export default function Header({ className, sticky = true }: HeaderProps) {
  const tA11y = useTranslations("navigation.accessibility");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const skipLinkRef = useRef<HTMLAnchorElement>(null);

  /**
   * Handle skip to main content
   */
  const handleSkipToMain = () => {
    const mainContent =
      document.getElementById("main-content") || document.querySelector("main");
    if (mainContent) {
      mainContent.focus();
      mainContent.scrollIntoView({ behavior: "smooth" });
      // Announce to screen readers
      const announcement = document.createElement("div");
      announcement.setAttribute("aria-live", "polite");
      announcement.setAttribute("aria-atomic", "true");
      announcement.className = "sr-only";
      announcement.textContent = "Skipped to main content";
      document.body.appendChild(announcement);
      setTimeout(() => document.body.removeChild(announcement), 1000);
    }
  };

  /**
   * Focus header programmatically
   */
  const focusHeader = () => {
    headerRef.current?.focus();
    // Announce to screen readers
    const announcement = document.createElement("div");
    announcement.setAttribute("aria-live", "polite");
    announcement.setAttribute("aria-atomic", "true");
    announcement.className = "sr-only";
    announcement.textContent = "Header focused";
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 1000);
  };

  /**
   * Use keyboard navigation hook for header-level shortcuts
   */
  useKeyboardNavigation({
    shortcuts: {
      [KEYBOARD_SHORTCUTS.TOGGLE_MOBILE_MENU]: () =>
        setIsMobileMenuOpen(!isMobileMenuOpen),
      [KEYBOARD_SHORTCUTS.FOCUS_HEADER]: focusHeader,
    },
  });

  return (
    <>
      {/* Skip to main content link */}
      <a
        ref={skipLinkRef}
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          handleSkipToMain();
        }}
        className="sr-only focus:not-sr-only absolute top-4 left-4 z-50 bg-primary text-primary-foreground px-4 py-2 rounded-md font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-foreground focus:ring-offset-2 focus:ring-offset-primary"
        tabIndex={1}
        aria-describedby="skip-link-description"
      >
        {tA11y("skipToMain")}
      </a>

      {/* Screen reader description for skip link */}
      <div id="skip-link-description" className="sr-only">
        {tA11y("skipToMainDescription")}
      </div>

      <header
        ref={headerRef}
        tabIndex={-1}
        className={cn(
          "w-full bg-background border-b border-border transition-all duration-200 overflow-hidden",
          sticky &&
          "sticky top-0 z-50 backdrop-blur-sm bg-background/95 supports-[backdrop-filter]:bg-background/75",
          className
        )}
        role="banner"
        aria-label="Site header"
        aria-describedby="header-description"
      >
        {/* Header description for screen readers */}
        <div id="header-description" className="sr-only">
          DietAIbook site header containing logo, main navigation, language
          switcher, and authentication controls. Press Alt+H to focus header,
          Alt+M to toggle mobile menu.
        </div>

        <div className="container mx-auto">
          <div className="flex items-center justify-between h-14 sm:h-16 w-full min-w-0">
            <div>
              <Link href="/" className="block relative w-[184px] h-[60px]">
                <Image
                  src="/Dietai_logo_dark.png"
                  alt="DietAI Logo"
                  fill
                  className="object-contain hidden dark:block"
                  priority
                />
                <Image
                  src="/Dietai_logo_light.png"
                  alt="DietAI Logo"
                  fill
                  className="object-contain dark:hidden"
                  priority
                />
              </Link>
            </div>

            {/* Main Navigation - Desktop */}
            <div className="hidden lg:flex items-center flex-1 justify-center max-w-2xl mx-4">
              <Suspense
                fallback={
                  <div
                    className="h-9 w-64 bg-muted rounded animate-pulse"
                    role="progressbar"
                    aria-label={tA11y("loadingNavigation")}
                    aria-describedby="nav-loading-description"
                  />
                }
              >
                <MainNav />
              </Suspense>
            </div>

            {/* Loading description for screen readers */}
            <div id="nav-loading-description" className="sr-only">
              {tA11y("loadingNavigation")}. Please wait.
            </div>

            {/* Right Section - Language Switcher & Authentication */}
            <div
              className="flex items-center space-x-2 sm:space-x-3 md:space-x-4 flex-shrink-0"
              role="group"
              aria-label={tA11y("userControls")}
            >
              {/* Language Switcher */}
              <div className="hidden sm:block">
                <Suspense
                  fallback={
                    <div
                      className="w-8 h-6 sm:w-10 sm:h-8 bg-muted rounded animate-pulse"
                      role="progressbar"
                      aria-label={tA11y("loadingLanguageSwitcher")}
                    />
                  }
                >
                  <LanguageSwitcherCompact />
                </Suspense>
              </div>

              {/* Authentication Controls - Desktop */}
              <div className="hidden lg:flex items-center">
                <Suspense
                  fallback={
                    <div
                      className="flex items-center space-x-2"
                      role="progressbar"
                      aria-label={tA11y("loadingAuthControls")}
                    >
                      <div className="h-8 w-16 bg-muted rounded animate-pulse" />
                      <div className="h-8 w-16 bg-muted rounded animate-pulse" />
                    </div>
                  }
                >
                  <AuthControls />
                </Suspense>
              </div>

              {/* Authentication Controls - Tablet */}
              <div className="hidden md:flex lg:hidden items-center">
                <Suspense
                  fallback={
                    <div
                      className="flex items-center space-x-1"
                      role="progressbar"
                      aria-label={tA11y("loadingAuthControls")}
                    >
                      <div className="h-7 w-12 bg-muted rounded animate-pulse" />
                      <div className="h-7 w-12 bg-muted rounded animate-pulse" />
                    </div>
                  }
                >
                  <AuthControls />
                </Suspense>
              </div>

              {/* Mobile Menu Component */}
              <div className="md:hidden">
                <MobileMenu />
              </div>
            </div>
          </div>
        </div>

        {/* Keyboard shortcuts helper (invisible, for screen readers) */}
        <div
          className="sr-only"
          aria-live="polite"
          aria-atomic="true"
          id="keyboard-shortcuts-help"
          role="status"
        >
          {tA11y("keyboardShortcuts")}
        </div>

        {/* Status announcements for screen readers */}
        <div
          id="header-announcements"
          className="sr-only"
          aria-live="polite"
          aria-atomic="true"
          role="status"
        >
          {/* Dynamic announcements will be inserted here */}
        </div>
      </header>
    </>
  );
}

/**
 * Export the Header component props interface for reuse
 */
export type { HeaderProps };
