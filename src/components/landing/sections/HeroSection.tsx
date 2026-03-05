"use client";

import Link from "next/link";
import { Icon } from "@iconify/react";
import { Play, ArrowRight } from "lucide-react";
import { AnimatedBadge, DashboardPreview } from "../ui";
import { cn } from "@/lib/utils";

interface HeroSectionProps {
  className?: string;
}

export function HeroSection({ className }: HeroSectionProps) {
  return (
    <section
      className={cn(
        "pt-16 pb-20 md:pt-24 md:pb-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto",
        className
      )}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        {/* Hero Text */}
        <div className="flex flex-col gap-6 animate-fade-up">
          <AnimatedBadge variant="gold">Smarter Eating Starts Here</AnimatedBadge>

          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl leading-[1.1] font-display font-semibold text-foreground tracking-tight">
            Healthy Eating{" "}
            <span className="text-gradient bg-gradient-to-r from-brand-500 via-gold-500 to-brand-400">
              Without the Guesswork
            </span>
          </h1>

          <p className="text-lg text-muted-foreground leading-relaxed max-w-lg">
            DietAI helps you truly understand what you eat, plan meals around
            your nutritional targets, and automate everything from recipe
            collection to grocery shopping—so healthy eating finally fits your
            life.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 mt-2">
            <Link
              href="/sign-up"
              className="group inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium shadow-lg shadow-brand-500/25 hover:shadow-xl hover:shadow-brand-500/30 hover:-translate-y-0.5 transition-all duration-200"
            >
              <Icon icon="solar:chef-hat-bold-duotone" width={18} />
              Build My First Plan
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-card border border-border text-foreground rounded-xl text-sm font-medium hover:bg-secondary hover:border-brand-200 transition-all duration-200"
            >
              <Play className="w-4 h-4" />
              See How It Works
            </a>
          </div>

          {/* Social Proof */}
          <div className="flex items-center gap-4 mt-6 pt-6 border-t border-border">
            <div className="flex -space-x-2">
              {[
                "bg-brand-100 text-brand-700",
                "bg-gold-100 text-gold-700",
                "bg-sage-100 text-sage-700",
                "bg-violet-200 text-violet-700"
              ].map((colors, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-8 h-8 rounded-full border-2 border-background flex items-center justify-center text-xs font-medium",
                    colors
                  )}
                >
                  {["JD", "AK", "MS", "RT"][i]}
                </div>
              ))}
            </div>
            <div className="text-sm">
              <span className="text-foreground font-medium">Join 2,500+</span>
              <span className="text-muted-foreground"> people who finally understand their food</span>
            </div>
          </div>
        </div>

        {/* Hero Visual - Dashboard Preview */}
        <div className="lg:pl-8 animate-fade-up stagger-2">
          <DashboardPreview />
        </div>
      </div>
    </section>
  );
}
