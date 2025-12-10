"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import Image from "next/image";
import {
  Home,
  BookOpen,
  Calendar,
  Calculator,
  ShoppingCart,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  User,
} from "lucide-react";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";
import { ThemeToggleSimple } from "@/components/ui/ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  shortcut?: string;
}

interface AppSidebarProps {
  className?: string;
}

export function AppSidebar({ className }: AppSidebarProps) {
  const pathname = usePathname();
  const t = useTranslations("navigation");
  const { user, isAuthenticated, signOut } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname]);

  // Handle keyboard shortcut for collapse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "[" && e.ctrlKey) {
        e.preventDefault();
        setIsCollapsed(!isCollapsed);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCollapsed]);

  const mainNavItems: NavItem[] = [
    {
      id: "dashboard",
      label: t("dashboard"),
      href: "/dashboard",
      icon: <Home className="w-5 h-5" />,
      shortcut: "Alt+1",
    },
    {
      id: "recipes",
      label: t("recipes"),
      href: "/recipes",
      icon: <BookOpen className="w-5 h-5" />,
      shortcut: "Alt+2",
    },
    {
      id: "meal-plans",
      label: t("mealPlans"),
      href: "/meal-plans",
      icon: <Calendar className="w-5 h-5" />,
      shortcut: "Alt+3",
    },
    {
      id: "nutrition",
      label: t("nutrition"),
      href: "/nutrition",
      icon: <Calculator className="w-5 h-5" />,
      shortcut: "Alt+4",
    },
    {
      id: "shopping",
      label: t("shopping"),
      href: "/shopping",
      icon: <ShoppingCart className="w-5 h-5" />,
      shortcut: "Alt+5",
    },
  ];

  const isActiveItem = (href: string): boolean => {
    const pathSegments = pathname.split("/").filter(Boolean);
    const hasLocale = pathSegments[0] && pathSegments[0].length === 2;
    const cleanPath = hasLocale
      ? `/${pathSegments.slice(1).join("/")}`
      : pathname;

    if (href === "/dashboard" && (cleanPath === "/" || cleanPath === "/dashboard")) {
      return true;
    }
    return cleanPath.startsWith(href) && href !== "/";
  };

  const SidebarContent = () => (
    <>
      {/* Header */}
      <div className={cn(
        "flex items-center gap-3 px-4 py-5 border-b border-sidebar-border",
        isCollapsed && "justify-center px-2"
      )}>
        {isCollapsed ? (
          <div className="w-8 h-8 rounded-lg bg-neutral-900 dark:bg-white flex items-center justify-center">
            <Icon icon="solar:leaf-bold-duotone" width={18} className="text-brand-400" />
          </div>
        ) : (
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 dark:bg-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
              <Icon icon="solar:leaf-bold-duotone" width={18} className="text-brand-400" />
            </div>
            <span className="text-lg font-display font-medium tracking-tight text-foreground">
              DietAI
            </span>
          </Link>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto scrollbar-thin">
        {mainNavItems.map((item) => {
          const isActive = isActiveItem(item.href);
          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200",
                "hover:bg-sidebar-accent",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground",
                isCollapsed && "justify-center px-2"
              )}
              title={isCollapsed ? `${item.label} (${item.shortcut})` : undefined}
            >
              <span className={cn(
                "shrink-0",
                isActive && "text-brand-500"
              )}>
                {item.icon}
              </span>
              {!isCollapsed && (
                <>
                  <span className="flex-1">{item.label}</span>
                  {item.shortcut && (
                    <span className="text-[0.65rem] text-muted-foreground opacity-50">
                      {item.shortcut.replace("Alt+", "⌥")}
                    </span>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className={cn(
        "border-t border-sidebar-border p-3 space-y-2",
        isCollapsed && "px-2"
      )}>
        {/* Theme Toggle */}
        <div className={cn(
          "flex items-center",
          isCollapsed ? "justify-center" : "justify-between px-2"
        )}>
          {!isCollapsed && (
            <span className="text-xs text-muted-foreground">Theme</span>
          )}
          <ThemeToggleSimple size="sm" />
        </div>

        {/* Settings Link */}
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
            "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent",
            isCollapsed && "justify-center px-2"
          )}
          title={isCollapsed ? "Settings" : undefined}
        >
          <Settings className="w-5 h-5 shrink-0" />
          {!isCollapsed && <span>Settings</span>}
        </Link>

        {/* User Dropdown */}
        {isAuthenticated && user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-colors",
                  "hover:bg-sidebar-accent",
                  isCollapsed && "justify-center px-2"
                )}
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={user.image || undefined} alt={user.name || "User"} />
                  <AvatarFallback className="bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300">
                    {user.name?.[0]?.toUpperCase() || <User className="w-4 h-4" />}
                  </AvatarFallback>
                </Avatar>
                {!isCollapsed && (
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium truncate">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={isCollapsed ? "center" : "end"} className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{user.name}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile" className="cursor-pointer">
                  <User className="w-4 h-4 mr-2" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings" className="cursor-pointer">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => signOut()}
                className="text-destructive focus:text-destructive cursor-pointer"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Collapse Toggle - Desktop Only */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={cn(
            "hidden md:flex items-center gap-3 w-full px-3 py-2 rounded-lg transition-colors",
            "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent",
            isCollapsed && "justify-center px-2"
          )}
          title={isCollapsed ? "Expand sidebar (Ctrl+[)" : "Collapse sidebar (Ctrl+[)"}
        >
          {isCollapsed ? (
            <ChevronRight className="w-5 h-5" />
          ) : (
            <>
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm">Collapse</span>
              <span className="ml-auto text-xs opacity-50">⌃[</span>
            </>
          )}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="fixed top-4 left-4 z-50 md:hidden p-2 bg-background border border-border rounded-lg shadow-md"
        aria-label="Toggle menu"
      >
        {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          // Base styles
          "flex flex-col h-screen bg-sidebar border-r border-sidebar-border",
          "fixed md:sticky top-0 left-0 z-40",
          "transition-all duration-300 ease-in-out",
          // Width
          isCollapsed ? "w-[72px]" : "w-[280px]",
          // Mobile styles
          "md:translate-x-0",
          isMobileOpen ? "translate-x-0" : "-translate-x-full",
          className
        )}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
