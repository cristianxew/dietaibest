"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggleSimple } from "@/components/ui/ThemeToggle";

interface LandingNavProps {
  className?: string;
}

const navLinks = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it Works" },
  { href: "#pricing", label: "Pricing" },
];

export function LandingNav({ className }: LandingNavProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav
      className={cn(
        "sticky top-0 z-50 w-full backdrop-blur-xl bg-background/80 border-b border-border/50",
        className
      )}
    >
      <div className="mx-auto max-w-7xl py-3 px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/" className="block relative w-[184px] h-[60px]">
            <Image
              src="/Dietai_logo_dark.png"
              alt="DietAI"
              fill
              className="object-contain hidden dark:block"
            />
            <Image
              src="/Dietai_logo_light.png"
              alt="DietAI"
              fill
              className="object-contain dark:hidden"
            />
          </Link>

          {/* Desktop Navigation Links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-secondary"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Right Section */}
          <div className="flex items-center gap-2">
            {/* Theme Toggle */}
            <ThemeToggleSimple size="sm" />

            {/* Login Button - Desktop */}
            <Link
              href="/sign-in"
              className="hidden md:inline-flex px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-secondary"
            >
              Log in
            </Link>

            {/* Get Started Button */}
            <Link
              href="/sign-up"
              className="group inline-flex items-center gap-2 bg-primary text-primary-foreground rounded-full pl-4 pr-2 py-2 text-sm font-medium shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
            >
              <span>Get Started</span>
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary-foreground/20 group-hover:bg-primary-foreground/30 transition-colors">
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </Link>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
              aria-label="Toggle mobile menu"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-full left-0 right-0 p-4">
          <div className="glass rounded-2xl shadow-lg border border-border p-2">
            <div className="flex flex-col">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="px-4 py-3 text-sm font-medium text-foreground hover:bg-secondary rounded-xl transition-colors"
                >
                  {link.label}
                </a>
              ))}
              <div className="my-2 h-px bg-border" />
              <Link
                href="/sign-in"
                onClick={() => setMobileMenuOpen(false)}
                className="px-4 py-3 text-sm font-medium text-foreground hover:bg-secondary rounded-xl transition-colors"
              >
                Log in
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
