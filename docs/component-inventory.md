# DietAI — Component Inventory

> Generated: 2026-03-07 | Scan Level: Quick (pattern-based) | Version: 1.2.0

## Overview

- **Total components**: ~153 `.tsx` files in `src/components/`
- **System**: shadcn/ui + Radix UI primitives + custom feature components
- **Rule**: Never modify `src/components/ui/` — managed by shadcn CLI

---

## Component Categories

### 1. UI Primitives (`src/components/ui/`)
Managed by shadcn/ui. Do not modify manually — use `shadcn add` / `shadcn update`.

Based on the Radix UI dependencies in `package.json`, the following shadcn components are installed:

| Component | Radix Primitive |
|---|---|
| Accordion | @radix-ui/react-accordion |
| Alert Dialog | @radix-ui/react-alert-dialog |
| Aspect Ratio | @radix-ui/react-aspect-ratio |
| Avatar | @radix-ui/react-avatar |
| Checkbox | @radix-ui/react-checkbox |
| Collapsible | @radix-ui/react-collapsible |
| Context Menu | @radix-ui/react-context-menu |
| Dialog | @radix-ui/react-dialog |
| Dropdown Menu | @radix-ui/react-dropdown-menu |
| Hover Card | @radix-ui/react-hover-card |
| Label | @radix-ui/react-label |
| Menubar | @radix-ui/react-menubar |
| Navigation Menu | @radix-ui/react-navigation-menu |
| Popover | @radix-ui/react-popover |
| Progress | @radix-ui/react-progress |
| Radio Group | @radix-ui/react-radio-group |
| Scroll Area | @radix-ui/react-scroll-area |
| Select | @radix-ui/react-select |
| Separator | @radix-ui/react-separator |
| Slider | @radix-ui/react-slider |
| Slot | @radix-ui/react-slot |
| Switch | @radix-ui/react-switch |
| Tabs | @radix-ui/react-tabs |
| Toggle | @radix-ui/react-toggle |
| Toggle Group | @radix-ui/react-toggle-group |
| Tooltip | @radix-ui/react-tooltip |
| Command (cmdk) | cmdk |
| Date Picker | react-day-picker |
| Carousel | embla-carousel-react |
| Drawer | vaul |
| OTP Input | input-otp |
| Resizable Panels | react-resizable-panels |
| Toast | sonner |

---

### 2. Custom UI (`src/components/custom-ui/`)
Custom components extending the shadcn design system. Project-specific reusable elements.

---

### 3. Forms (`src/components/forms/`)
Reusable form components using React Hook Form + Zod validation.

---

### 4. Auth (`src/components/auth/`)
Authentication-related UI: sign-in form, sign-up form, error states, session management.

---

### 5. Navigation (`src/components/navigation/`)
App navigation: sidebar, header, breadcrumbs, mobile nav.

---

### 6. Dashboard (`src/components/dashboard/`)
Dashboard widgets and data display components.

- **Subfolders**: `skeletons/` — loading skeleton versions of dashboard components.

---

### 7. Nutrition (`src/components/nutrition/`)
Nutrition tracking UI: macro rings, calorie breakdown, nutrient charts (Recharts).

---

### 8. Meal Plans (`src/components/meal-plans/`)
Meal planning calendar interface. Uses `@dnd-kit` for drag-and-drop recipe assignment across days and meal slots.

---

### 9. Recipes (`src/components/recipes/`)
Recipe library UI.

- **Subfolders**: 
  - `recipe-form/` — Full recipe creation and edit form (ingredients, instructions, nutrition)

---

### 10. Shopping (`src/components/shopping/`)
Shopping list management and Browser-Use automation UI (progress display, store selection, credential management).

---

### 11. Profile (`src/components/profile/`)
User profile and dietary preferences forms.

---

### 12. Onboarding (`src/components/onboarding/`)
Multi-step onboarding wizard for new users.

- **Subfolders**:
  - `hooks/` — Wizard state management hooks
  - `steps/` — Individual wizard step components
  - `components/` — Onboarding sub-components

---

### 13. Landing (`src/components/landing/`)
Marketing landing page components.

- **Subfolders**:
  - `sections/` — Page sections (hero, features, pricing, etc.)
  - `ui/` — Landing-specific UI elements

---

## Design System

| Aspect | Implementation |
|---|---|
| Component library | shadcn/ui (configured in `components.json`) |
| Primitive layer | Radix UI |
| Styling | Tailwind CSS v4 |
| Icon system | Lucide React + Iconify |
| Animation | Framer Motion |
| Theme | next-themes (dark/light mode support) |
| Typography | Custom fonts (`src/app/fonts/`) |
| Color system | Tailwind CSS design tokens + shadcn CSS variables |

---

## Component Rules

1. **`src/components/ui/`** — never modify manually. Use `npx shadcn@latest add <component>` or `npx shadcn@latest update`.
2. Feature components live in their feature folder (e.g., `src/components/recipes/` for recipe UI).
3. Shared reusable components live in `src/components/custom-ui/` or `src/components/forms/`.
4. All interactive client components require `"use client"` directive.
5. Server Components fetch data directly; Client Components receive data as props or use hooks.
