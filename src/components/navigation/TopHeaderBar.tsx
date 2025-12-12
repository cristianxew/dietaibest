"use client";

import Link from "next/link";
import { User, Settings, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";
import { ThemeToggleSimple } from "@/components/ui/ThemeToggle";
import { LanguageSwitcherCompact } from "@/components/LanguageSwitcher";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

/**
 * TopHeaderBar - Floating glassmorphic control bar
 *
 * A fixed-position header bar in the top-right corner containing:
 * - Theme toggle
 * - Language switcher
 * - User profile dropdown
 *
 * Design: "Editorial Floating Controls" following the Culinary Elegance system
 */
export function TopHeaderBar() {
  const { user, isAuthenticated, signOut } = useAuth();

  return (
    <div
      className={cn(
        // Fixed positioning
        "fixed top-4 right-4 z-40",
        // Flex layout
        "flex items-center gap-1 px-2 py-1.5",
        // Glassmorphic background
        "bg-card/80 backdrop-blur-xl",
        // Border and shape
        "border border-border/50 rounded-full",
        // Shadow
        "shadow-lg shadow-black/5",
        // Animation
        "animate-in fade-in slide-in-from-top-2 duration-500"
      )}
    >
      {/* Theme Toggle */}
      <ThemeToggleSimple size="sm" />

      {/* Divider */}
      <div className="h-4 w-px bg-border/50 mx-0.5" />

      {/* Language Switcher */}
      <LanguageSwitcherCompact />

      {/* User Menu - Only show if authenticated */}
      {isAuthenticated && user && (
        <>
          {/* Divider */}
          <div className="h-4 w-px bg-border/50 mx-0.5" />

          {/* User Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "relative rounded-full p-0.5",
                  "ring-2 ring-transparent",
                  "hover:ring-brand-300 dark:hover:ring-brand-700",
                  "focus:outline-none focus:ring-brand-400 dark:focus:ring-brand-600",
                  "transition-all duration-200"
                )}
                aria-label="User menu"
              >
                <Avatar className="size-7 ring-1 ring-border/50">
                  <AvatarImage
                    src={user.image || undefined}
                    alt={user.name || "User"}
                  />
                  <AvatarFallback
                    className={cn(
                      "bg-gradient-to-br from-brand-100 to-brand-200",
                      "text-brand-700 text-xs font-medium",
                      "dark:from-brand-900 dark:to-brand-800 dark:text-brand-300"
                    )}
                  >
                    {user.name?.[0]?.toUpperCase() || (
                      <User className="size-3.5" />
                    )}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              sideOffset={8}
              className={cn(
                "w-56 rounded-xl",
                "bg-card/95 backdrop-blur-xl",
                "border border-border/50",
                "shadow-xl shadow-black/10"
              )}
            >
              {/* User Info Header */}
              <div className="px-3 py-3 border-b border-border/50">
                <div className="flex items-center gap-3">
                  <Avatar className="size-10 ring-2 ring-brand-100 dark:ring-brand-900">
                    <AvatarImage
                      src={user.image || undefined}
                      alt={user.name || "User"}
                    />
                    <AvatarFallback className="bg-gradient-to-br from-brand-100 to-brand-200 text-brand-700 dark:from-brand-900 dark:to-brand-800 dark:text-brand-300 font-medium">
                      {user.name?.[0]?.toUpperCase() || (
                        <User className="size-4" />
                      )}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user.email}
                    </p>
                  </div>
                </div>
              </div>

              {/* Menu Items */}
              <div className="p-1.5">
                <DropdownMenuItem asChild>
                  <Link
                    href="/profile"
                    className={cn(
                      "flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer",
                      "hover:bg-brand-50 dark:hover:bg-brand-950/30",
                      "transition-colors duration-150"
                    )}
                  >
                    <User className="size-4 text-muted-foreground" />
                    <span>Profile</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link
                    href="/settings"
                    className={cn(
                      "flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer",
                      "hover:bg-brand-50 dark:hover:bg-brand-950/30",
                      "transition-colors duration-150"
                    )}
                  >
                    <Settings className="size-4 text-muted-foreground" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
              </div>

              <DropdownMenuSeparator className="bg-border/50" />

              {/* Sign Out */}
              <div className="p-1.5">
                <DropdownMenuItem
                  onClick={() => signOut()}
                  className={cn(
                    "flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer",
                    "text-destructive hover:text-destructive",
                    "hover:bg-destructive/10",
                    "transition-colors duration-150"
                  )}
                >
                  <LogOut className="size-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}
    </div>
  );
}
