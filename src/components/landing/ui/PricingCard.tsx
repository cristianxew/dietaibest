"use client";

import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface PricingCardProps {
  name: string;
  price: string;
  period?: string;
  description?: string;
  features: string[];
  buttonText: string;
  href?: string;
  highlighted?: boolean;
  badge?: string;
  className?: string;
}

export function PricingCard({
  name,
  price,
  period,
  features,
  buttonText,
  href = "/sign-up",
  highlighted = false,
  badge,
  className,
}: PricingCardProps) {
  return (
    <div
      className={cn(
        "p-8 rounded-2xl border transition-all duration-300 relative",
        highlighted
          ? "bg-gradient-to-br from-brand-500 to-brand-600 border-brand-400 text-white shadow-2xl shadow-brand-500/30 md:-translate-y-4"
          : "bg-card border-border hover:shadow-xl hover:border-brand-200 dark:hover:border-brand-500/30",
        className
      )}
    >
      {/* Badge */}
      {badge && (
        <div className={cn(
          "absolute top-0 right-0 text-[0.6rem] font-bold uppercase tracking-widest px-3 py-1 rounded-bl-xl rounded-tr-xl",
          highlighted
            ? "bg-gold-400 text-gold-900"
            : "bg-gold-100 text-gold-700 dark:bg-gold-500/20 dark:text-gold-400"
        )}>
          {badge}
        </div>
      )}

      {/* Plan Name */}
      <h3
        className={cn(
          "font-display font-semibold text-xl mb-2",
          highlighted ? "text-white" : "text-foreground"
        )}
      >
        {name}
      </h3>

      {/* Price */}
      <div
        className={cn(
          "text-4xl font-display font-semibold mb-6",
          highlighted ? "text-white" : "text-foreground"
        )}
      >
        {price}
        {period && (
          <span
            className={cn(
              "text-lg font-normal",
              highlighted ? "text-white/70" : "text-muted-foreground"
            )}
          >
            {period}
          </span>
        )}
      </div>

      {/* Features */}
      <ul className="space-y-4 text-sm mb-8">
        {features.map((feature, index) => (
          <li
            key={index}
            className={cn(
              "flex gap-3",
              highlighted ? "text-white/90" : "text-muted-foreground"
            )}
          >
            <Check
              className={cn(
                "w-5 h-5 shrink-0",
                highlighted ? "text-gold-300" : "text-sage-500"
              )}
            />
            {feature}
          </li>
        ))}
      </ul>

      {/* CTA Button */}
      <Link
        href={href}
        className={cn(
          "block w-full py-3 rounded-lg text-sm font-semibold transition-all text-center",
          highlighted
            ? "bg-white text-brand-600 hover:bg-white/90 shadow-lg"
            : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-brand-500/20"
        )}
      >
        {buttonText}
      </Link>
    </div>
  );
}
