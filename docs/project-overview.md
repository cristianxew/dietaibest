# DietAI — Project Overview

> Generated: 2026-03-07 | Scan Level: Quick | Version: 1.2.0

## Project Summary

**DietAIbook** is an AI-powered meal planning and nutrition management SaaS application. It automates the full meal workflow — from recipe storage and nutritional analysis through AI-generated meal plans to automated grocery shopping.

- **Live product:** dietai.best
- **Beta users:** 2,500+
- **Status:** MVP / Beta

## Tech Stack Summary

| Category | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router) | 15.3.6 |
| Language | TypeScript | ^5 |
| Runtime | React | 19.2.3 |
| Package Manager | Bun | (required) |
| Database | PostgreSQL via Supabase | — |
| ORM | Prisma | ^6.9.0 |
| Auth | NextAuth + Supabase Auth | 4.x |
| UI Components | shadcn/ui + Radix UI | — |
| Styling | Tailwind CSS | v4 |
| Animation | Framer Motion | ^12 |
| Drag & Drop | @dnd-kit | ^6/^10 |
| Charts | Recharts | ^2 |
| i18n | next-intl | ^4 |
| PDF Generation | jsPDF | ^3 |
| OCR | Google Cloud Document AI | ^9 |
| Testing (Unit) | Vitest + Testing Library | ^3 |
| Testing (E2E) | Playwright | ^1 |
| Deployment | Docker (standalone) | — |

## Architecture Type

**Full-stack Next.js Monolith** using App Router.

- Co-located frontend (React components + pages) and backend (API routes + Server Actions)
- No separate backend service — all business logic lives in Server Actions (`src/actions/`) and API routes (`src/app/api/`)
- PostgreSQL via Supabase with Prisma as the single source of truth for all types
- Async task patterns for long-running operations (shopping automation, recipe import)

## Repository Structure

```
dietaibest/               ← Project root (monolith)
├── src/                  ← All application source code
├── prisma/               ← Database schema + migrations
├── public/               ← Static assets
├── messages/             ← i18n translations (en/es/pl)
├── tests/                ← E2E + integration tests
├── scripts/              ← Utility scripts
├── docs/                 ← Generated project documentation (this folder)
├── _bmad/                ← BMad method tooling
├── _bmad-output/         ← BMad workflow artifacts
└── .agent/               ← Agent task management + system docs
```

## External Integrations

| Service | Purpose |
|---|---|
| **Edamam API** | Nutrition analysis (28 nutrients) + AI meal plan generation |
| **USDA FoodData Central** | Ingredient lookup and macro resolution |
| **Browser-Use Cloud** | AI browser automation for grocery shopping |
| **Supabase** | PostgreSQL hosting + Auth + Realtime subscriptions |
| **Google Cloud Document AI** | OCR for recipe import from images/PDFs |
| **Stripe** | Billing and subscription management (partially implemented) |

## Application Pages

### Protected (authenticated users)
| Route | Purpose |
|---|---|
| `/[locale]/dashboard` | Main user dashboard |
| `/[locale]/nutrition` | Nutrition tracking and macro overview |
| `/[locale]/meal-plans` | Meal planning with drag-and-drop calendar |
| `/[locale]/recipes` | Personal recipe library |
| `/[locale]/recipes/new` | Create new recipe (manual / URL / OCR) |
| `/[locale]/recipes/[id]` | View recipe detail |
| `/[locale]/recipes/[id]/edit` | Edit existing recipe |
| `/[locale]/shopping` | Shopping list management + automation |
| `/[locale]/profile` | User profile and dietary preferences |
| `/[locale]/settings` | App settings |
| `/[locale]/onboarding` | Initial user setup wizard |

### Public
| Route | Purpose |
|---|---|
| `/[locale]/sign-in` | User login |
| `/[locale]/sign-up` | User registration |

## Supported Languages

- English (`en`)
- Spanish (`es`)
- Polish (`pl`)

## Key Existing Documentation

| File | Purpose |
|---|---|
| [README.md](../README.md) | Setup instructions and architecture overview |
| [PRODUCT_BRIEF.md](../PRODUCT_BRIEF.md) | Product brief (BMad artifact) |
| [TESTING.md](../TESTING.md) | Testing strategy and commands |
| [BROWSER_USE_CLOUD.md](../BROWSER_USE_CLOUD.md) | Shopping automation integration details |
| [.agent/System/project_architecture.md](../.agent/System/project_architecture.md) | Architecture agent notes |
| [.agent/System/database_schema.md](../.agent/System/database_schema.md) | Database schema agent notes |
| [.agent/System/design_system.md](../.agent/System/design_system.md) | Design system agent notes |
