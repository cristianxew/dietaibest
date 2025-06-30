"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { User, Settings, LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/providers/AuthProvider";
import {
  useKeyboardNavigation,
  KEYBOARD_SHORTCUTS,
  A11Y_HELPERS,
} from "@/hooks/use-keyboard-navigation";
import { toast } from "sonner";

/**
 * UserDropdown component for authenticated users
 * Provides access to profile, settings, and sign out functionality
 * with enhanced keyboard navigation and focus management
 */
export function UserDropdown() {
  const t = useTranslations("navigation.userMenu");
  const tA11y = useTranslations("navigation.accessibility");
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  /**
   * Close dropdown and restore focus
   */
  const closeDropdown = () => {
    setIsOpen(false);
    // Announce closure to screen readers
    const announcement = document.createElement("div");
    announcement.setAttribute("aria-live", "polite");
    announcement.setAttribute("aria-atomic", "true");
    announcement.className = "sr-only";
    announcement.textContent = tA11y("menuClosed");
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 1000);
  };

  /**
   * Toggle dropdown
   */
  const toggleDropdown = () => {
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
   * Use keyboard navigation hook for dropdown behavior
   */
  const { restoreFocus } = useKeyboardNavigation({
    isOpen,
    onClose: closeDropdown,
    enableFocusTrapping: true,
    containerRef: contentRef,
    triggerRef,
    shortcuts: {
      [KEYBOARD_SHORTCUTS.TOGGLE_USER_MENU]: toggleDropdown,
    },
  });

  // Don't render if no user
  if (!user) {
    return null;
  }

  /**
   * Get user initials for avatar fallback
   */
  const getUserInitials = () => {
    if (user.name) {
      return user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    if (user.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return "U";
  };

  /**
   * Handle navigation to profile page
   */
  const handleViewProfile = () => {
    setIsOpen(false);
    router.push("/profile");
    // Announce navigation to screen readers
    const announcement = document.createElement("div");
    announcement.setAttribute("aria-live", "polite");
    announcement.setAttribute("aria-atomic", "true");
    announcement.className = "sr-only";
    announcement.textContent = tA11y("navigatingTo", { page: "profile page" });
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 1000);
  };

  /**
   * Handle navigation to settings page
   */
  const handleSettings = () => {
    setIsOpen(false);
    router.push("/settings");
    // Announce navigation to screen readers
    const announcement = document.createElement("div");
    announcement.setAttribute("aria-live", "polite");
    announcement.setAttribute("aria-atomic", "true");
    announcement.className = "sr-only";
    announcement.textContent = tA11y("navigatingTo", {
      page: "account settings",
    });
    document.body.appendChild(announcement);
    setTimeout(() => document.body.removeChild(announcement), 1000);
  };

  /**
   * Handle sign out with user feedback
   */
  const handleSignOut = async () => {
    try {
      setIsOpen(false);
      // Announce sign out attempt to screen readers
      const announcement = document.createElement("div");
      announcement.setAttribute("aria-live", "polite");
      announcement.setAttribute("aria-atomic", "true");
      announcement.className = "sr-only";
      announcement.textContent = "Signing out...";
      document.body.appendChild(announcement);

      await signOut();
      toast.success(t("signOut"));

      // Update announcement for successful sign out
      announcement.textContent = "Successfully signed out";
      setTimeout(() => document.body.removeChild(announcement), 2000);
    } catch (error) {
      console.error("Sign out error:", error);
      toast.error("Error signing out. Please try again.");

      // Announce error to screen readers
      const errorAnnouncement = document.createElement("div");
      errorAnnouncement.setAttribute("aria-live", "assertive");
      errorAnnouncement.setAttribute("aria-atomic", "true");
      errorAnnouncement.className = "sr-only";
      errorAnnouncement.textContent = "Error signing out. Please try again.";
      document.body.appendChild(errorAnnouncement);
      setTimeout(() => document.body.removeChild(errorAnnouncement), 2000);
    }
  };

  /**
   * Handle dropdown open change
   */
  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      restoreFocus();
    }
  };

  const dropdownTriggerProps = A11Y_HELPERS.getDropdownTriggerProps(
    isOpen,
    "user-menu"
  );
  const menuProps = A11Y_HELPERS.getMenuProps("user-menu");

  return (
    <div role="group" aria-label="User account controls">
      <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
        <DropdownMenuTrigger asChild>
          <button
            ref={triggerRef}
            className="relative flex items-center gap-2 rounded-full p-1 hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background transition-all duration-200"
            aria-label={`${t("myAccount")} - ${user.name || user.email} (${
              KEYBOARD_SHORTCUTS.TOGGLE_USER_MENU
            })`}
            aria-describedby="user-dropdown-description"
            title={`${t("myAccount")} - ${
              KEYBOARD_SHORTCUTS.TOGGLE_USER_MENU
            } to toggle`}
            {...dropdownTriggerProps}
          >
            <Avatar
              className="h-8 w-8"
              role="img"
              aria-describedby="avatar-description"
            >
              <AvatarImage
                src={user.image || undefined}
                alt={user.name || "User avatar"}
              />
              <AvatarFallback
                className="text-sm font-medium"
                aria-label={`${user.name || "User"} initials`}
              >
                {getUserInitials()}
              </AvatarFallback>
            </Avatar>
            <span className="sr-only">
              {t("myAccount")} - Press {KEYBOARD_SHORTCUTS.TOGGLE_USER_MENU} to
              toggle menu
            </span>
          </button>
        </DropdownMenuTrigger>

        {/* User dropdown description for screen readers */}
        <div id="user-dropdown-description" className="sr-only">
          User account menu for {user.name || user.email}. Contains profile,
          settings, and sign out options. Press{" "}
          {KEYBOARD_SHORTCUTS.TOGGLE_USER_MENU} to toggle or Escape to close.
        </div>

        {/* Avatar description for screen readers */}
        <div id="avatar-description" className="sr-only">
          Profile picture for {user.name || user.email}
        </div>

        <DropdownMenuContent
          ref={contentRef}
          className="w-56 focus:outline-none"
          align="end"
          forceMount
          {...menuProps}
          aria-describedby="user-menu-description"
          onCloseAutoFocus={(event) => {
            // Let the hook handle focus restoration
            event.preventDefault();
          }}
        >
          {/* Menu description for screen readers */}
          <div id="user-menu-description" className="sr-only">
            User account menu with 3 options: View Profile, Account Settings,
            and Sign Out. Use Tab to navigate, Enter to select, Escape to close.
          </div>

          <DropdownMenuLabel
            className="font-normal"
            role="heading"
            aria-level={2}
            aria-describedby="user-info-description"
          >
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">
                {user.name || "User"}
              </p>
              <p className="text-xs leading-none text-muted-foreground">
                {user.email}
              </p>
            </div>
          </DropdownMenuLabel>

          {/* User info description for screen readers */}
          <div id="user-info-description" className="sr-only">
            Currently signed in as {user.name || "User"}, email address{" "}
            {user.email}
          </div>

          <DropdownMenuSeparator
            role="separator"
            aria-orientation="horizontal"
          />

          <DropdownMenuItem
            onClick={handleViewProfile}
            className="cursor-pointer focus:bg-accent focus:text-accent-foreground transition-colors duration-200"
            onSelect={(event) => {
              event.preventDefault();
              handleViewProfile();
            }}
            {...A11Y_HELPERS.getMenuItemProps()}
            aria-describedby="profile-item-description"
          >
            <User
              className="mr-2 h-4 w-4"
              aria-hidden="true"
              role="presentation"
            />
            <span>{t("viewProfile")}</span>
          </DropdownMenuItem>

          {/* Profile item description for screen readers */}
          <div id="profile-item-description" className="sr-only">
            Navigate to your profile page to view and edit personal information
          </div>

          <DropdownMenuItem
            onClick={handleSettings}
            className="cursor-pointer focus:bg-accent focus:text-accent-foreground transition-colors duration-200"
            onSelect={(event) => {
              event.preventDefault();
              handleSettings();
            }}
            {...A11Y_HELPERS.getMenuItemProps()}
            aria-describedby="settings-item-description"
          >
            <Settings
              className="mr-2 h-4 w-4"
              aria-hidden="true"
              role="presentation"
            />
            <span>{t("accountSettings")}</span>
          </DropdownMenuItem>

          {/* Settings item description for screen readers */}
          <div id="settings-item-description" className="sr-only">
            Navigate to account settings to manage preferences and configuration
          </div>

          <DropdownMenuSeparator
            role="separator"
            aria-orientation="horizontal"
          />

          <DropdownMenuItem
            onClick={handleSignOut}
            className="cursor-pointer focus:bg-destructive/10 focus:text-destructive transition-colors duration-200"
            onSelect={(event) => {
              event.preventDefault();
              handleSignOut();
            }}
            {...A11Y_HELPERS.getMenuItemProps()}
            aria-describedby="signout-item-description"
          >
            <LogOut
              className="mr-2 h-4 w-4"
              aria-hidden="true"
              role="presentation"
            />
            <span>{t("signOut")}</span>
          </DropdownMenuItem>

          {/* Sign out item description for screen readers */}
          <div id="signout-item-description" className="sr-only">
            Sign out of your account and return to the login page
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Status announcements for screen readers */}
      <div
        id="user-dropdown-announcements"
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
        role="status"
      >
        {/* Dynamic user action announcements will be inserted here */}
      </div>
    </div>
  );
}
