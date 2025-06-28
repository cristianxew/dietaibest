"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, ChevronDown, Languages } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const languages = [
  {
    code: "en",
    name: "English",
    flag: "🇺🇸",
  },
  {
    code: "pl",
    name: "Polski",
    flag: "🇵🇱",
  },
  {
    code: "es",
    name: "Español",
    flag: "🇪🇸",
  },
] as const;

interface LanguageSwitcherProps {
  variant?: "default" | "outline" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  showFlag?: boolean;
  showText?: boolean;
  className?: string;
}

export function LanguageSwitcher({
  variant = "outline",
  size = "default",
  showFlag = true,
  showText = true,
  className,
}: LanguageSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);

  const currentLanguage = languages.find((lang) => lang.code === locale);

  /**
   * Handle language change with proper locale routing
   */
  const handleLanguageChange = (newLocale: string) => {
    startTransition(() => {
      // Remove current locale from pathname if it exists
      const segments = pathname.split("/").filter(Boolean);
      const isCurrentLocaleInPath = segments[0] === locale;

      let newPathname = pathname;
      if (isCurrentLocaleInPath) {
        // Remove current locale
        newPathname = "/" + segments.slice(1).join("/");
      }

      // Add new locale prefix if it's not the default locale
      if (newLocale !== "en") {
        newPathname = `/${newLocale}${newPathname}`;
      }

      // Ensure pathname starts with /
      if (!newPathname.startsWith("/")) {
        newPathname = "/" + newPathname;
      }

      // Set locale preference in cookie and navigate
      document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;

      router.push(newPathname);
      setIsOpen(false);
    });
  };

  const buttonContent = (
    <>
      {showFlag && currentLanguage && (
        <span className="text-lg" role="img" aria-label={currentLanguage.name}>
          {currentLanguage.flag}
        </span>
      )}
      {showText && currentLanguage && (
        <span className="hidden sm:inline-block">{currentLanguage.name}</span>
      )}
      {!showFlag && !showText && <Languages className="h-4 w-4" />}
      <ChevronDown className="h-3 w-3 opacity-50" />
    </>
  );

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          disabled={isPending}
          className={cn(
            "gap-2",
            isPending && "opacity-50 cursor-not-allowed",
            className
          )}
          aria-label={`Current language: ${currentLanguage?.name}. Click to change language.`}
        >
          {buttonContent}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {languages.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => handleLanguageChange(language.code)}
            disabled={isPending}
            className={cn(
              "flex items-center gap-3 cursor-pointer",
              locale === language.code && "bg-accent"
            )}
          >
            <span className="text-lg" role="img" aria-label={language.name}>
              {language.flag}
            </span>
            <span className="flex-1">{language.name}</span>
            {locale === language.code && (
              <Check className="h-4 w-4 text-primary" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Compact version for mobile or space-constrained areas
 */
export function LanguageSwitcherCompact({ className }: { className?: string }) {
  return (
    <LanguageSwitcher
      variant="ghost"
      size="sm"
      showFlag={true}
      showText={false}
      className={className}
    />
  );
}

/**
 * Full version with text labels for desktop
 */
export function LanguageSwitcherFull({ className }: { className?: string }) {
  return (
    <LanguageSwitcher
      variant="outline"
      size="default"
      showFlag={true}
      showText={true}
      className={className}
    />
  );
}
