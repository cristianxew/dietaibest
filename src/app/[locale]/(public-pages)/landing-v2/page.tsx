"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

/* ─────────────────────────────────────────────────────────────
   NAV
───────────────────────────────────────────────────────────── */
function V2Nav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#0F0E0D]/90 backdrop-blur-[14px] saturate-150 border-b border-border"
          : "bg-transparent border-b border-transparent"
      }`}
    >
      <div className="max-w-[1180px] mx-auto px-8 flex items-center justify-between h-[68px]">
        {/* Brand */}
        <a href="#" className="flex items-center gap-2.5 font-display font-semibold text-[22px] tracking-[-0.02em] text-foreground">
          <span
            className="w-7 h-7 rounded-[8px] bg-foreground text-background grid place-items-center font-display font-semibold text-base"
            style={{ fontStyle: "italic" }}
          >
            d
          </span>
          <span>dietai</span>
        </a>

        {/* Nav links */}
        <div className="hidden md:flex items-center gap-9 text-sm text-muted-foreground">
          {["How it works", "Features", "Pricing", "FAQ"].map((label, i) => (
            <a
              key={label}
              href={["#how", "#features", "#pricing", "#faq"][i]}
              className="hover:text-foreground transition-colors whitespace-nowrap"
            >
              {label}
            </a>
          ))}
        </div>

        {/* CTA */}
        <div className="flex items-center gap-4 text-sm">
          <Link href="/sign-in" className="text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap hidden sm:block">
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="px-[18px] py-2.5 rounded-full bg-foreground text-background font-medium hover:bg-white transition-all hover:-translate-y-px whitespace-nowrap"
          >
            Start free
          </Link>
        </div>
      </div>
    </nav>
  );
}

/* ─────────────────────────────────────────────────────────────
   PRODUCT MOCK
───────────────────────────────────────────────────────────── */
function V2ProductMock() {
  const meals = [
    { time: "BREAKFAST", name: "Greek yogurt with berries & oats",  kcal: "480 kcal", protein: "32g protein", accent: "bg-brand-900/60" },
    { time: "LUNCH",     name: "Mediterranean grain bowl",           kcal: "620 kcal", protein: "38g protein", accent: "bg-sage-200/30"  },
    { time: "DINNER",    name: "Herb-crusted salmon, roasted veg",  kcal: "540 kcal", protein: "42g protein", accent: "bg-gold-200/30"  },
  ];

  return (
    <div
      className="grid h-[480px] overflow-hidden rounded-b-xl border border-border border-t-0"
      style={{ gridTemplateColumns: "200px 1fr 260px" }}
    >
      {/* Sidebar */}
      <div className="border-r border-border bg-card px-4 py-5 flex flex-col gap-1 overflow-hidden">
        <div className="font-display font-semibold text-base text-foreground mb-4">dietai</div>

        {[
          { label: "This week",    active: true  },
          { label: "Recipes",      active: false },
          { label: "Grocery list", active: false },
          { label: "Pantry",       active: false },
        ].map((item) => (
          <div
            key={item.label}
            className={`flex items-center gap-2 text-[13px] py-1.5 px-2 rounded-md ${
              item.active ? "bg-secondary text-foreground" : "text-muted-foreground"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.active ? "bg-primary" : "bg-muted-foreground/40"}`} />
            {item.label}
          </div>
        ))}

        <div className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground/60 mt-4 mb-1 px-2">Profiles</div>

        {[
          { label: "High protein",   color: "bg-brand-500" },
          { label: "Mediterranean",  color: "bg-sage-400"  },
          { label: "Family",         color: "bg-gold-300"  },
        ].map((p) => (
          <div key={p.label} className="flex items-center gap-2 text-[13px] py-1.5 px-2 text-muted-foreground">
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${p.color}`} />
            {p.label}
          </div>
        ))}
      </div>

      {/* Main */}
      <div className="bg-background px-5 py-5 flex flex-col gap-3 overflow-hidden">
        <div className="font-display font-semibold text-base text-foreground">This week</div>
        <div className="text-xs text-muted-foreground font-mono">Nov 3 – Nov 9 · 4 meals planned today</div>

        {/* Week strip */}
        <div className="flex gap-0.5 mt-1">
          {["M","T","W","T","F","S","S"].map((d, i) => (
            <div key={i} className={`flex-1 flex flex-col items-center gap-0.5 py-1.5 rounded-lg ${i === 2 ? "bg-primary/20" : ""}`}>
              <span className="text-[10px] text-muted-foreground font-mono">{d}</span>
              <span className={`text-xs font-medium ${i === 2 ? "text-primary" : "text-foreground"}`}>{3 + i}</span>
              <span className={`w-1 h-1 rounded-full ${i < 4 ? "bg-primary/60" : "bg-border"}`} />
            </div>
          ))}
        </div>

        {/* Meals */}
        <div className="flex flex-col gap-1.5 mt-1">
          {meals.map((m, i) => (
            <div key={i} className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-card border border-border">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-8 h-8 rounded-md flex-shrink-0 ${m.accent}`} />
                <div className="min-w-0">
                  <div className="text-[9px] font-mono tracking-widest uppercase text-muted-foreground">{m.time}</div>
                  <div className="text-[11px] text-foreground leading-tight truncate">{m.name}</div>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="text-[10px] font-semibold text-foreground">{m.kcal}</div>
                <div className="text-[10px] text-muted-foreground">{m.protein}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Aside */}
      <div className="border-l border-border bg-card px-4 py-5 flex flex-col gap-3 overflow-hidden">
        <div className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground">Today&apos;s nutrition</div>

        {/* Donut */}
        <div className="flex items-center gap-3">
          <div className="relative w-[60px] h-[60px] flex-shrink-0">
            <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
              <circle cx="18" cy="18" r="14" fill="none" strokeWidth="3.5" className="stroke-border" />
              <circle
                cx="18" cy="18" r="14" fill="none" strokeWidth="3.5"
                strokeDasharray="60 40" strokeLinecap="round"
                className="stroke-primary"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-foreground">68%</span>
          </div>
          <div className="flex flex-col gap-1 text-[11px]">
            {[
              { color: "bg-primary",   label: "Protein · 112g" },
              { color: "bg-sage-500",  label: "Carbs · 184g"   },
              { color: "bg-gold-300",  label: "Fats · 62g"     },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color}`} />
                <span className="text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* AI agent bubble */}
        <div className="flex items-start gap-2 p-3 rounded-xl bg-secondary border border-border">
          <div
            className="w-6 h-6 rounded-md bg-primary flex-shrink-0 grid place-items-center font-display text-xs text-background"
            style={{ fontStyle: "italic" }}
          >
            d
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Your week is balanced.{" "}
            <span className="text-foreground font-medium">Swap Thursday&apos;s lunch</span>{" "}
            for more iron? You&apos;re trending 12% under target.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   HERO
───────────────────────────────────────────────────────────── */
function V2Hero() {
  return (
    <header className="relative pt-24 pb-14 md:pt-[100px] md:pb-20 px-8 overflow-hidden isolate">
      {/* Animated background */}
      <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden" aria-hidden="true">
        {/* Dotted grid */}
        <div
          className="absolute inset-0 opacity-[0.18]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, rgba(250,249,247,0.4) 1px, transparent 0)",
            backgroundSize: "28px 28px",
            WebkitMaskImage: "radial-gradient(ellipse 70% 70% at 50% 35%, #000 30%, transparent 75%)",
            maskImage: "radial-gradient(ellipse 70% 70% at 50% 35%, #000 30%, transparent 75%)",
          }}
        />
        {/* Warm top glow */}
        <div
          className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[1200px] h-[700px] opacity-60"
          style={{
            background: "radial-gradient(ellipse 50% 60% at 50% 40%, rgba(244,123,92,0.18) 0%, transparent 60%)",
            filter: "blur(20px)",
          }}
        />
        {/* Orbs */}
        <span
          className="absolute rounded-full animate-drift-1"
          style={{ width: 380, height: 380, top: "8%", left: "58%",
            background: "radial-gradient(circle, rgba(244,123,92,0.35), transparent 70%)",
            filter: "blur(60px)", opacity: 0.5 }}
        />
        <span
          className="absolute rounded-full animate-drift-2"
          style={{ width: 300, height: 300, top: "35%", left: "5%",
            background: "radial-gradient(circle, rgba(107,155,107,0.4), transparent 70%)",
            filter: "blur(60px)", opacity: 0.28 }}
        />
        <span
          className="absolute rounded-full animate-drift-3"
          style={{ width: 240, height: 240, top: "55%", left: "74%",
            background: "radial-gradient(circle, rgba(251,191,36,0.3), transparent 70%)",
            filter: "blur(60px)", opacity: 0.22 }}
        />
        {/* Sparks */}
        {[
          { top: "18%", left: "20%", delay: "0s"   },
          { top: "60%", left: "30%", delay: "1.2s" },
          { top: "30%", left: "78%", delay: "0.6s" },
          { top: "72%", left: "62%", delay: "1.8s" },
        ].map((s, i) => (
          <span
            key={i}
            className="absolute animate-spark"
            style={{ top: s.top, left: s.left, width: 4, height: 4,
              borderRadius: "50%", background: "rgba(244,123,92,0.8)",
              animationDelay: s.delay }}
          />
        ))}
      </div>

      <div className="max-w-[1180px] mx-auto">
        {/* Eyebrow badge */}
        <div className="animate-hero-in inline-flex items-center px-3 py-1 rounded-full border border-border bg-secondary text-[11px] font-mono tracking-[0.16em] uppercase text-primary mb-8">
          Now in private beta
        </div>

        {/* Headline — em gets color from text-primary, italic comes from the <em> element's default style */}
        <h1
          className="animate-hero-in-d1 font-display font-medium text-foreground leading-[1.05] tracking-[-0.02em] mb-6"
          style={{ fontSize: "clamp(48px, 8vw, 80px)", maxWidth: "14ch" }}
        >
          Healthy eating,{" "}
          <em className="text-primary">simplified.</em>
        </h1>

        {/* Subtitle */}
        <p className="animate-hero-in-d2 text-[17px] text-muted-foreground leading-relaxed mb-8" style={{ maxWidth: "46ch" }}>
          DietAI plans your meals around your nutrition goals, builds the recipes,
          and ships the grocery list — so eating well takes minutes a week, not hours.
        </p>

        {/* CTA buttons */}
        <div className="animate-hero-in-d2 flex flex-wrap gap-3 mb-10">
          <Link
            href="/sign-up"
            className="px-5 py-3 rounded-full bg-foreground text-background text-sm font-medium hover:bg-white transition-all hover:-translate-y-px"
          >
            Start your meal plan →
          </Link>
          <a
            href="#how"
            className="px-5 py-3 rounded-full border border-border text-foreground text-sm font-medium hover:border-foreground transition-colors"
          >
            See it in action
          </a>
        </div>

        {/* Social proof */}
        <div className="animate-hero-in-d3 flex items-center gap-3 mb-16">
          <div className="flex -space-x-2">
            {[
              { bg: "bg-brand-800", initials: "JD" },
              { bg: "bg-sage-700",  initials: "AK" },
              { bg: "bg-gold-200",  initials: "MS" },
              { bg: "bg-secondary", initials: "RT" },
            ].map(({ bg, initials }) => (
              <div
                key={initials}
                className={`w-7 h-7 rounded-full border-2 border-background ${bg} flex items-center justify-center text-[10px] font-medium text-foreground`}
              >
                {initials}
              </div>
            ))}
          </div>
          <span className="text-sm text-muted-foreground">Loved by 17,400+ home cooks &amp; nutritionists</span>
        </div>

        {/* Browser frame + product mock */}
        <div className="animate-hero-in-d3 overflow-x-auto">
          <div style={{ minWidth: 700 }}>
            {/* Chrome bar */}
            <div className="flex items-center gap-2 px-4 py-3 bg-card border border-border border-b-0 rounded-t-xl">
              <span className="w-3 h-3 rounded-full bg-[#FF5F57]" />
              <span className="w-3 h-3 rounded-full bg-[#FEBC2E]" />
              <span className="w-3 h-3 rounded-full bg-[#28C840]" />
              <span className="flex-1 mx-2 py-1 px-3 rounded-md bg-secondary text-[11px] text-muted-foreground font-mono text-center">
                dietai.app / week of nov 3
              </span>
            </div>
            <V2ProductMock />
          </div>
        </div>
      </div>
    </header>
  );
}

/* ─────────────────────────────────────────────────────────────
   HOW IT WORKS
───────────────────────────────────────────────────────────── */
function V2HowItWorks() {
  const steps = [
    {
      n: "01",
      t: "Tell us your goals",
      b: "Macros, allergies, schedule, the foods you actually like. We learn the taste behind your targets, not just the numbers.",
    },
    {
      n: "02",
      t: "Get a real plan",
      b: "A week of recipes built around what you have, what's in season, and what fits your day. Edit anything, lock favorites.",
    },
    {
      n: "03",
      t: "Skip the chore",
      b: "One grocery list, organized by aisle and pantry-aware. Send it to checkout — or hand it to your shopping agent.",
    },
  ];

  return (
    <section id="how" className="py-24 px-8">
      <div className="max-w-[1180px] mx-auto">
        {/* Section head */}
        <div className="flex flex-col md:flex-row gap-6 md:gap-16 items-start md:items-end mb-12 md:mb-16">
          <div className="flex-1">
            <div className="font-mono text-[11px] tracking-[0.16em] uppercase text-primary mb-[18px]">How it works</div>
            <h2
              className="font-display font-medium text-foreground leading-[1.05] tracking-[-0.02em]"
              style={{ fontSize: "clamp(32px, 4.5vw, 52px)", maxWidth: "18ch" }}
            >
              From goals to groceries in{" "}
              <em className="text-primary">three steps</em>.
            </h2>
          </div>
          <p className="md:max-w-[38ch] text-muted-foreground text-base leading-relaxed">
            We replaced the spreadsheet, the recipe tabs, and the &ldquo;what&apos;s for dinner?&rdquo; — with one thoughtful planner.
          </p>
        </div>

        {/* Steps grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 border-t border-border">
          {steps.map((s, i) => {
            const isLast = i === steps.length - 1;
            return (
              <div
                key={s.n}
                className={[
                  "py-8 md:py-10",
                  /* horizontal padding */
                  i === 0 ? "md:pr-8"       : "",
                  i === 1 ? "md:px-8"       : "",
                  i === 2 ? "md:pl-8"       : "",
                  /* vertical divider on desktop */
                  i < 2   ? "md:border-r border-border" : "",
                  /* horizontal divider on mobile (all but last) */
                  !isLast ? "border-b md:border-b-0 border-border" : "",
                ].filter(Boolean).join(" ")}
              >
                <div className="font-mono text-[11px] tracking-[0.16em] text-muted-foreground mb-8">{s.n}</div>
                <div className="font-display text-[26px] font-medium leading-[1.15] tracking-[-0.01em] text-foreground mb-3">{s.t}</div>
                <div className="text-[15px] text-muted-foreground leading-relaxed">{s.b}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   FEATURES
───────────────────────────────────────────────────────────── */
function V2Features() {
  const features = [
    {
      h: "Recipes that learn what you cook.",
      p: "Rate a meal once and DietAI remembers — then quietly biases toward the flavors, cuisines, and prep times you actually keep up with.",
      list: ["12,000+ chef-tested recipes", "Substitution-aware (allergies, pantry, season)", "Save your own — paste a URL, we extract"],
      flip: false,
      accent: "bg-brand-900/30",
      label: "recipe library",
    },
    {
      h: "Macros without the math.",
      p: "Tell us your goal. We do the arithmetic. Every meal plan hits your targets within a gram — while still tasting like food, not fuel.",
      list: ["Auto-balance protein, carbs, and fats", "Sync with Apple Health or Garmin", "Portion slider: drag to adjust serving size"],
      flip: true,
      accent: "bg-sage-900/40",
      label: "macro target rings",
    },
    {
      h: "A grocery list that does itself.",
      p: "Every ingredient, consolidated by aisle, adjusted for what's already in your pantry. Send to Instacart in one tap — or just screenshot it.",
      list: ["Pantry-aware (avoid buying duplicates)", "Multi-store price compare", "AI agent handles checkout end-to-end"],
      flip: false,
      accent: "bg-gold-700/20",
      label: "grocery agent",
    },
  ];

  return (
    <section id="features" className="py-24 px-8">
      <div className="max-w-[1180px] mx-auto">
        {/* Section head */}
        <div className="flex flex-col md:flex-row gap-6 md:gap-16 items-start md:items-end mb-12 md:mb-16">
          <div className="flex-1">
            <div className="font-mono text-[11px] tracking-[0.16em] uppercase text-primary mb-[18px]">Built for real kitchens</div>
            <h2
              className="font-display font-medium text-foreground leading-[1.05] tracking-[-0.02em]"
              style={{ fontSize: "clamp(32px, 4.5vw, 52px)", maxWidth: "18ch" }}
            >
              Smart enough to know{" "}
              <em className="text-primary">your</em> Tuesday.
            </h2>
          </div>
          <p className="md:max-w-[38ch] text-muted-foreground text-base leading-relaxed">
            DietAI adapts to your week, your pantry, and your preferences — instead of handing you a generic plan and walking away.
          </p>
        </div>

        {/* Feature rows */}
        {features.map((f, i) => (
          <div
            key={i}
            className={`grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20 items-center py-14 border-t border-border ${
              i === features.length - 1 ? "border-b" : ""
            }`}
          >
            {/* Text — for flip rows, order-2 on mobile puts it below, md:order-1 puts it left on desktop */}
            <div className={f.flip ? "order-2 md:order-1" : ""}>
              <h3
                className="font-display font-medium text-foreground leading-[1.1] tracking-[-0.015em] mb-4"
                style={{ fontSize: "clamp(26px, 3.5vw, 38px)", maxWidth: "14ch" }}
              >
                {f.h}
              </h3>
              <p className="text-muted-foreground text-[16px] leading-relaxed mb-6" style={{ maxWidth: "42ch" }}>
                {f.p}
              </p>
              <div className="flex flex-col gap-2.5">
                {f.list.map((item) => (
                  <div key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0 mt-[5px]" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* Visual — for flip rows, order-1 on mobile puts it above text; md:order-2 puts it right on desktop */}
            <div
              className={`aspect-[4/3.2] rounded-2xl border border-border overflow-hidden ${f.accent} ${
                f.flip ? "order-1 md:order-2" : ""
              }`}
            >
              <div className="w-full h-full flex items-center justify-center text-xs font-mono tracking-widest uppercase text-muted-foreground/40">
                {f.label}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   STATS
───────────────────────────────────────────────────────────── */
function V2Stats() {
  const stats = [
    { n: "3.4 hrs",  l: "Saved per week"      },
    { n: "17,400+",  l: "Active home cooks"    },
    { n: "12k",      l: "Tested recipes"       },
    { n: "94%",      l: "Stick to plan ≥4wk"  },
  ];

  return (
    <div className="px-8">
      <div className="max-w-[1180px] mx-auto grid grid-cols-2 md:grid-cols-4 border-t border-b border-border">
        {stats.map((s, i) => {
          const isLeftCol  = i % 2 === 0;          // 0, 2 → left column on mobile
          const isFirstRow = i < 2;                 // 0, 1 → top row on mobile
          const isLastItem = i === stats.length - 1;

          return (
            <div
              key={s.n}
              className={[
                "py-8 md:py-12 px-6",
                /* right border: always show on left-column (mobile), show on all but last on desktop */
                isLeftCol && !isLastItem ? "border-r border-border" : "",
                /* on desktop, item-1 also needs right border (it's not left col on desktop) */
                !isLeftCol && !isLastItem ? "md:border-r border-border" : "",
                /* bottom border: only first row on mobile, none on desktop */
                isFirstRow ? "border-b md:border-b-0 border-border" : "",
              ].filter(Boolean).join(" ")}
            >
              <div
                className="font-display font-medium text-primary leading-none tracking-[-0.02em] mb-2"
                style={{ fontSize: "clamp(32px, 4vw, 44px)" }}
              >
                {s.n}
              </div>
              <div className="font-mono text-[11px] tracking-[0.12em] uppercase text-muted-foreground">{s.l}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   QUOTE
───────────────────────────────────────────────────────────── */
function V2Quote() {
  return (
    <section className="py-24 px-8">
      <div className="max-w-[1180px] mx-auto">
        <div className="text-center mx-auto" style={{ maxWidth: "28ch" }}>
          <p
            className="font-display font-medium text-foreground leading-[1.2] tracking-[-0.01em]"
            style={{ fontStyle: "italic", fontSize: "clamp(26px, 4vw, 42px)" }}
          >
            <span className="text-primary not-italic">&ldquo;</span>
            It&apos;s the first nutrition tool that didn&apos;t make me feel like a project.
            <span className="text-primary not-italic">&rdquo;</span>
          </p>
          <div className="mt-8 font-mono text-sm tracking-[0.04em] text-muted-foreground">
            — Maya R., Brooklyn · 6 months on DietAI
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   PRICING
───────────────────────────────────────────────────────────── */
function V2Pricing() {
  const plans = [
    {
      name: "Taste",
      price: "0",
      period: "free, forever",
      tag: "Plan a single week, on us. No card, no expiry.",
      features: ["1 weekly meal plan", "200 starter recipes", "Basic grocery list"],
      cta: "Start free",
      featured: false,
    },
    {
      name: "Kitchen",
      price: "12",
      period: "/ month",
      tag: "The full DietAI for one cook or one household.",
      features: ["Unlimited weekly plans", "12,000+ recipe library", "Pantry & macro intelligence", "Health app sync", "Send to Instacart"],
      cta: "Start 14-day trial",
      featured: true,
    },
    {
      name: "Family",
      price: "22",
      period: "/ month",
      tag: "Multiple profiles, shared lists, kid-friendly mode.",
      features: ["Up to 5 profiles", "Shared grocery list", "Allergy-safe routing", "AI shopping agent", "Priority support"],
      cta: "Choose Family",
      featured: false,
    },
  ];

  return (
    <section id="pricing" className="py-24 px-8">
      <div className="max-w-[1180px] mx-auto">
        {/* Section head */}
        <div className="flex flex-col md:flex-row gap-6 md:gap-16 items-start md:items-end mb-12 md:mb-16">
          <div className="flex-1">
            <div className="font-mono text-[11px] tracking-[0.16em] uppercase text-primary mb-[18px]">Pricing</div>
            <h2
              className="font-display font-medium text-foreground leading-[1.05] tracking-[-0.02em]"
              style={{ fontSize: "clamp(32px, 4.5vw, 52px)", maxWidth: "18ch" }}
            >
              Simple plans for <em className="text-primary">real</em> kitchens.
            </h2>
          </div>
          <p className="md:max-w-[38ch] text-muted-foreground text-base leading-relaxed">
            Try it free for a week. No card. Cancel any time — your saved recipes go with you.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((p) => (
            <div
              key={p.name}
              className={`rounded-2xl border p-9 flex flex-col transition-colors duration-200 ${
                p.featured
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card border-border hover:border-foreground/60"
              }`}
            >
              {/* Plan name */}
              <div
                className={`font-mono text-[11px] tracking-[0.12em] uppercase mb-4 ${
                  p.featured ? "text-background/60" : "text-muted-foreground"
                }`}
              >
                {p.name}
              </div>

              {/* Price */}
              <div className="flex items-baseline gap-1.5 mb-2">
                <span
                  className="font-display font-medium leading-none tracking-[-0.02em]"
                  style={{ fontSize: 56 }}
                >
                  ${p.price}
                </span>
                <span className={`text-sm font-normal ${p.featured ? "text-background/60" : "text-muted-foreground"}`}>
                  {p.period}
                </span>
              </div>

              {/* Tagline */}
              <div className={`text-sm mb-7 leading-relaxed ${p.featured ? "text-background/75" : "text-muted-foreground"}`}>
                {p.tag}
              </div>

              {/* Features */}
              <div className="flex flex-col gap-3 mb-8 flex-1">
                {p.features.map((f) => (
                  <div
                    key={f}
                    className={`flex items-start gap-2.5 text-sm leading-relaxed ${
                      p.featured ? "text-background/75" : "text-muted-foreground"
                    }`}
                  >
                    <span className={`w-[5px] h-[5px] rounded-full mt-[9px] flex-shrink-0 ${p.featured ? "bg-[#E07A5F]" : "bg-primary"}`} />
                    {f}
                  </div>
                ))}
              </div>

              {/* CTA button */}
              <button
                className={`w-full py-3 rounded-full text-sm font-medium border transition-all duration-150 ${
                  p.featured
                    ? "bg-background text-foreground border-background hover:bg-primary hover:text-white hover:border-primary"
                    : "bg-transparent text-foreground border-border hover:bg-foreground hover:text-background hover:border-foreground"
                }`}
              >
                {p.cta} →
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   FAQ
───────────────────────────────────────────────────────────── */
function V2FAQ() {
  const items = [
    {
      q: "Do I need to log every meal?",
      a: "No. DietAI plans ahead so you don't have to log after. If you eat off-plan, one tap re-balances the rest of the week.",
    },
    {
      q: "Can I use my own recipes?",
      a: "Yes. Paste any recipe URL and DietAI extracts ingredients, scales servings, and pulls macros from our nutrition database.",
    },
    {
      q: "Is it really 'AI' or just a database?",
      a: "Both. Recipes are chef-tested; planning, substitution, and the shopping agent are model-driven. We're transparent about which is which inside the app.",
    },
    {
      q: "How does the shopping agent work?",
      a: "It compares your list across Instacart, Amazon Fresh, and Whole Foods, picks the best basket on price + availability, and asks once before checkout.",
    },
    {
      q: "What if I have allergies or restrictions?",
      a: "Set them once. Every recipe, swap, and substitution is filtered against them — including hidden ingredients and shared-equipment risk.",
    },
  ];

  const [open, setOpen] = useState<number>(0);

  return (
    <section id="faq" className="py-24 px-8">
      <div className="max-w-[1180px] mx-auto">
        {/* Section head */}
        <div className="flex flex-col md:flex-row gap-6 md:gap-16 items-start md:items-end mb-12 md:mb-16">
          <div className="flex-1">
            <div className="font-mono text-[11px] tracking-[0.16em] uppercase text-primary mb-[18px]">FAQ</div>
            <h2
              className="font-display font-medium text-foreground leading-[1.05] tracking-[-0.02em]"
              style={{ fontSize: "clamp(32px, 4.5vw, 52px)", maxWidth: "18ch" }}
            >
              Questions, <em className="text-primary">answered</em>.
            </h2>
          </div>
        </div>

        {/* Accordion */}
        <div className="border-t border-border">
          {items.map((it, i) => (
            <div
              key={i}
              className="border-b border-border py-7 cursor-pointer select-none"
              onClick={() => setOpen(open === i ? -1 : i)}
            >
              <div className="flex justify-between items-center gap-6">
                <span className="font-display font-medium text-foreground text-[20px] leading-snug tracking-[-0.01em]">
                  {it.q}
                </span>
                {/* Plus/minus icon */}
                <span
                  className="relative w-[22px] h-[22px] flex-shrink-0 transition-transform duration-300"
                  style={{ transform: open === i ? "rotate(45deg)" : "rotate(0deg)" }}
                >
                  <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[14px] h-[1.5px] bg-foreground block" />
                  <span
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1.5px] h-[14px] bg-foreground block transition-transform duration-300"
                    style={{ transform: open === i ? "rotate(90deg)" : "rotate(0deg)" }}
                  />
                </span>
              </div>
              <div
                className="overflow-hidden transition-all duration-300 ease-in-out"
                style={{ maxHeight: open === i ? 220 : 0, opacity: open === i ? 1 : 0, marginTop: open === i ? 14 : 0 }}
              >
                <p className="text-[15px] text-muted-foreground leading-relaxed" style={{ maxWidth: "60ch" }}>
                  {it.a}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   FINAL CTA
───────────────────────────────────────────────────────────── */
function V2FinalCTA() {
  return (
    <section className="pt-0 pb-24 px-8">
      <div className="max-w-[1180px] mx-auto">
        <div
          className="relative bg-foreground text-background rounded-3xl text-center overflow-hidden"
          style={{ padding: "96px 64px" }}
        >
          {/* Warm radial glow from bottom */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse 600px 300px at 50% 110%, rgba(224,122,95,0.28), transparent 70%)" }}
          />
          <h2
            className="relative font-display font-medium leading-[1.05] tracking-[-0.02em] mx-auto mb-5"
            style={{ fontSize: "clamp(32px, 5vw, 60px)", maxWidth: "18ch" }}
          >
            Eat better this week.{" "}
            <em className="text-[#E07A5F]">Cook less.</em>
          </h2>
          <p
            className="relative text-background/70 mx-auto mb-9 leading-relaxed"
            style={{ fontSize: 17, maxWidth: "46ch" }}
          >
            One plan. One list. Real recipes you actually want. Start free — your meal plan is ready in under two minutes.
          </p>
          <div className="relative flex justify-center gap-3 flex-wrap">
            <Link
              href="/sign-up"
              className="px-6 py-3.5 rounded-full bg-background text-foreground text-sm font-medium hover:bg-white transition-all"
            >
              Start your free plan →
            </Link>
            <a
              href="#how"
              className="px-6 py-3.5 rounded-full border border-background/25 text-background text-sm font-medium hover:border-background hover:bg-white/5 transition-all"
            >
              Watch the 90s tour
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────────────────────────────────────────
   FOOTER
───────────────────────────────────────────────────────────── */
function V2Footer() {
  const cols = [
    { h: "Product",   links: ["Features", "Pricing", "Recipes", "Changelog"]      },
    { h: "Resources", links: ["Journal", "Nutrition guides", "Help center", "API"] },
    { h: "Company",   links: ["About", "Careers", "Contact", "Press"]              },
  ];

  return (
    <footer className="border-t border-border px-8 pt-12 pb-16">
      <div className="max-w-[1180px] mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-12 mb-12">
          {/* Brand blurb */}
          <div className="col-span-2 md:col-span-1">
            <a href="#" className="inline-flex items-center gap-2.5 font-display font-semibold text-[20px] tracking-[-0.02em] text-foreground mb-4">
              <span
                className="w-6 h-6 rounded-[6px] bg-foreground text-background grid place-items-center font-display font-semibold text-sm"
                style={{ fontStyle: "italic" }}
              >
                d
              </span>
              dietai
            </a>
            <p className="text-sm text-muted-foreground leading-relaxed" style={{ maxWidth: "34ch" }}>
              Healthy eating, simplified — meal plans, recipes, and a grocery list that does itself.
            </p>
          </div>

          {/* Link columns */}
          {cols.map((col) => (
            <div key={col.h}>
              <h4 className="font-mono text-[11px] tracking-[0.12em] uppercase text-muted-foreground mb-[18px] font-medium">{col.h}</h4>
              <ul className="flex flex-col gap-2.5">
                {col.links.map((l) => (
                  <li key={l}>
                    <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-6 border-t border-border">
          <span className="text-[13px] text-muted-foreground">
            © 2026 DietAI Labs · Made for cooks who&apos;d rather be cooking.
          </span>
          <div className="flex gap-6 text-[13px]">
            <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Privacy</a>
            <a href="#" className="text-muted-foreground hover:text-foreground transition-colors">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

/* ─────────────────────────────────────────────────────────────
   PAGE — forces dark mode via `.dark` wrapper
───────────────────────────────────────────────────────────── */
export default function LandingV2Page() {
  return (
    <div className="dark">
      <div className="min-h-screen bg-background text-foreground antialiased">
        <V2Nav />
        <main>
          <V2Hero />
          <V2HowItWorks />
          <V2Features />
          <V2Stats />
          <V2Quote />
          <V2Pricing />
          <V2FAQ />
          <V2FinalCTA />
        </main>
        <V2Footer />
      </div>
    </div>
  );
}
