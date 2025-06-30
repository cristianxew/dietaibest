"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { UserDropdown } from "@/components/navigation/UserDropdown";
import { useAuth } from "@/providers/AuthProvider";
import { cn } from "@/lib/utils";
import {
  useKeyboardNavigation,
  KEYBOARD_SHORTCUTS,
} from "@/hooks/use-keyboard-navigation";

/**
 * Props interface for the AuthControls component
 */
interface AuthControlsProps {
  /**
   * Optional CSS class name for styling customization
   */
  className?: string;
  /**
   * Whether to show compact version for smaller spaces
   */
  compact?: boolean;
  /**
   * Layout variant for different screen sizes
   */
  variant?: "desktop" | "tablet" | "mobile";
}

/**
 * Authentication controls component
 *
 * This component handles the display and interaction of authentication-related
 * controls, including sign in/up buttons for unauthenticated users and the
 * user dropdown for authenticated users. It provides comprehensive keyboard
 * navigation support and adapts to different layout contexts.
 *
 * @param props - AuthControls component props
 * @returns JSX.Element - The rendered authentication controls
 */
export function AuthControls({
  className,
  compact = false,
  variant = "desktop",
}: AuthControlsProps) {
  const t = useTranslations("auth");
  const tA11y = useTranslations("navigation.accessibility");
  const { isAuthenticated, user, isLoading } = useAuth();

  /**
   * Use keyboard navigation hook for auth-specific shortcuts
   */
  useKeyboardNavigation({
    shortcuts: {
      "Alt+s": () => {
        if (!isAuthenticated) {
          window.location.href = "/sign-in";
        }
      },
      "Alt+r": () => {
        if (!isAuthenticated) {
          window.location.href = "/sign-up";
        }
      },
    },
  });

  /**
   * Show loading state while auth status is being determined
   */
  if (isLoading) {
    return (
      <div
        className={cn(
          "flex items-center space-x-2",
          compact && "space-x-1",
          className
        )}
        role="status"
        aria-label={tA11y("loadingAuthControls")}
        aria-describedby="auth-loading-description"
      >
        <div
          className={cn(
            "h-8 w-16 bg-muted rounded animate-pulse",
            compact && "h-6 w-12"
          )}
          aria-hidden="true"
        />
        <div
          className={cn(
            "h-8 w-16 bg-muted rounded animate-pulse",
            compact && "h-6 w-12"
          )}
          aria-hidden="true"
        />
        <span className="sr-only">{tA11y("loadingAuthControls")}</span>
      </div>
    );
  }

  /**
   * Render authenticated user controls
   */
  if (isAuthenticated && user) {
    return (
      <div
        className={cn("flex items-center", className)}
        role="group"
        aria-label={`${tA11y("authenticatedUser")} - ${
          user.name || user.email
        }`}
        aria-describedby="authenticated-controls-description"
      >
        <UserDropdown />
      </div>
    );
  }

  /**
   * Render unauthenticated user controls
   */
  return (
    <div
      className={cn(
        "flex items-center space-x-2 sm:space-x-3",
        compact && "space-x-1",
        className
      )}
      role="group"
      aria-label={tA11y("authenticationOptions")}
      aria-describedby="unauthenticated-controls-description"
    >
      {/* Sign In Button */}
      <Button
        variant="ghost"
        size={compact ? "sm" : "default"}
        className={cn(
          "font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background",
          compact && "px-2 text-sm",
          variant === "tablet" && "px-3 text-sm"
        )}
        asChild
        aria-describedby="signin-desktop-description"
      >
        <Link href="/sign-in" tabIndex={0}>
          {t("signIn")}
        </Link>
      </Button>

      {/* Sign Up Button */}
      <Button
        size={compact ? "sm" : "default"}
        className={cn(
          "font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background",
          compact && "px-2 text-sm",
          variant === "tablet" && "px-3 text-sm"
        )}
        asChild
        aria-describedby="signup-desktop-description"
      >
        <Link href="/sign-up" tabIndex={0}>
          {t("signUp")}
        </Link>
      </Button>

      {/* Authentication loading description for screen readers */}
      <div id="auth-loading-description" className="sr-only">
        Authentication status is loading. Please wait while we verify your login
        status.
      </div>

      {/* Authenticated controls description for screen readers */}
      <div id="authenticated-controls-description" className="sr-only">
        You are signed in as {user?.name || user?.email}. User menu contains
        profile, settings, and sign out options. Press{" "}
        {KEYBOARD_SHORTCUTS.TOGGLE_USER_MENU} to open user menu.
      </div>

      {/* Unauthenticated controls description for screen readers */}
      <div id="unauthenticated-controls-description" className="sr-only">
        Sign in to access your account or sign up to create a new account. Press
        Alt+S for sign in, Alt+R for sign up, or use Tab to navigate buttons.
      </div>

      {/* Individual button descriptions for screen readers */}
      <div id="signin-desktop-description" className="sr-only">
        Navigate to sign in page for existing users. Keyboard shortcut: Alt+S.{" "}
        {variant === "desktop"
          ? "Full width button for desktop layout."
          : variant === "tablet"
          ? "Medium size button for tablet layout."
          : "Compact button for mobile layout."}
      </div>

      <div id="signup-desktop-description" className="sr-only">
        Navigate to sign up page to create a new account. Keyboard shortcut:
        Alt+R.{" "}
        {variant === "desktop"
          ? "Primary button styling for desktop layout."
          : variant === "tablet"
          ? "Medium size button for tablet layout."
          : "Compact button for mobile layout."}
      </div>

      {/* Keyboard shortcuts help (screen reader only) */}
      <div
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
        role="status"
        id="auth-shortcuts-help"
      >
        Authentication shortcuts available: Alt+S for sign in, Alt+R for sign up
      </div>

      {/* Status announcements for screen readers */}
      <div
        id="auth-status-announcements"
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
        role="status"
      >
        {/* Dynamic authentication status announcements will be inserted here */}
      </div>
    </div>
  );
}

/**
 * Compact version of AuthControls for constrained spaces
 */
export function AuthControlsCompact({
  className,
  ...props
}: Omit<AuthControlsProps, "compact">) {
  return (
    <AuthControls
      className={className}
      compact={true}
      variant="mobile"
      {...props}
    />
  );
}

/**
 * Export the AuthControls component and its variants
 */
export default AuthControls;
