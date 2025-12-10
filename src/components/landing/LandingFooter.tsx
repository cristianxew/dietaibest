"use client";

import Link from "next/link";
import { Icon } from "@iconify/react";
import { cn } from "@/lib/utils";

interface FooterLink {
  label: string;
  href: string;
}

interface FooterSection {
  title: string;
  links: FooterLink[];
}

const footerSections: FooterSection[] = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "Integrations", href: "#" },
      { label: "Pricing", href: "#pricing" },
      { label: "Changelog", href: "#" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Blog", href: "#" },
      { label: "Careers", href: "#" },
      { label: "Contact", href: "#" },
    ],
  },
];

interface LandingFooterProps {
  className?: string;
}

export function LandingFooter({ className }: LandingFooterProps) {
  return (
    <footer
      className={cn(
        "bg-card border-t border-border pt-16 pb-8 px-6 md:px-12 z-10",
        className
      )}
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between gap-12">
        {/* Brand Section */}
        <div className="max-w-xs">
          <Link
            href="/"
            className="flex items-center gap-2.5 mb-4 group"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary">
              <Icon
                icon="solar:leaf-bold-duotone"
                width={18}
                className="text-primary-foreground"
              />
            </div>
            <span className="font-display font-semibold text-lg tracking-tight text-foreground">
              DietAI
            </span>
          </Link>
          <p className="text-sm text-muted-foreground leading-relaxed">
            The first operating system for your nutrition. Powered by autonomous
            agents, designed for human health.
          </p>
        </div>

        {/* Links Sections */}
        <div className="grid grid-cols-2 gap-12">
          {footerSections.map((section) => (
            <div key={section.title}>
              <h4 className="font-semibold text-sm text-foreground mb-4">
                {section.title}
              </h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="max-w-7xl mx-auto mt-16 pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center text-xs text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} DietAI Inc. All rights reserved.</p>
        <div className="flex gap-6 mt-4 md:mt-0">
          <a
            href="#"
            className="hover:text-foreground transition-colors"
          >
            Privacy Policy
          </a>
          <a
            href="#"
            className="hover:text-foreground transition-colors"
          >
            Terms of Service
          </a>
        </div>
      </div>
    </footer>
  );
}
