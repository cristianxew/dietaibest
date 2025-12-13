"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Home,
  BookOpen,
  Calendar,
  Calculator,
  ShoppingCart,
  PanelLeftClose,
  PanelLeft,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { checkOnboardingStatus } from "@/actions/onboarding";

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  showWhen?: "always" | "onboarding-incomplete";
}

interface AppSidebarProps {
  children: React.ReactNode;
}

/**
 * Navigation menu component using shadcn SidebarMenu
 * Uses default size with direct icon rendering (not wrapped)
 */
function NavMenu() {
  const pathname = usePathname();
  const t = useTranslations("navigation");
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);

  useEffect(() => {
    async function fetchStatus() {
      const status = await checkOnboardingStatus();
      setOnboardingCompleted(status.completed);
    }
    fetchStatus();
  }, []);

  const allNavItems: NavItem[] = [
    { id: "dashboard", label: t("dashboard"), href: "/dashboard", icon: Home, showWhen: "always" },
    { id: "recipes", label: t("recipes"), href: "/recipes", icon: BookOpen, showWhen: "always" },
    { id: "meal-plans", label: t("mealPlans"), href: "/meal-plans", icon: Calendar, showWhen: "always" },
    { id: "nutrition", label: t("nutrition"), href: "/nutrition", icon: Calculator, showWhen: "always" },
    { id: "shopping", label: t("shopping"), href: "/shopping", icon: ShoppingCart, showWhen: "always" },
    { id: "onboarding", label: t("onboarding"), href: "/onboarding", icon: UserPlus, showWhen: "onboarding-incomplete" },
  ];

  // Filter nav items based on onboarding status
  const navItems = allNavItems.filter((item) => {
    if (item.showWhen === "always") return true;
    if (item.showWhen === "onboarding-incomplete" && onboardingCompleted === false) return true;
    return false;
  });

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

  return (
    <SidebarMenu className="gap-4">
      {navItems.map((item) => {
        const isActive = isActiveItem(item.href);
        const ItemIcon = item.icon;
        return (
          <SidebarMenuItem key={item.id}>
            <SidebarMenuButton
              asChild
              isActive={isActive}
              tooltip={item.label}
              className={cn(
                "transition-colors",
                isActive
                  ? "bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300"
                  : "text-muted-foreground hover:bg-stone-100 hover:text-brand-600 dark:hover:bg-stone-800 dark:hover:text-brand-400"
              )}
            >
              <Link href={item.href}>
                <ItemIcon className={cn(isActive && "text-brand-600 dark:text-brand-300")} />
                <span>{item.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}

/**
 * Sidebar header with logo
 * Uses default size for consistent height when collapsed/expanded
 */
function SidebarLogo() {
  return (
    <SidebarHeader className="border-b border-sidebar-border/50 p-4">
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            asChild
            className="hover:bg-transparent active:bg-transparent [&>div]:size-6"
          >
            <Link href="/">
              <div className="flex aspect-square items-center justify-center rounded-lg bg-neutral-900 dark:bg-white">
                <Icon
                  icon="solar:leaf-bold-duotone"
                  width={14}
                  className="text-brand-400"
                />
              </div>
              <span className="truncate text-base font-display font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
                DietAI
              </span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
  );
}

/**
 * Sidebar footer with collapse toggle
 * Uses default size for consistency
 */
function SidebarCollapseToggle() {
  const { state, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";

  return (
    <SidebarFooter className="border-t border-sidebar-border/50 p-4">
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            onClick={toggleSidebar}
            tooltip={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="text-muted-foreground hover:text-foreground hover:bg-stone-100 dark:hover:bg-stone-800 [&>svg]:size-5"
          >
            {isCollapsed ? <PanelLeft /> : <PanelLeftClose />}
            <span className="group-data-[collapsible=icon]:hidden">Collapse</span>
            <span className="ml-auto text-xs opacity-50 group-data-[collapsible=icon]:hidden">⌘B</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>
  );
}

/**
 * Inner sidebar component that uses the sidebar context
 */
function SidebarInner() {
  return (
    <Sidebar collapsible="icon">
      <SidebarLogo />
      <SidebarContent>
        <SidebarGroup className="px-4 py-6">
          <SidebarGroupContent>
            <NavMenu />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarCollapseToggle />
      <SidebarRail />
    </Sidebar>
  );
}

/**
 * AppSidebar - Main sidebar wrapper using shadcn primitives
 */
export function AppSidebar({ children }: AppSidebarProps) {
  return (
    <SidebarProvider>
      <SidebarInner />
      <SidebarInset className="bg-background">{children}</SidebarInset>
    </SidebarProvider>
  );
}
