# DietAI Design System - "Culinary Elegance"

**Last Updated:** 2025-12-11

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
9. [Best Practices](#best-practices)

---

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

### Location
All landing page components are in `src/components/landing/`:

```
src/components/landing/
├── LandingLayout.tsx      # Main container with warm gradient blobs
├── LandingNav.tsx         # Navigation bar
├── LandingFooter.tsx      # Footer with links
├── sections/
│   ├── HeroSection.tsx    # Hero with sunset gradient text
│   ├── FeaturesGrid.tsx   # Feature cards grid
│   ├── HowItWorks.tsx     # Step-by-step workflow
│   └── PricingSection.tsx # Pricing tiers
└── ui/
    ├── AnimatedBadge.tsx  # Pulsing status badge (gold, brand, success variants)
    ├── FeatureCard.tsx    # Feature card component
    ├── PricingCard.tsx    # Pricing tier card (coral gradient highlight)
    ├── StepItem.tsx       # Numbered step item
    ├── TerminalCard.tsx   # Terminal/code display
    └── DashboardPreview.tsx # Mock dashboard visual
```

### Component Guidelines

#### AnimatedBadge
Variants: `default`, `success`, `warning`, `info`, `gold`, `brand`
```tsx
<AnimatedBadge variant="gold" pulse>
  AI Agent V2.0 Live
</AnimatedBadge>
```

#### FeatureCard
```tsx
<FeatureCard
  icon="solar:link-bold-duotone"
  iconColor="text-brand-600 dark:text-brand-400"
  iconBg="bg-brand-50 border-brand-100"
  title="Smart Import"
  description="Description text..."
/>
```

#### PricingCard
```tsx
<PricingCard
  name="Pro Chef"
  price="$12"
  period="/mo"
  features={["Feature 1", "Feature 2"]}
  buttonText="Start Trial"
  highlighted={true}  // Coral gradient background
  badge="Recommended"  // Gold badge
/>
```

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

## Best Practices

### DO:
1. **Use semantic tokens** - Always use `text-foreground`, `bg-card`, `border-border`, etc.
2. **Use brand colors for CTAs** - Primary actions use coral (`bg-primary`)
3. **Reserve sage green for success/health** - Don't use green for primary buttons
4. **Use gold sparingly** - For premium badges and special highlights only
5. **Use the font-display class** for headings (Playfair Display)
6. **Test in both themes** before committing changes

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
| `src/components/landing/LandingLayout.tsx` | Page container with warm gradients |
| `src/components/landing/sections/HeroSection.tsx` | Hero with sunset gradient |
| `src/components/landing/ui/AnimatedBadge.tsx` | Badge with gold/brand variants |
| `src/components/landing/ui/PricingCard.tsx` | Pricing with coral highlight |

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
