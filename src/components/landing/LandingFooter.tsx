"use client";

import Link from "next/link";
import Image from "next/image";
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
      { label: "Pricing", href: "#pricing" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Blog", href: "#" },
      { label: "Nutrition Guides", href: "#" },
      { label: "Recipe Library", href: "#" },
      { label: "Help Center", href: "#" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About Us", href: "#" },
      { label: "Contact", href: "#" },
      { label: "Careers", href: "#" },
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
        "bg-card border-t border-border pt-16 pb-8 px-4 sm:px-6 lg:px-8 z-10",
        className
      )}
    >
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-12">
          {/* Brand section */}
          <div className="lg:col-span-2">
            <Link href="/" className="block relative w-[184px] h-[60px] mb-4">
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
            <p className="text-muted-foreground leading-relaxed mb-6 max-w-sm">
              Making healthy eating simple, smart, and sustainable — powered by
              AI-driven meal planning and professional nutrition analysis.
            </p>
            {/* Social links */}
            {/* <div className="flex gap-4">
              {[
                { icon: "mdi:twitter", href: "#" },
                { icon: "mdi:instagram", href: "#" },
                { icon: "mdi:facebook", href: "#" },
                { icon: "mdi:linkedin", href: "#" },
              ].map((social) => (
                <a
                  key={social.icon}
                  href={social.href}
                  className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                >
                  <Icon icon={social.icon} width={20} />
                </a>
              ))}
            </div> */}
          </div>

          {/* Link sections */}
          {footerSections.map((section) => (
            <div key={section.title}>
              <h4 className="font-semibold text-foreground mb-4">
                {section.title}
              </h4>
              <ul className="space-y-3">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Newsletter */}
        <div className="py-8 border-y border-border mb-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h4 className="font-semibold text-foreground mb-1">
                Get nutrition tips in your inbox
              </h4>
              <p className="text-sm text-muted-foreground">
                Weekly insights on healthy eating. No spam, ever.
              </p>
            </div>
            <form className="flex gap-3 w-full md:w-auto">
              <input
                type="email"
                placeholder="Enter your email"
                className="flex-1 md:w-64 px-4 py-2.5 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <button
                type="submit"
                className="px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:shadow-md transition-shadow"
              >
                Subscribe
              </button>
            </form>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-muted-foreground">
          {/* TODO: replace with the registered legal entity name from
              src/content/legal/config.ts — "DietAI Inc." is unverified. */}
          <p>&copy; {new Date().getFullYear()} DietAI Inc. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/privacy" className="hover:text-foreground transition-colors">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">
              Terms of Service
            </Link>
            <Link href="/cookies" className="hover:text-foreground transition-colors">
              Cookie Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
