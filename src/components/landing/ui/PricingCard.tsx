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
          ? "bg-primary border-primary text-primary-foreground shadow-2xl shadow-primary/25 md:-translate-y-4"
          : "bg-card border-border hover:shadow-xl hover:border-primary/30",
        className
      )}
    >
      {/* Badge */}
      {badge && (
        <div className="absolute top-0 right-0 bg-accent text-accent-foreground text-[0.6rem] font-bold uppercase tracking-widest px-3 py-1 rounded-bl-xl rounded-tr-xl">
          {badge}
        </div>
      )}

      {/* Plan Name */}
      <h3
        className={cn(
          "font-display font-semibold text-xl mb-2",
          highlighted ? "text-primary-foreground" : "text-foreground"
        )}
      >
        {name}
      </h3>

      {/* Price */}
      <div
        className={cn(
          "text-4xl font-display font-semibold mb-6",
          highlighted ? "text-primary-foreground" : "text-foreground"
        )}
      >
        {price}
        {period && (
          <span
            className={cn(
              "text-lg font-normal",
              highlighted ? "text-primary-foreground/70" : "text-muted-foreground"
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
              highlighted ? "text-primary-foreground/80" : "text-muted-foreground"
            )}
          >
            <Check
              className={cn(
                "w-5 h-5 shrink-0",
                highlighted ? "text-primary-foreground" : "text-primary"
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
            ? "bg-primary-foreground text-primary hover:bg-primary-foreground/90"
            : "bg-primary text-primary-foreground hover:bg-primary/90"
        )}
      >
        {buttonText}
      </Link>
    </div>
  );
}
