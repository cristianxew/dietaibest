"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import Image from "next/image";
import { SignUpForm } from "@/components/forms/SignUpForm";
import { ThemeToggleSimple } from "@/components/ui/ThemeToggle";
import { Globe, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const languages = [
  { code: "en", label: "EN", name: "English" },
  { code: "es", label: "ES", name: "Español" },
  { code: "pl", label: "PL", name: "Polski" },
] as const;

export default function SignUpPage() {
  const { status } = useSession();
  const router = useRouter();
  const t = useTranslations();
  const locale = useLocale();
  const pathname = usePathnameWithFallback();
  const [isPending, setIsPending] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (status === "authenticated") {
      router.push("/dashboard");
    }
  }, [status, router]);

  // Fallback to safely extract pathname on client-side
  function usePathnameWithFallback() {
    const [path, setPath] = useState("");
    useEffect(() => {
      setPath(window.location.pathname);
    }, []);
    return path;
  }

  const handleLanguageChange = (newLocale: string) => {
    if (isPending || !pathname) return;
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
    window.location.href = newPathname;
  };

  // Show loading while checking session
  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Don't render if authenticated (will redirect)
  if (status === "authenticated") {
    return null;
  }

  const currentLang = languages.find((l) => l.code === locale) || languages[0];
  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8 bg-stone-100 dark:bg-slate-950 relative overflow-hidden noise">
      {/* Background decoration & Noise Overlay for the entire viewport */}
      <div className="absolute inset-0 pointer-events-none z-0">
        {/* Top-right coral/peach glow */}
        <div
          className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full opacity-30 dark:opacity-15 animate-pulse-soft"
          style={{
            background: "radial-gradient(circle, var(--brand-200) 0%, transparent 70%)",
          }}
        />
        {/* Bottom-left golden amber glow */}
        <div
          className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full opacity-20 dark:opacity-10"
          style={{
            background: "radial-gradient(circle, #FED7AA 0%, transparent 70%)",
          }}
        />
      </div>

      {/* Main Container Card */}
      <div className="w-full max-w-5xl bg-card border border-border/80 shadow-2xl rounded-3xl grid lg:grid-cols-12 overflow-hidden animate-scale-in relative z-10">

        {/* Left Column: Form Panel */}
        <div className="col-span-12 lg:col-span-6 p-8 sm:p-12 flex flex-col justify-between bg-stone-50/50 dark:bg-stone-900/30 relative">

          {/* Header Row: Logo & Toolbar */}
          <div className="flex items-center justify-between mb-8">
            <Link href="/" className="transition-opacity hover:opacity-90">
              <Image
                src="/Dietai_logo_light.png"
                alt="DietAI Logo"
                width={150}
                height={45}
                className="h-7 lg:h-12 w-auto object-contain dark:hidden"
                priority
              />
              <Image
                src="/Dietai_logo_dark.png"
                alt="DietAI Logo"
                width={150}
                height={45}
                className="h-7 lg:h-12 w-auto object-contain hidden dark:block"
                priority
              />
            </Link>

            <div className="flex items-center gap-2">
              {/* Language Selector */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    disabled={isPending}
                    className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/60 hover:bg-stone-100 dark:hover:bg-stone-850 transition-colors text-xs font-medium text-stone-600 dark:text-stone-300"
                    aria-label="Change language"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>{currentLang.label}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-32 rounded-xl">
                  {languages.map((lang) => (
                    <DropdownMenuItem
                      key={lang.code}
                      onClick={() => handleLanguageChange(lang.code)}
                      className={cn(
                        "flex items-center justify-between px-3 py-2 cursor-pointer text-xs",
                        locale === lang.code && "text-brand-600 dark:text-brand-400 font-medium bg-brand-50 dark:bg-brand-950/20"
                      )}
                    >
                      <span>{lang.name}</span>
                      {locale === lang.code && <Check className="w-3.5 h-3.5" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Theme switcher */}
              <div className="rounded-lg border border-border/60 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors flex items-center justify-center h-8.5 w-8.5">
                <ThemeToggleSimple size="sm" />
              </div>
            </div>
          </div>

          {/* Center Form Section */}
          <div className="my-auto space-y-6">
            <div className="space-y-2 text-left">
              <h1 className="text-3xl font-display font-semibold tracking-tight text-foreground">
                {t("auth.signUpTitle")}
              </h1>
              <p className="text-muted-foreground text-sm leading-normal">
                {t("auth.signUpDescription")}
              </p>
            </div>

            <SignUpForm callbackUrl="/dashboard" />
          </div>

          {/* Bottom Footer Section */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-stone-400 dark:text-stone-500 border-t border-border/40 pt-6 mt-8">
            <div>
              &copy; {new Date().getFullYear()} DietAI. All rights reserved.
            </div>
            <div className="flex gap-3">
              <Link href="/terms" className="hover:underline font-medium text-stone-500">
                {t("auth.termsOfService")}
              </Link>
              <Link href="/privacy" className="hover:underline font-medium text-stone-500">
                {t("auth.privacyPolicy")}
              </Link>
            </div>
          </div>
        </div>

        {/* Right Column: Visual Culinary Showcase */}
        <div className="col-span-6 p-4 hidden lg:flex flex-col relative h-full min-h-[600px]">
          <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-lg border border-border/40">
            {/* Culinary Kitchen Backdrop Image */}
            <Image
              src="/auth_kitchen_bg_alt2.png"
              alt="Culinary backdrop"
              fill
              sizes="50vw"
              className="object-cover object-center"
              priority
            />
            {/* Subtle Vignette Overlay to blend the image and support overlays */}
            <div className="absolute inset-0 bg-stone-900/10 dark:bg-stone-950/30 z-10" />

            {/* Floating Widget 1: Recipe Status (Top Left) */}
            <div className="glass absolute top-6 left-6 p-4 rounded-xl border border-white/20 shadow-lg max-w-[200px] z-20 animate-gentle-float stagger-2">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 rounded-full bg-success/20 flex items-center justify-center">
                  <span className="text-[10px] text-success font-bold">✓</span>
                </div>
                <span className="text-[9px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">Recipe Imported</span>
              </div>
              <p className="text-xs font-semibold text-foreground truncate">Herb-Crusted Salmon</p>
              <span className="text-[10px] text-stone-500 dark:text-stone-400">380 kcal • 42g Protein</span>
            </div>

            {/* Floating Widget 2: Macro Progress (Bottom Right) */}
            <div className="glass absolute bottom-6 right-6 p-4 rounded-xl border border-white/20 shadow-lg max-w-[220px] z-20 animate-gentle-float stagger-4">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-1.5">DietAI Agent Status</p>
              <p className="text-xs font-semibold text-foreground mb-2">Meal plans balanced for the week</p>
              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 bg-stone-200/50 dark:bg-stone-800 rounded-full overflow-hidden">
                  <div className="h-full bg-brand-500 w-[85%] rounded-full" />
                </div>
                <span className="text-[10px] font-bold text-brand-600 dark:text-brand-400">85%</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

