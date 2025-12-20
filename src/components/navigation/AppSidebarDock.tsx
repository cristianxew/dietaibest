"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import {
  Home,
  BookOpen,
  Calendar,
  Calculator,
  ShoppingCart,
  UserPlus,
  User,
  Settings,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeft,
  Check,
  Globe,
  type LucideIcon,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { checkOnboardingStatus } from "@/actions/onboarding";

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  showWhen?: "always" | "onboarding-incomplete";
}

const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed";
// Collapsed: 12px padding * 2 + 40px icon = 64px (icon perfectly centered)
const COLLAPSED_WIDTH = 64;
const EXPANDED_WIDTH = 220;

const languages = [
  { code: "en", label: "EN", name: "English" },
  { code: "es", label: "ES", name: "Español" },
  { code: "pl", label: "PL", name: "Polski" },
] as const;

/**
 * SidebarItem - Consistent base component for all sidebar items
 * Left-aligned layout - sidebar width handles centering when collapsed
 */
function SidebarItem({
  icon: IconComponent,
  label,
  collapsed,
  isActive = false,
  onClick,
  href,
  className,
}: {
  icon: LucideIcon | React.ComponentType<{ className?: string }>;
  label: string;
  collapsed: boolean;
  isActive?: boolean;
  onClick?: () => void;
  href?: string;
  className?: string;
}) {
  const content = (
    <>
      {/* Active indicator - LEFT SIDE */}
      {isActive && (
        <span
          className={cn(
            "absolute left-0 top-1/2 -translate-y-1/2",
            "w-1 h-6 rounded-r-full",
            "bg-brand-500 dark:bg-brand-400"
          )}
        />
      )}
      {/* Icon container - 40px, always left-aligned */}
      <span className="w-10 h-10 flex items-center justify-center shrink-0">
        <IconComponent
          className="w-5 h-5"
          strokeWidth={isActive ? 2.5 : 2}
        />
      </span>
      {/* Label - fades out when collapsed */}
      <span
        className={cn(
          "text-sm font-medium whitespace-nowrap overflow-hidden",
          "transition-opacity duration-300 ease-out",
          collapsed ? "opacity-0" : "opacity-100"
        )}
      >
        {label}
      </span>
    </>
  );

  const baseStyles = cn(
    // Layout - always left-aligned, gap for spacing
    "relative flex items-center gap-3 w-full h-10 rounded-xl overflow-hidden",
    // Transitions
    "transition-colors duration-200 ease-out",
    // Colors
    "text-stone-600 dark:text-stone-400",
    !isActive && "hover:bg-stone-100 dark:hover:bg-stone-800",
    !isActive && "hover:text-stone-900 dark:hover:text-stone-100",
    isActive && "bg-brand-50 dark:bg-brand-950/40",
    isActive && "text-brand-600 dark:text-brand-400",
    // Focus
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
    className
  );

  const wrapper = (child: React.ReactNode) => {
    if (collapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{child}</TooltipTrigger>
          <TooltipContent side="right" sideOffset={12} className="font-medium">
            {label}
          </TooltipContent>
        </Tooltip>
      );
    }
    return child;
  };

  if (href) {
    return wrapper(
      <Link href={href} className={baseStyles}>
        {content}
      </Link>
    );
  }

  return wrapper(
    <button onClick={onClick} className={baseStyles}>
      {content}
    </button>
  );
}

/**
 * DockLanguageSwitcher - Text-based language switcher
 */
function DockLanguageSwitcher({ collapsed }: { collapsed: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const [isPending, setIsPending] = useState(false);

  const currentLang = languages.find((l) => l.code === locale) || languages[0];

  const handleLanguageChange = (newLocale: string) => {
    setIsPending(true);
    const segments = pathname.split("/").filter(Boolean);
    const isCurrentLocaleInPath = segments[0] === locale;

    let newPathname = pathname;
    if (isCurrentLocaleInPath) {
      newPathname = "/" + segments.slice(1).join("/");
    }

    if (newLocale !== "en") {
      newPathname = `/${newLocale}${newPathname}`;
    }

    if (!newPathname.startsWith("/")) {
      newPathname = "/" + newPathname;
    }

    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
    router.push(newPathname);
    setIsPending(false);
  };

  const trigger = (
    <button
      disabled={isPending}
      className={cn(
        "relative flex items-center gap-3 w-full h-10 rounded-xl overflow-hidden",
        "transition-colors duration-200 ease-out",
        "text-stone-600 dark:text-stone-400",
        "hover:bg-stone-100 dark:hover:bg-stone-800",
        "hover:text-stone-900 dark:hover:text-stone-100",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
      )}
    >
      <span className="w-10 h-10 flex items-center justify-center shrink-0">
        <Globe className="w-5 h-5" />
      </span>
      <span
        className={cn(
          "text-sm font-medium whitespace-nowrap overflow-hidden",
          "transition-opacity duration-300 ease-out",
          collapsed ? "opacity-0" : "opacity-100"
        )}
      >
        {currentLang.name}
      </span>
    </button>
  );

  return (
    <DropdownMenu>
      {collapsed ? (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8} className="font-medium">
            Language
          </TooltipContent>
        </Tooltip>
      ) : (
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      )}
      <DropdownMenuContent
        side="right"
        align="center"
        sideOffset={8}
        className={cn(
          "w-44 p-1.5 rounded-xl",
          "bg-white/95 dark:bg-stone-900/95 backdrop-blur-xl",
          "border border-stone-200/50 dark:border-stone-700/50",
          "shadow-xl"
        )}
      >
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => handleLanguageChange(lang.code)}
            className={cn(
              "flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer",
              "transition-colors duration-150",
              locale === lang.code
                ? "bg-brand-50 dark:bg-brand-950/30 text-brand-700 dark:text-brand-300"
                : "text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
            )}
          >
            <span className="font-medium">{lang.name}</span>
            {locale === lang.code && <Check className="w-4 h-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


/**
 * UserMenuDock - User dropdown for the dock sidebar
 */
function UserMenuDock({ collapsed }: { collapsed: boolean }) {
  const { user, isAuthenticated, signOut } = useAuth();

  if (!isAuthenticated || !user) return null;

  const trigger = (
    <button
      className={cn(
        "relative flex items-center gap-3 w-full h-10 rounded-xl overflow-hidden",
        "transition-colors duration-200 ease-out",
        "text-stone-600 dark:text-stone-400",
        "hover:bg-stone-100 dark:hover:bg-stone-800",
        "hover:text-stone-900 dark:hover:text-stone-100",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
      )}
      aria-label="User menu"
    >
      <span className="w-10 h-10 flex items-center justify-center shrink-0">
        <Avatar className="w-7 h-7 rounded-lg">
          <AvatarImage
            src={user.image || undefined}
            alt={user.name || "User"}
            className="rounded-lg"
          />
          <AvatarFallback
            className={cn(
              "rounded-lg text-xs font-semibold",
              "bg-brand-100 text-brand-700",
              "dark:bg-brand-900 dark:text-brand-300"
            )}
          >
            {user.name?.[0]?.toUpperCase() || <User className="w-3.5 h-3.5" />}
          </AvatarFallback>
        </Avatar>
      </span>
      <span
        className={cn(
          "text-sm font-medium whitespace-nowrap overflow-hidden",
          "transition-opacity duration-300 ease-out",
          collapsed ? "opacity-0" : "opacity-100"
        )}
      >
        {user.name}
      </span>
    </button>
  );

  return (
    <DropdownMenu>
      {collapsed ? (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={8} className="font-medium">
            {user.name || "Profile"}
          </TooltipContent>
        </Tooltip>
      ) : (
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      )}
      <DropdownMenuContent
        side="right"
        align="end"
        sideOffset={8}
        className={cn(
          "w-56 p-1.5 rounded-xl",
          "bg-white/95 dark:bg-stone-900/95 backdrop-blur-xl",
          "border border-stone-200/50 dark:border-stone-700/50",
          "shadow-xl"
        )}
      >
        {/* User Info Header */}
        <div className="px-3 py-3 mb-1 rounded-lg bg-stone-50 dark:bg-stone-800/50">
          <div className="flex items-center gap-3">
            <Avatar className="w-10 h-10 rounded-lg">
              <AvatarImage
                src={user.image || undefined}
                alt={user.name || "User"}
                className="rounded-lg"
              />
              <AvatarFallback className="rounded-lg bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300 font-semibold">
                {user.name?.[0]?.toUpperCase() || <User className="w-4 h-4" />}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-stone-900 dark:text-stone-100">
                {user.name}
              </p>
              <p className="text-xs text-stone-500 dark:text-stone-400 truncate">
                {user.email}
              </p>
            </div>
          </div>
        </div>

        <DropdownMenuItem asChild>
          <Link
            href="/profile"
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer",
              "text-stone-700 dark:text-stone-300",
              "hover:bg-stone-100 dark:hover:bg-stone-800",
              "transition-colors duration-150"
            )}
          >
            <User className="w-4 h-4" />
            <span className="font-medium">Profile</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link
            href="/settings"
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer",
              "text-stone-700 dark:text-stone-300",
              "hover:bg-stone-100 dark:hover:bg-stone-800",
              "transition-colors duration-150"
            )}
          >
            <Settings className="w-4 h-4" />
            <span className="font-medium">Settings</span>
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-1.5 bg-stone-200/70 dark:bg-stone-700/50" />

        <DropdownMenuItem
          onClick={() => signOut()}
          className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer",
            "text-red-600 dark:text-red-400",
            "hover:bg-red-50 dark:hover:bg-red-950/30",
            "transition-colors duration-150"
          )}
        >
          <LogOut className="w-4 h-4" />
          <span className="font-medium">Sign out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * MobileNavButton - Navigation button for mobile sheet
 */
function MobileNavButton({
  item,
  isActive,
  onClose,
}: {
  item: NavItem;
  isActive: boolean;
  onClose: () => void;
}) {
  const ItemIcon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onClose}
      className={cn(
        "relative flex items-center gap-3 px-3 py-2.5 rounded-xl",
        "transition-all duration-200",
        isActive
          ? "bg-brand-50 dark:bg-brand-950/40 text-brand-600 dark:text-brand-400"
          : "text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
      )}
    >
      {isActive && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-r-full bg-brand-500" />
      )}
      <ItemIcon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
      <span className="font-medium">{item.label}</span>
    </Link>
  );
}

/**
 * MobileUserSection - User info and actions for mobile sheet
 */
function MobileUserSection({ onClose }: { onClose: () => void }) {
  const { user, isAuthenticated, signOut } = useAuth();

  if (!isAuthenticated || !user) return null;

  return (
    <div className="border-t border-stone-200 dark:border-stone-700 pt-4 mt-4 px-4">
      <div className="flex items-center gap-3 mb-4">
        <Avatar className="w-10 h-10 rounded-lg">
          <AvatarImage src={user.image || undefined} alt={user.name || "User"} className="rounded-lg" />
          <AvatarFallback className="rounded-lg bg-brand-100 text-brand-700 dark:bg-brand-900 dark:text-brand-300 font-semibold">
            {user.name?.[0]?.toUpperCase() || <User className="w-4 h-4" />}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate text-stone-900 dark:text-stone-100">{user.name}</p>
          <p className="text-sm text-stone-500 dark:text-stone-400 truncate">{user.email}</p>
        </div>
      </div>
      <div className="space-y-1">
        <Link href="/profile" onClick={onClose} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors">
          <User className="w-5 h-5" />
          <span className="font-medium">Profile</span>
        </Link>
        <Link href="/settings" onClick={onClose} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors">
          <Settings className="w-5 h-5" />
          <span className="font-medium">Settings</span>
        </Link>
        <button onClick={() => { signOut(); onClose(); }} className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Sign out</span>
        </button>
      </div>
    </div>
  );
}

/**
 * MobileLanguageSwitcher - Language switcher for mobile
 */
function MobileLanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();

  const handleLanguageChange = (newLocale: string) => {
    const segments = pathname.split("/").filter(Boolean);
    const isCurrentLocaleInPath = segments[0] === locale;
    let newPathname = pathname;
    if (isCurrentLocaleInPath) newPathname = "/" + segments.slice(1).join("/");
    if (newLocale !== "en") newPathname = `/${newLocale}${newPathname}`;
    if (!newPathname.startsWith("/")) newPathname = "/" + newPathname;
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
    router.push(newPathname);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 px-3 py-2 rounded-lg bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors text-sm font-medium">
          <Globe className="w-4 h-4" />
          {languages.find((l) => l.code === locale)?.label || "EN"}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40 rounded-xl">
        {languages.map((lang) => (
          <DropdownMenuItem key={lang.code} onClick={() => handleLanguageChange(lang.code)} className={cn("flex items-center justify-between px-3 py-2 cursor-pointer", locale === lang.code && "bg-brand-50 dark:bg-brand-950/30")}>
            <span>{lang.name}</span>
            {locale === lang.code && <Check className="w-4 h-4 text-brand-600" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * AppSidebarDock - Collapsible sidebar with smooth transitions
 */
export function AppSidebarDock({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const t = useTranslations("navigation");
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (stored !== null) setCollapsed(stored === "true");
  }, []);

  const toggleCollapsed = () => {
    const newState = !collapsed;
    setCollapsed(newState);
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(newState));
  };

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

  const navItems = allNavItems.filter((item) => {
    if (item.showWhen === "always") return true;
    if (item.showWhen === "onboarding-incomplete" && onboardingCompleted === false) return true;
    return false;
  });

  const isActiveItem = (href: string): boolean => {
    const pathSegments = pathname.split("/").filter(Boolean);
    const hasLocale = pathSegments[0] && pathSegments[0].length === 2;
    const cleanPath = hasLocale ? `/${pathSegments.slice(1).join("/")}` : pathname;
    if (href === "/dashboard" && (cleanPath === "/" || cleanPath === "/dashboard")) return true;
    return cleanPath.startsWith(href) && href !== "/";
  };

  const closeMobile = () => setMobileOpen(false);

  return (
    <TooltipProvider>
      <div className="flex min-h-screen">
        {/* Fixed Theme Toggle - Top Right */}
        <div className="fixed top-4 right-4 z-50 hidden md:block">
          <ThemeToggleSimple size="sm" />
        </div>

        {/* Mobile Header */}
        <div className="fixed top-0 left-0 right-0 z-50 md:hidden">
          <div className={cn("flex items-center justify-between px-4 py-3", "bg-white/95 dark:bg-stone-900/95 backdrop-blur-xl", "border-b border-stone-200/60 dark:border-stone-800/60")}>
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button className="flex items-center justify-center w-10 h-10 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors" aria-label="Open menu">
                  <Menu className="w-5 h-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 p-0 bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800">
                <SheetHeader className="px-6 pt-6 pb-4 border-b border-stone-200 dark:border-stone-700">
                  <SheetTitle className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-stone-900 dark:bg-stone-100">
                      <Icon icon="solar:leaf-bold-duotone" width={18} className="text-brand-400" />
                    </div>
                    <span className="font-display font-semibold text-lg">DietAI</span>
                  </SheetTitle>
                </SheetHeader>
                <nav className="px-4 py-4 space-y-1">
                  {navItems.map((item) => (
                    <MobileNavButton key={item.id} item={item} isActive={isActiveItem(item.href)} onClose={closeMobile} />
                  ))}
                </nav>
                <div className="px-6 py-4 border-t border-stone-200 dark:border-stone-700">
                  <div className="flex items-center gap-3">
                    <ThemeToggleSimple size="sm" />
                    <MobileLanguageSwitcher />
                  </div>
                </div>
                <MobileUserSection onClose={closeMobile} />
              </SheetContent>
            </Sheet>
            <Link href="/" className="flex items-center gap-2">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-stone-900 dark:bg-stone-100">
                <Icon icon="solar:leaf-bold-duotone" width={16} className="text-brand-400" />
              </div>
              <span className="font-display font-semibold">DietAI</span>
            </Link>
            <div className="flex items-center gap-1">
              <ThemeToggleSimple size="sm" />
              <MobileLanguageSwitcher />
            </div>
          </div>
        </div>

        {/* Desktop Sidebar */}
        <aside
          style={{ width: collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH }}
          className={cn(
            "hidden md:flex fixed left-0 top-0 bottom-0 z-40",
            "flex-col py-4 px-3",
            "bg-white dark:bg-stone-900",
            "border-r border-stone-200 dark:border-stone-800",
            // ONLY animate width - nothing else
            "transition-[width] duration-300 ease-out"
          )}
        >
          {/* Logo - Same structure as nav items for alignment */}
          <div className="h-12 mb-2">
            <Link
              href="/"
              className="relative flex items-center gap-3 w-full h-10 rounded-xl overflow-hidden group"
            >
              <span className="w-10 h-10 flex items-center justify-center shrink-0">
                <div className={cn(
                  "flex items-center justify-center",
                  "w-9 h-9 rounded-lg",
                  "bg-stone-900 dark:bg-stone-100",
                  "group-hover:scale-105 transition-transform duration-200"
                )}>
                  <Icon icon="solar:leaf-bold-duotone" width={18} className="text-brand-400" />
                </div>
              </span>
              <span className={cn(
                "font-display font-semibold text-lg text-stone-900 dark:text-stone-100",
                "whitespace-nowrap overflow-hidden",
                "transition-opacity duration-300 ease-out",
                collapsed ? "opacity-0" : "opacity-100"
              )}>
                DietAI
              </span>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1">
            {navItems.map((item) => (
              <SidebarItem
                key={item.id}
                icon={item.icon}
                label={item.label}
                href={item.href}
                collapsed={collapsed}
                isActive={isActiveItem(item.href)}
              />
            ))}
          </nav>

          {/* Divider */}
          <div className="h-px bg-stone-200 dark:bg-stone-800 my-3 mx-2" />

          {/* Settings */}
          <div className="space-y-1">
            <DockLanguageSwitcher collapsed={collapsed} />
          </div>

          {/* Divider */}
          <div className="h-px bg-stone-200 dark:bg-stone-800 my-3 mx-2" />

          {/* Collapse Toggle - Always at bottom, consistent position */}
          <SidebarItem
            icon={collapsed ? PanelLeft : PanelLeftClose}
            label={collapsed ? "Expand" : "Collapse"}
            collapsed={collapsed}
            onClick={toggleCollapsed}
          />

          {/* User */}
          <div className="mt-1">
            <UserMenuDock collapsed={collapsed} />
          </div>
        </aside>

        {/* Main Content */}
        <main
          className={cn(
            "flex-1 bg-background min-h-screen",
            "pt-16 md:pt-0",
            "transition-[margin-left] duration-300 ease-out",
            collapsed ? "md:ml-16" : "md:ml-[220px]"
          )}
        >
          {children}
        </main>
      </div>
    </TooltipProvider>
  );
}
