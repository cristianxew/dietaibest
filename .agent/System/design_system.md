# DietAI Design System - "Culinary Elegance"

**Last Updated:** 2026-09-27

## Related Documentation
- [Project Architecture](./project_architecture.md)
- [README Index](../README.md)

---

## Table of Contents
1. [Design Philosophy](#design-philosophy)
2. [Color System](#color-system)
3. [Typography](#typography)
4. [Semantic Tokens](#semantic-tokens)
5. [Component Styling Patterns](#component-styling-patterns)
6. [Landing Page Components](#landing-page-components)
7. [Utility Classes](#utility-classes)
8. [Dark Mode Implementation](#dark-mode-implementation)
9. [Responsive & Touch Conventions](#responsive--touch-conventions)
10. [Best Practices](#best-practices)

---

### Frontend Aesthetics

You tend to converge toward generic, "on distribution" outputs. In frontend design, this creates what users call the "AI slop" aesthetic. Avoid this: make creative, distinctive frontends that surprise and delight. Focus on:

Typography: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt instead for distinctive choices that elevate the frontend's aesthetics.

Color & Theme: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes. Draw from IDE themes and cultural aesthetics for inspiration.

Motion: Use animations for effects and micro-interactions. Prioritize CSS-only solutions for HTML. Use Motion library for React when available. Focus on high-impact moments: one well-orchestrated page load with staggered reveals (animation-delay) creates more delight than scattered micro-interactions.

Backgrounds: Create atmosphere and depth rather than defaulting to solid colors. Layer CSS gradients, use geometric patterns, or add contextual effects that match the overall aesthetic.

Avoid generic AI-generated aesthetics:
- Overused font families (Inter, Roboto, Arial, system fonts)
- Clichéd color schemes (particularly purple gradients on white backgrounds)
- Predictable layouts and component patterns
- Cookie-cutter design that lacks context-specific character

Interpret creatively and make unexpected choices that feel genuinely designed for the context. Vary between light and dark themes, different fonts, different aesthetics. You still tend to converge on common choices (Space Grotesk, for example) across generations. Avoid this: it is critical that you think outside the box!

## Design Philosophy

### Aesthetic: "Culinary Elegance"
The DietAI design system embodies **sophisticated warmth inspired by editorial food magazines and high-end culinary experiences**. It combines:
- Warm terracotta and coral tones that evoke appetite and culinary excellence
- Sage green reserved for health indicators and success states
- Gold accents for premium, luxurious touches
- A distinctive serif display font for editorial sophistication
- Deep charcoal dark mode with warm gold accents

### Core Principles
1. **Warmth & Appetite** - Use warm coral/terracotta as primary color to evoke food and culinary experiences
2. **Meaningful Color Semantics** - Green (sage) reserved for health/success, not primary actions
3. **Premium Feel** - Gold accents add luxury without overwhelming
4. **Editorial Typography** - Serif display font (Playfair Display) for headlines adds sophistication
5. **Accessibility** - Maintain proper contrast ratios in both light and dark modes

---

## Color System

### Primary Palette: Coral/Terracotta
The primary brand color is a warm coral/terracotta representing warmth, appetite, and culinary excellence:

```css
--brand-50: #FEF3F0;    /* Lightest tint */
--brand-100: #FDE4DC;
--brand-200: #FBC6B8;
--brand-300: #F8A08A;
--brand-400: #F47B5C;
--brand-500: #E07A5F;   /* Primary brand color */
--brand-600: #C96A52;
--brand-700: #A85544;
--brand-800: #874337;
--brand-900: #6B352C;
--brand-950: #3D1D18;   /* Darkest shade */
```

### Secondary Palette: Sage Green (Success/Health)
Reserved for health indicators, success states, and nutritional metrics:

```css
--sage-50: #F4F7F4;
--sage-100: #E6EDE6;
--sage-200: #C9D9C9;
--sage-300: #9FBC9F;
--sage-400: #6B9B6B;
--sage-500: #4A7C59;    /* Success/health primary */
--sage-600: #3D6B4A;
--sage-700: #32573C;
--sage-800: #2A4632;
--sage-900: #233A2A;
```

### Accent Palette: Gold/Amber (Premium)
For premium highlights, badges, and special features:

```css
--gold-50: #FFFBEB;
--gold-100: #FEF3C7;
--gold-200: #FDE68A;
--gold-300: #FCD34D;
--gold-400: #FBBF24;
--gold-500: #D4A017;    /* Premium accent */
--gold-600: #B8860B;
--gold-700: #92400E;
```

### Neutral Palette: Warm Stone
Warm stone tones for backgrounds and text:

```css
/* Light Mode */
--stone-50: #FAF9F7;    /* Background */
--stone-100: #F5F3EF;   /* Elevated surfaces */
--stone-200: #E8E4DD;   /* Borders */
--stone-300: #D4CEC4;
--stone-400: #A8A092;
--stone-500: #7A7367;   /* Muted text */
--stone-600: #5C574D;
--stone-700: #423F38;
--stone-800: #2D2B26;
--stone-900: #1C1A17;   /* Foreground text */

/* Dark Mode */
--slate-950: #0F0E0D;   /* Background */
--slate-900: #1A1918;   /* Cards */
--slate-800: #262422;   /* Elevated */
--slate-700: #3D3A36;   /* Borders */
```

---

## Typography

### Font Stack
Three font families are used across the application:

```css
--font-display: 'Playfair Display', Georgia, serif;    /* Headlines, display */
--font-sans: 'DM Sans', 'Inter', system-ui, sans-serif; /* Body text */
--font-mono: 'Geist Mono', monospace;                   /* Code, terminal */
```

### Usage Guidelines
- **Display (Playfair Display)**: Headlines, hero text, section titles, pricing, card titles - adds editorial sophistication
- **Body (DM Sans)**: Paragraphs, descriptions, form labels, navigation links - clean and readable
- **Mono (Geist Mono)**: Terminal displays, code snippets, technical data

### Font Classes
```css
.font-display    /* Playfair Display - for headings */
.font-sans       /* DM Sans - for body text (default) */
.font-mono       /* Geist Mono - for code */
```

---

## Semantic Tokens

All components should use semantic tokens rather than raw color values.

### Light Mode Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--background` | #FAF9F7 | Page background |
| `--foreground` | #1C1A17 | Primary text |
| `--card` | #FFFFFF | Card backgrounds |
| `--card-foreground` | #1C1A17 | Card text |
| `--muted` | #F5F3EF | Subdued backgrounds |
| `--muted-foreground` | #7A7367 | Secondary text |
| `--border` | #E8E4DD | Borders and dividers |
| `--primary` | #E07A5F | Primary actions, CTAs |
| `--primary-foreground` | #FFFFFF | Text on primary |
| `--secondary` | #F5F3EF | Secondary buttons |
| `--secondary-foreground` | #5C574D | Text on secondary |
| `--accent` | #FEF3C7 | Premium highlights |
| `--accent-foreground` | #92400E | Text on accent |
| `--success` | #4A7C59 | Success states |
| `--success-foreground` | #FFFFFF | Text on success |

### Dark Mode Tokens

| Token | Value | Usage |
|-------|-------|-------|
| `--background` | #0F0E0D | Deep charcoal |
| `--foreground` | #FAF9F7 | Light text |
| `--card` | #1A1918 | Card backgrounds |
| `--primary` | #F47B5C | Brighter coral |
| `--primary-foreground` | #1C1A17 | Dark text on primary |
| `--accent` | #D4A017 | Gold highlights |
| `--success` | #6B9B6B | Brighter sage |

---

## Component Styling Patterns

### Cards
```tsx
<div className={cn(
  "p-6 rounded-2xl",
  "bg-card border border-border",
  "hover:border-brand-200 dark:hover:border-brand-500/30 hover:shadow-lg transition-all duration-300"
)}>
  {/* Card content */}
</div>
```

### Section Headers
```tsx
<div className="mb-16 max-w-2xl">
  <span className="text-xs font-semibold text-brand-600 dark:text-brand-400 uppercase tracking-widest mb-4 block">
    Section Label
  </span>
  <h2 className="text-3xl md:text-4xl font-display font-semibold text-foreground tracking-tight mb-4">
    Section Title
  </h2>
  <p className="text-muted-foreground leading-relaxed">
    Section description text.
  </p>
</div>
```

### Buttons

**Primary Button:**
```tsx
<button className="bg-primary text-primary-foreground px-6 py-3 rounded-xl font-medium shadow-lg shadow-brand-500/25 hover:shadow-xl hover:-translate-y-0.5 transition-all">
  Primary Action
</button>
```

**Secondary Button:**
```tsx
<button className="bg-card border border-border text-foreground px-6 py-3 rounded-xl font-medium hover:bg-secondary hover:border-brand-200 transition-all">
  Secondary Action
</button>
```

### Badge Variants

**Brand Badge (Coral):**
```css
.badge-brand {
  @apply bg-brand-100 text-brand-700 border border-brand-200;
}
```

**Success Badge (Sage):**
```css
.badge-success {
  @apply bg-sage-100 text-sage-700 border border-sage-200;
}
```

**Gold Badge (Premium):**
```css
.badge-gold {
  @apply bg-gold-100 text-gold-700 border border-gold-200;
}
```

---

## Landing Page Components

The marketing landing (`src/app/[locale]/(public-pages)/page.tsx`) has its **own scoped visual language** (editorial serif, sage accent) separate from the app tokens above. Source design: the "DietAI Landing" HTML prototype (saved tweaks: sage accent, italic-accent headline, cozy density = 64px section padding). All copy is translated (en/es/pl) and restricted to features that exist in the product.

### Structure
```
src/components/landing/
├── LandingShell.tsx      # Wrapper: `.landing` token scope + landing fonts, overflow-x-clip
├── LandingNav.tsx        # Client: sticky nav, border on scroll; ≥1041px section links, LanguageSwitcherCompact, ThemeToggleSimple, Sign in, Start free
├── LandingMobileMenu.tsx # Client: <1041px menu toggle + panel (section links, Sign in, language, theme)
├── LandingFooter.tsx     # Real logo, Product / Account / Legal columns, © year, LanguageSwitcherFull
├── fonts.ts              # next/font: Playfair Display (with italics) + JetBrains Mono
├── links.ts              # localizedHref(locale, route): `localePrefix` + path (`/sign-up` → `/es/sign-up`)
├── metadata.ts           # buildLandingMetadata(locale): title/description, canonical + hreflang, OG, Twitter card
├── pricing-data.ts       # server-only: loadLandingPricing(locale) — Stripe Pro prices, never throws
├── sections/
│   ├── HeroSection.tsx     # Headline, CTAs, trust items, orbs/sparks background, ProductMock
│   ├── HowItWorks.tsx      # id="how"
│   ├── FeaturesSection.tsx # id="features" — 4 zig-zag rows with mock visuals
│   ├── PricingSection.tsx  # id="pricing" — Free + Pro monthly + Pro yearly (live Stripe prices)
│   ├── FAQSection.tsx      # id="faq" — server; passes translated items to FAQAccordion
│   ├── FAQAccordion.tsx    # Client: single-open accordion (grid-rows animation, no height cap)
│   ├── FinalCTASection.tsx
│   ├── StatsStrip.tsx      # Props-only (`stats`), NOT rendered — enable only with real data
│   └── QuoteSection.tsx    # Props-only (`quote`, `attribution`), NOT rendered — enable only with a real quote
└── ui/
    ├── SectionHead.tsx     # Mono eyebrow + serif title (`<em>` = accent) + optional rhs copy
    ├── LandingButton.tsx   # primary / ghost pill link; `onInk` for dark panels; `#anchor` → <a>, route → next/link
    ├── BrandLogo.tsx       # Real logo: /Dietai_logo_light.png (light) + /Dietai_logo_dark.png (dark) via next/image
    ├── ProductMock.tsx     # Decorative planner preview (aria-hidden), LogoSymbol avatars
    └── visuals/            # Feature-row mocks (aria-hidden, server): Import, Nutrition, Shopping, Assistant
```

**Page order:** Nav · Hero · How it works · Features · Pricing · FAQ · Final CTA · Footer. StatsStrip and QuoteSection stay commented out in `page.tsx` until there is real, verifiable content for them.

**Also part of the landing:** `src/app/[locale]/(public-pages)/opengraph-image.tsx` (localized 1200×630 social card) and `landing.*` in `messages/{en,es,pl}.json`.

### Content rules
- Claim only shipped features (recipe import, USDA nutrition, targets, meal planner, shopping list, Poland-only cart filling that never checks out, AI assistant, AI recipe photos, en/es/pl). No testimonials, user counts, wearables, US grocery stores, pantry/food/weight logging, AI-generated meal plans, or links to the Nutrition Hub.
- Every user-facing string (aria-labels included) lives under `landing.*`; only the brand name, arrows and quote marks are literal. Accents use rich text: `t.rich("title", { em: (c) => <em>{c}</em> })`. Numbers and units go through ICU (`landing.units.grams` = `"{value, number} g"`) so they format per locale; weekday initials come from `Intl.DateTimeFormat(locale, { weekday: "narrow" })`.
- Spanish is Spain Spanish with tuteo (no voseo), matching the app's newer copy.
- `tests/unit/i18n-landing-parity.test.ts` enforces key parity, `{days}` in every trial string, and matching ICU args / rich tags across locales.

### Data, links and metadata
- **Pricing:** `loadLandingPricing` resolves `pro_{monthly|yearly}_{currency}` via `resolvePrice` (currency from `currencyForLocale`), 3 s timeout per price, `Promise.allSettled`, logs failures. A failed price hides its card; if both fail, one Pro card shows "{days}-day free trial" instead of an amount. The Free card always renders. Yearly shows "Save N%" only when both prices loaded and N > 0. `formatPrice` (`src/lib/format-price.ts`) is shared with the subscribe page. Trial length is `getTrialDays()`.
- **Links:** routes use `localizedHref(locale, …)` (`/sign-in`, `/sign-up`, `/privacy`, `/terms`, `/cookies`, home); in-page anchors stay `#…`. No `href="#"` placeholders.
- **Metadata:** `generateMetadata` → `buildLandingMetadata`; `metadataBase` from `NEXTAUTH_URL` (ignored if unset/invalid). The root layout sets `<html lang>` from next-intl `getLocale()`.
- **OG image:** none for now. A file-based `src/app/[locale]/(public-pages)/opengraph-image.tsx` (with `generateImageMetadata`) shipped in #42 and made metadata resolution throw in **production builds only** for every page under `(public-pages)` (landing, sign-in, sign-up, forgot-password, auth/*): no `og:*` tags, a `data-dgst` error boundary in the HTML, and a client-side "Application error" + reload loop. `next dev` rendered it fine. It was removed in the hotfix. Before re-adding a social image, verify with a local production build (`bun run build` + `node .next/standalone/server.js`, then request `/pl` — the default-locale `/` rewrite self-redirects on localhost) and check for `data-dgst` markers; a static `public/og.png` referenced from `buildLandingMetadata` is the low-risk option.

### Tokens (`.landing` scope)
- Defined in the `/* ─── Landing ─── */` block of `src/app/globals.css` on `.landing`, overridden under `.dark .landing` (light = design, dark = derived from the app dark palette).
- Registered in `@theme inline` as `--color-lp-*`, so use utilities: `bg-lp-bg`, `text-lp-fg-soft`, `border-lp-line`, `bg-lp-bg/78`, etc. Tokens: `bg`, `bg-soft`, `fg`, `fg-soft`, `fg-strong`, `muted`, `line`, `line-soft`, `card`, `primary(-soft|-tint)`, `coral(-soft|-tint)`, `sage(-tint)`, `gold(-soft|-tint)`, `ink`, `ink-fg`, `ink-line` (dark panels), plus `--lp-frame-shadow` (`shadow-(--lp-frame-shadow)`, product mock) and `--lp-card-shadow` (`shadow-(--lp-card-shadow)`, cards inside feature visuals).
- Fonts: `font-lp-display` (Playfair, italics loaded) and `font-lp-mono` (JetBrains Mono); body uses `font-sans` (DM Sans).
- The CSS block only holds what is awkward as utilities: tokens, keyframes, hero background (`.lp-hero-bg`), orbs/sparks (`.lp-orb*`, `.lp-spark*`), hero entrance (`.lp-hero-in*`), the feature-visual dot grid (`.lp-dots`) and a `prefers-reduced-motion` guard. Everything else is Tailwind utilities.

### Gotchas
- Global base styles target every `h1`–`h6`: landing headings must set font family, size, weight, line-height, tracking and color explicitly.
- Use `overflow-x-clip`, never `overflow-x-hidden`, on the wrapper (hidden breaks the sticky nav).
- Breakpoints mirror the design's `max-width: N` as `max-[N+1px]` (Tailwind's `max-[Npx]` is `width < N`).
- The app theme overrides the radius scale (`rounded-lg` = 12px), so landing radii are explicit (`rounded-[8px]`).
- Nav below 1041px: the bar keeps only logo, "Start free" and a Menu/X toggle; section links, Sign in, language and theme live in the mobile panel. The panel is a **non-modal, non-portaled** Radix Dialog (`@radix-ui/react-dialog`, what `Sheet` wraps) rendered inside the sticky `<nav>`: a portal would escape the `.landing` token scope, the shadcn `Sheet` close button has a hardcoded English label, and a modal overlay would cover the bar toggle. It closes on Escape, outside click, focus leaving it and link clicks; focus starts on the first link and returns to the toggle (except after following a link).
- Feature-visual frames use `aspect-[4/3.2]` **without** `overflow-hidden`, so the ratio is a minimum and the frame grows with its mock on narrow columns instead of clipping it.
- Anchored sections carry `scroll-mt-[68px]` so the sticky nav does not cover their heading.

---

## Utility Classes

### Text Gradients
```css
.text-gradient-brand {
  background-image: linear-gradient(135deg, var(--brand-500) 0%, var(--gold-500) 50%, var(--brand-400) 100%);
}

.text-gradient-warm {
  background-image: linear-gradient(135deg, #E07A5F 0%, #D4A017 100%);
}

.text-gradient-sunset {
  background-image: linear-gradient(135deg, #F47B5C 0%, #FBBF24 50%, #E07A5F 100%);
}
```

### Glass Effect
```css
.glass {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(16px) saturate(180%);
  border: 1px solid rgba(228, 221, 213, 0.5);
}

.dark .glass {
  background: rgba(28, 25, 23, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.05);
}
```

### Glow Effects
```css
.glow-brand {
  box-shadow: 0 0 20px -5px var(--brand-500);
}

.glow-gold {
  box-shadow: 0 0 20px -5px var(--gold-500);
}

.glow-success {
  box-shadow: 0 0 20px -5px var(--sage-500);
}
```

### Gradient Blobs
```css
.blob-brand {
  background: linear-gradient(135deg, var(--brand-100), var(--brand-300));
}

.blob-warm {
  background: linear-gradient(135deg, #FDE4DC, #FBC6B8);
}

.blob-gold {
  background: linear-gradient(135deg, #FEF3C7, #FDE68A);
}

.blob-sunset {
  background: linear-gradient(135deg, #FDE4DC 0%, #FEF3C7 50%, #FBC6B8 100%);
}
```

---

## Dark Mode Implementation

### Strategy
- CSS variables change based on `.dark` class on `<html>`
- `next-themes` handles theme switching and persistence
- System preference detection enabled by default
- Warm gold accents in dark mode for premium feel

### Dark Mode Color Shifts
- Primary coral becomes brighter (#F47B5C) for visibility
- Accent shifts to gold (#D4A017) for warmth
- Backgrounds use deep charcoal (#0F0E0D) not pure black
- Borders use warm stone (#3D3A36)

### ThemeToggle Component
Located at `src/components/ui/ThemeToggle.tsx`

```tsx
import { ThemeToggleSimple } from "@/components/ui/ThemeToggle";

// In navigation
<ThemeToggleSimple size="sm" />
```

---

## Responsive & Touch Conventions

Introduced with the meal plans responsive pass. Source of truth: `src/lib/responsive.ts`.

- **Tiers:** phone `<=639px`, tablet `640-1023px`, desktop `>=1024px`. Use `getViewportTier()` / `useMediaQuery` (`src/hooks/use-media-query.ts`) in JS and `sm:` / `lg:` in CSS. Tablet is NOT treated as phone.
- **Touch targets:** anything tappable is at least 44x44 CSS px on touch (`min-h-11 min-w-11`, or padding / hit slop while keeping the visual size small). Nothing may be hover-only; reveal on touch with `[@media(hover:hover)]:` variants.
- **Viewport units:** use `dvh` / `min-h-dvh`, never `vh`, so mobile browser chrome does not break layouts.
- **Sticky offsets:** never hard-code `top-[NNpx]`. Measure the toolbar with `useHeightCssVar` (`src/hooks/use-height-css-var.ts`) and consume the CSS variable.
- **Bottom sheets:** `DialogContent` / `AlertDialogContent` accept an opt-in `mobileSheet` prop (classes in `src/components/ui/mobile-sheet.ts`). Below `sm` they anchor to the bottom with `90dvh` max height and safe-area padding; from `sm` up they stay centred modals. Default is off, so other dialogs are unchanged.
- **Horizontal overflow:** flex children that hold page content need `min-w-0` (the app shell `<main>` in `AppSidebarDock` has it) so intrinsic width can't widen the document. Carousel cards get a fixed width (`w-[200px] sm:w-[240px] lg:w-[260px]`) and clamp long titles (`line-clamp-2`) instead of `min-w-*` alone.
- **Drag and drop:** dnd-kit uses `MouseSensor`, `KeyboardSensor` and a long-press `TouchSensor` (200ms delay, 8px tolerance) so page scroll keeps working; every drag action also has a tap alternative (recipe picker, day sheet).
- **Tap to schedule:** on the Calendar tab, tapping/clicking an empty day that is today or later opens a plan picker (`Dialog` with `mobileSheet`). Picker and drag-and-drop both call `schedulePlanOnDate`, with date rules in `src/lib/meal-plan-schedule.ts` (`canScheduleOn`, `overlapsSchedule`).
- **Floating chat button:** the fixed chat FAB (`ChatFAB`, `h-14` at `bottom-6`) overlaps page bottoms, so scroll content ends with `pb-[calc(env(safe-area-inset-bottom)+6rem)]` below `lg` and `lg:pb-24` from `lg` up (the FAB never hides on desktop, so the last row must clear it there too). Padding only helps at the end of a page, so below `lg` the FAB also slides off-screen on scroll down and returns on scroll up (`useHideOnAnyScroll` in `src/hooks/use-hide-on-scroll.ts`, same 8px tolerance and step logic as the toolbar's `useHideOnScroll`). Pages scroll in nested containers, so it listens for `scroll` on `document` in the capture phase and tracks direction per scroll target; carousels that only scroll sideways are ignored. While hidden it is `pointer-events-none`, `inert` and `aria-hidden`; it never hides while the chat is open, near the top of the scrolled container, or from `lg` up, and `motion-reduce` drops the slide.
- **Phone simplifications:** the meal planner offers Stack and Split on phones and hides Grid (a stored Grid choice renders as Stack via `effectiveLayout` and returns on wider tiers), and hides the header description (on wider tiers it only shows while the user has no plans). Tabs use short text-only labels on phones and icon + short label on tablets, with full labels from `lg`. Snap carousels inside `-mx-* px-*` gutters also set a matching `scroll-px-*` so snapped cards align with the gutter.
- **Meal plans mirrors the recipes toolbar (below `lg`):** the tab bar is a sticky full-bleed `bg-background/95 backdrop-blur-md` bar that hides on scroll down via `useHideOnScroll` (`HideOnScrollBar` in `MealPlanner.tsx`, pinned while an overlay is open); tabs are a 36px segmented control with a vertical `::after` hit slop to 44px; "Create Plan" / "Generate with AI" sit in the page header; phones get layout/density/servings in a bottom `ViewOptionsDrawer` (the inline controls row shows from `sm`). Drawer chips are the shared `FilterChip` / `FilterSection` (`src/components/custom-ui/filter-chip.tsx`), also used by the recipes filters drawer. On phones Stack/Split render meals as flat rows (`MealCell variant="row"`) and slot columns start at `sm`.
- **Text:** meaningful labels are at least 12px on touch (`touch:text-xs`). On pointer devices nothing in the meal planner (`src/components/meal-plans/`) goes below 11px (`text-[11px]`, `Chip` `xs`), and tiny labels inside `<h*>` elements (e.g. the accordion trigger in `MicronutrientPanel`) set `font-sans`, since headings inherit the display serif.
- **Returning from a recipe:** links into a recipe page carry the page they came from as `?from=<in-app path>` (`recipeHref(locale, id, from)` / `withReturnPath` in `src/lib/recipe-back-link.ts`; meal plans pass `mealPlansReturnPath(planId)`, the dashboard `/dashboard`, chat links the page the chat is open on). The recipe page resolves "Back" with `resolveRecipeBackLink`: only same-site paths are honored (anything else falls back to the library), recipe forms are never a target, and the label is "Back to Meal Plans / Dashboard / Recipes" or a generic "Back". On phones, tapping a meal row opens its recipe page.
- **One scroll container per page:** full-height pages with their own scroller (the meal planner) must not have siblings in `#main-content`; render extras (e.g. `PlannerNutritionBanner`) inside that scroller, or the shell scrolls too and the offset leaks into the next page.
- **Testing:** Playwright `mobile` (iPhone 13) and `tablet` (iPad gen 7) projects run only `*.responsive.spec.ts`. The share page spec needs `E2E_SHARE_TOKEN`; the meal plans spec needs `E2E_STORAGE_STATE` (storage state of a signed-in session). Both skip without them.

---

## Best Practices

### DO:
1. **Use semantic tokens** - Always use `text-foreground`, `bg-card`, `border-border`, etc.
2. **Use brand colors for CTAs** - Primary actions use coral (`bg-primary`)
3. **Reserve sage green for success/health** - Don't use green for primary buttons
4. **Use gold sparingly** - For premium badges and special highlights only
5. **Use the font-display class** for headings (Playfair Display)
6. **Test in both themes** before committing changes
7. **Make hover-revealed actions touch-safe** - Tailwind v4 only applies `hover:`/`group-hover:` on devices that can hover, so pair them with `pointer-coarse:` variants (e.g. `pointer-coarse:opacity-100 pointer-coarse:pointer-events-auto`) or hide the action on touch and expose it elsewhere. See [recipes responsive pass](../Tasks/recipes_responsive_mobile.md)
8. **Use `text-base` (16px) inputs on touch screens** - smaller text makes iOS Safari zoom on focus (`text-base lg:text-sm`)

### DON'T:
1. **Don't overuse the primary coral** - Use secondary and muted styles for less important elements
2. **Don't use raw color values** like `bg-green-500` directly
3. **Don't use green for primary actions** - Reserve for health/success
4. **Don't skip dark mode testing**
5. **Don't create new color variables** without updating both themes

### Macro Display Colors
For nutritional/macro displays, use semantic colors:
- **Calories**: Coral (`brand-500`)
- **Protein**: Slate blue (`#64748B`)
- **Carbs**: Gold (`gold-500`)
- **Fat**: Coral/Brand (`brand-400`)
- **Fiber**: Sage (`sage-500`)

### Status Colors
- **On Track**: Sage green (`sage-*`)
- **Under Target**: Gold (`gold-*`)
- **Over Target**: Coral (`brand-*`)

---

## File Reference

### Core Files
| File | Purpose |
|------|---------|
| `src/app/globals.css` | Design system CSS variables and utilities |
| `src/app/layout.tsx` | Font loading (Playfair Display, DM Sans, Geist Mono) |
| `src/lib/meal-plan-macros.ts` | Macro status color functions |
| `src/components/ui/ThemeToggle.tsx` | Theme switcher component |

### Landing Page Files
| File | Purpose |
|------|---------|
| `src/components/landing/LandingShell.tsx` | `.landing` token scope + landing fonts |
| `src/components/landing/fonts.ts` | Landing fonts (Playfair with italics, JetBrains Mono) |
| `src/components/landing/sections/HeroSection.tsx` | Hero with orb background + `ProductMock` |
| `src/components/landing/pricing-data.ts` | Server-only Stripe price loader for the pricing section |
| `src/components/landing/metadata.ts` | Localized metadata, hreflang alternates, OG/Twitter |
| `src/app/[locale]/(public-pages)/opengraph-image.tsx` | Localized OG image (`/{locale}/opengraph-image-<hash>/og.png`) |
| `src/app/globals.css` (`/* ─── Landing ─── */` block) | `--lp-*` tokens (light/dark), keyframes, hero/orb classes, `.lp-dots` |
| `messages/{en,es,pl}.json` → `landing` | All landing copy |

---

## Migration from "Botanical Precision"

If updating components from the old green-based design system:

1. Replace primary green with coral:
   - `text-green-*` → `text-brand-*`
   - `bg-green-*` → `bg-brand-*`
   - `border-green-*` → `border-brand-*`

2. Use sage for success/health only:
   - Success badges: `bg-sage-*`
   - Health indicators: `text-sage-*`
   - "On track" status: `sage-*`

3. Use gold for premium highlights:
   - Special badges: `bg-gold-*`
   - Premium features: `text-gold-*`
   - "Under target" status: `gold-*`

4. Update font classes:
   - Headlines: `font-display` (now Playfair Display)
   - Body: default (now DM Sans)

---

**End of Design System Documentation**
