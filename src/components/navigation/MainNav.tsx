"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useMemo } from "react";
import {
  Home,
  BookOpen,
  Calendar,
  Calculator,
  ShoppingCart,
  User,
  Settings,
} from "lucide-react";

import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuLink,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";
import type { NavigationItem, NavigationBaseProps } from "@/types/navigation";

/**
 * Props interface for the MainNav component
 */
interface MainNavProps extends NavigationBaseProps {
  /**
   * Whether to show icons alongside text labels
   */
  showIcons?: boolean;
  /**
   * Layout orientation for the navigation
   */
  orientation?: "horizontal" | "vertical";
}

/**
 * Main navigation component for primary app navigation
 *
 * This component provides the primary navigation interface with proper routing,
 * active state detection, internationalization support, and comprehensive keyboard navigation.
 * Supports keyboard shortcuts (Alt+1-4 for quick navigation) and proper focus management.
 *
 * @param props - MainNav component props
 * @returns JSX.Element - The rendered main navigation component
 */
export function MainNav({
  className,
  currentPath,
  showIcons = false,
  orientation = "horizontal",
}: MainNavProps) {
  const pathname = usePathname();
  const t = useTranslations("navigation");
  const tA11y = useTranslations("navigation.accessibility");
  const { isAuthenticated } = useAuth();
  const navRef = useRef<HTMLElement>(null);

  // Use provided currentPath or fallback to usePathname hook
  const activePath = currentPath || pathname;

  /**
   * All navigation items configuration
   * Uses translation keys for labels and proper routing paths
   */
  const allNavigationItems: NavigationItem[] = useMemo(
    () => [
      {
        id: "dashboard",
        label: t("dashboard"),
        href: "/dashboard",
        icon: "Home",
        requiresAuth: true,
        shortcut: "Alt+1",
      },
      {
        id: "recipes",
        label: t("recipes"),
        href: "/recipes",
        icon: "BookOpen",
        requiresAuth: true,
        shortcut: "Alt+2",
      },
      {
        id: "meal-plans",
        label: t("mealPlans"),
        href: "/meal-plans",
        icon: "Calendar",
        requiresAuth: true,
        shortcut: "Alt+3",
      },
      // {
      //   id: "nutrition",
      //   label: t("nutrition"),
      //   href: "/nutrition",
      //   icon: "Calculator",
      //   requiresAuth: true,
      //   shortcut: "Alt+4",
      // },
      {
        id: "shopping",
        label: t("shopping"),
        href: "/shopping",
        icon: "ShoppingCart",
        requiresAuth: true,
        shortcut: "Alt+5",
      },
    ],
    [t]
  );

  /**
   * Filter navigation items based on authentication status
   * Only show items that don't require auth, or require auth when user is authenticated
   */
  const navigationItems: NavigationItem[] = useMemo(
    () =>
      allNavigationItems.filter(
        (item) => !item.requiresAuth || isAuthenticated
      ),
    [allNavigationItems, isAuthenticated]
  );

  /**
   * Handle keyboard shortcuts for quick navigation
   * Only works for available (visible) navigation items
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.altKey) return;

      const shortcutMap: { [key: string]: string } = {
        "1": "/dashboard",
        "2": "/recipes",
        "3": "/meal-plans",
        "4": "/nutrition",
        "5": "/shopping",
      };

      const targetPath = shortcutMap[event.key];
      if (targetPath) {
        // Only allow navigation if the item is visible (user has access)
        const targetItem = navigationItems.find(
          (item) => item.href === targetPath
        );

        if (targetItem) {
          event.preventDefault();
          // Navigate to the target path
          window.location.href = targetPath;

          // Announce navigation to screen readers
          const announcement = document.createElement("div");
          announcement.setAttribute("aria-live", "polite");
          announcement.setAttribute("aria-atomic", "true");
          announcement.className = "sr-only";
          announcement.textContent = tA11y("navigatingTo", {
            page: targetItem.label,
          });
          document.body.appendChild(announcement);
          setTimeout(() => document.body.removeChild(announcement), 1000);
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [navigationItems, tA11y]);

  /**
   * Get icon component by name
   */
  const getIconComponent = (iconName: string) => {
    const iconMap = {
      Home,
      BookOpen,
      Calendar,
      Calculator,
      ShoppingCart,
      User,
      Settings,
    };
    return iconMap[iconName as keyof typeof iconMap];
  };

  /**
   * Check if a navigation item is currently active
   */
  const isActiveItem = (item: NavigationItem): boolean => {
    // Extract locale from pathname if present
    const pathSegments = activePath.split("/").filter(Boolean);
    const hasLocale = pathSegments[0] && pathSegments[0].length === 2;
    const cleanPath = hasLocale
      ? `/${pathSegments.slice(1).join("/")}`
      : activePath;

    // Exact match for root paths
    if (
      item.href === "/dashboard" &&
      (cleanPath === "/" || cleanPath === "/dashboard")
    ) {
      return true;
    }

    // Prefix match for other paths
    return cleanPath.startsWith(item.href) && item.href !== "/";
  };

  return (
    <NavigationMenu
      ref={navRef}
      className={cn(
        orientation === "vertical" && "flex-col items-start",
        className
      )}
      orientation={orientation}
      role="navigation"
      aria-label={tA11y("mainNavigation")}
      aria-describedby="main-nav-description"
    >
      {/* Navigation description for screen readers */}
      <div id="main-nav-description" className="sr-only">
        {tA11y("mainNavigationDescription")}
      </div>

      <NavigationMenuList
        className={cn(
          "gap-2",
          orientation === "vertical" &&
          "flex-col items-start space-x-0 space-y-1"
        )}
        role="menubar"
        aria-orientation={orientation}
      >
        {navigationItems.map((item, index) => {
          const IconComponent = item.icon ? getIconComponent(item.icon) : null;
          const isActive = isActiveItem(item);

          return (
            <NavigationMenuItem key={item.id} role="none">
              <NavigationMenuLink
                asChild
                className={cn(
                  navigationMenuTriggerStyle(),
                  "gap-2 font-medium transition-all duration-200 relative",
                  // Enhanced focus styles for better keyboard navigation
                  "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                  isActive && [
                    "bg-accent text-accent-foreground",
                    "data-[active=true]:bg-accent data-[active=true]:text-accent-foreground",
                    // Active state focus enhancement
                    "focus:bg-accent/80 focus:text-accent-foreground",
                  ],
                  !isActive && [
                    "text-muted-foreground hover:text-foreground",
                    "hover:bg-accent hover:text-accent-foreground",
                    // Enhanced hover states for better feedback
                    "hover:scale-105 hover:shadow-sm",
                  ],
                  item.disabled && "pointer-events-none opacity-50",
                  orientation === "vertical" && "w-full justify-start"
                )}
                data-active={isActive}
                aria-current={isActive ? "page" : undefined}
                aria-label={`Navigate to ${item.label}${item.shortcut ? ` (${item.shortcut})` : ""
                  }${isActive ? ` - ${tA11y("currentPage")}` : ""}`}
                aria-describedby={`nav-item-${item.id}-description`}
                title={`${item.label}${item.shortcut ? ` - ${item.shortcut}` : ""
                  }${isActive ? ` (${tA11y("currentPage")})` : ""}`}
                tabIndex={0}
              >
                <Link
                  href={item.href}
                  role="menuitem"
                  aria-posinset={index + 1}
                  aria-setsize={navigationItems.length}
                  aria-label={`${item.label}${isActive ? ` (${tA11y("currentPage").toLowerCase()})` : ""
                    }`}
                >
                  {showIcons && IconComponent && (
                    <IconComponent
                      className="h-4 w-4"
                      aria-hidden="true"
                      role="presentation"
                    />
                  )}
                  <span>{item.label}</span>
                  {item.badge && (
                    <span
                      className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground"
                      aria-label={`${item.badge} items`}
                      role="status"
                    >
                      {item.badge}
                    </span>
                  )}
                  {/* Keyboard shortcut indicator (visually hidden by default) */}
                  {item.shortcut && (
                    <span className="sr-only">
                      Keyboard shortcut: {item.shortcut}
                    </span>
                  )}
                  {/* Active indicator for screen readers */}
                  {isActive && (
                    <span className="sr-only">({tA11y("currentPage")})</span>
                  )}
                </Link>
              </NavigationMenuLink>

              {/* Individual navigation item description for screen readers */}
              <div id={`nav-item-${item.id}-description`} className="sr-only">
                {item.shortcut && `Keyboard shortcut: ${item.shortcut}. `}
                {item.requiresAuth ? "Requires authentication. " : ""}
                {isActive ? `${tA11y("currentPage")}. ` : ""}
                Navigate to {item.label} section.
              </div>
            </NavigationMenuItem>
          );
        })}
      </NavigationMenuList>

      {/* Keyboard shortcuts help (screen reader only) */}
      <div
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
        role="status"
        id="nav-shortcuts-status"
      >
        {navigationItems.length > 0
          ? `Navigation shortcuts: ${navigationItems
            .filter((item) => item.shortcut)
            .map((item) => `${item.shortcut} for ${item.label}`)
            .join(", ")}`
          : "No navigation shortcuts available"}
      </div>

      {/* Navigation status announcements */}
      <div
        id="nav-status-announcements"
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
        role="status"
      >
        {/* Dynamic navigation announcements will be inserted here */}
      </div>
    </NavigationMenu>
  );
}

/**
 * Compact version of MainNav for mobile or constrained spaces
 */
export function MainNavCompact({
  className,
  currentPath,
  ...props
}: Omit<MainNavProps, "showIcons" | "orientation">) {
  return (
    <MainNav
      className={className}
      currentPath={currentPath}
      showIcons={true}
      orientation="vertical"
      {...props}
    />
  );
}

/**
 * Export the MainNav component and its variants
 */
export default MainNav;
