# DietAI — Source Tree Analysis

> Generated: 2026-03-07 | Scan Level: Quick | Version: 1.2.0

## Project Root

```
dietaibest/
├── src/                        ← All application source code
├── prisma/                     ← Database schema + migrations
├── public/                     ← Static assets (images, icons, etc.)
├── messages/                   ← i18n translation files
│   ├── en.json                 ← English (default)
│   ├── es.json                 ← Spanish
│   └── pl.json                 ← Polish
├── tests/                      ← E2E and integration tests
├── scripts/                    ← Utility/maintenance scripts
├── docs/                       ← Generated project documentation (this folder)
├── _bmad/                      ← BMad method tooling
├── _bmad-output/               ← BMad workflow artifacts (PRD, brief, etc.)
├── .agent/                     ← Agent task management + system docs
│   ├── System/                 ← Architecture, DB schema, design system docs
│   ├── Tasks/                  ← Active task files
│   ├── SOP/                    ← Standard operating procedures
│   └── rules/                  ← Agent behavior rules
├── .claude/                    ← Claude-specific config + agent definitions
├── next.config.ts              ← Next.js config (standalone mode, i18n plugin)
├── tsconfig.json               ← TypeScript config
├── package.json                ← Dependencies + scripts (Bun)
├── components.json             ← shadcn/ui config
├── eslint.config.mjs           ← ESLint config
├── postcss.config.mjs          ← PostCSS (Tailwind pipeline)
├── vitest.config.mts           ← Vitest unit test config
├── vitest.setup.ts             ← Vitest test setup
├── playwright.config.ts        ← Playwright E2E config
├── docker-compose.yml          ← Docker Compose (dev/staging stack)
├── Dockerfile                  ← Production container image
├── CLAUDE.md                   ← AI agent instructions
├── README.md                   ← Project setup + overview
├── PRODUCT_BRIEF.md            ← Product brief (BMad artifact)
├── TESTING.md                  ← Testing guide
└── BROWSER_USE_CLOUD.md        ← Shopping automation integration docs
```

## `src/` Structure

```
src/
├── app/                        ← Next.js App Router
│   ├── [locale]/               ← All user-facing routes (locale-prefixed: en/es/pl)
│   │   ├── (protected-pages)/  ← Auth-guarded routes (Next.js route group)
│   │   │   ├── dashboard/      ← Main dashboard
│   │   │   ├── nutrition/      ← Nutrition tracking + macro overview
│   │   │   ├── meal-plans/     ← Meal planning calendar (drag-and-drop)
│   │   │   ├── recipes/        ← Recipe library
│   │   │   │   ├── new/        ← Create recipe (manual / URL / OCR)
│   │   │   │   └── [id]/       ← View recipe
│   │   │   │       └── edit/   ← Edit recipe
│   │   │   ├── shopping/       ← Shopping list + automation
│   │   │   ├── profile/        ← User profile + dietary preferences
│   │   │   ├── settings/       ← App settings
│   │   │   └── onboarding/     ← Initial setup wizard
│   │   └── (public-pages)/     ← Unauthenticated route group
│   │       ├── sign-in/        ← Login page
│   │       └── sign-up/        ← Registration page
│   ├── api/                    ← API route handlers
│   │   ├── auth/               ← NextAuth + token refresh
│   │   │   ├── [...nextauth]/  ← NextAuth catch-all
│   │   │   └── refresh/        ← Session token refresh
│   │   ├── fdc/
│   │   │   └── search/         ← USDA FoodData Central proxy (cached)
│   │   ├── nutrition/
│   │   │   └── analyze/        ← Edamam nutrition analysis (cached)
│   │   ├── health/             ← Health check
│   │   ├── recipes/
│   │   │   └── import/
│   │   │       ├── url/        ← Async URL recipe import
│   │   │       │   ├── [taskId]/  ← Task result
│   │   │       │   └── status/    ← Task polling
│   │   │       └── document/   ← OCR recipe import (Google Document AI)
│   │   └── shopping/
│   │       ├── (list CRUD)     ← Shopping list management
│   │       └── automate/       ← Browser-Use Cloud automation
│   │           ├── [taskId]/   ← Task result
│   │           └── status/     ← Task polling
│   ├── auth/                   ← Auth-related pages (error, callback)
│   │   ├── error/
│   │   └── callback/
│   └── fonts/                  ← Font files
│
├── components/                 ← React components (153 total)
│   ├── ui/                     ← shadcn/ui primitives (DO NOT MODIFY)
│   ├── custom-ui/              ← Custom UI components
│   ├── forms/                  ← Reusable form components
│   ├── auth/                   ← Auth UI (login form, etc.)
│   ├── navigation/             ← Nav components (sidebar, header)
│   ├── dashboard/              ← Dashboard widgets + skeletons
│   ├── nutrition/              ← Nutrition charts + trackers
│   ├── meal-plans/             ← Meal planning UI (calendar, drag-drop)
│   ├── recipes/                ← Recipe cards, list, form
│   │   └── recipe-form/        ← Recipe creation/edit form
│   ├── shopping/               ← Shopping list + automation UI
│   ├── profile/                ← Profile form components
│   ├── onboarding/             ← Onboarding wizard
│   │   ├── hooks/              ← Onboarding-specific hooks
│   │   ├── steps/              ← Individual wizard steps
│   │   └── components/         ← Onboarding sub-components
│   ├── landing/                ← Landing page components
│   │   ├── sections/           ← Landing page sections
│   │   └── ui/                 ← Landing-specific UI
│   └── [feature]/              ← Feature-scoped components
│
├── actions/                    ← Next.js Server Actions (all CRUD + business logic)
├── hooks/                      ← Custom React hooks
│   └── use-auth.ts             ← Authentication hook
├── lib/                        ← Utilities + external API clients
│   └── pdf/                    ← PDF generation utilities (jsPDF)
├── providers/                  ← React context providers
├── types/                      ← TypeScript type definitions
├── utils/                      ← Utility functions
├── i18n/                       ← next-intl i18n configuration
└── generated/
    └── prisma/                 ← Generated Prisma client
```

## `prisma/` Structure

```
prisma/
├── schema.prisma               ← Data model (16 models, PostgreSQL)
├── seed.ts                     ← Database seeder
└── migrations/
    ├── 0_init/                 ← Initial schema migration
    └── 20250106_meal_plan_template_refactor/  ← Template-based meal plan refactor
```

## Critical Entry Points

| Entry Point | Path | Purpose |
|---|---|---|
| App root | `src/app/[locale]/layout.tsx` | Root layout with providers, i18n |
| Middleware | `src/middleware.ts` | Auth guard + locale routing |
| NextAuth handler | `src/app/api/auth/[...nextauth]/route.ts` | Auth endpoint |
| i18n config | `src/i18n/` | next-intl routing config |
| DB client | `src/generated/prisma/` | Prisma client (auto-generated) |
| Providers | `src/providers/` | React context (theme, auth, etc.) |

## Key Configuration Files

| File | Purpose |
|---|---|
| `next.config.ts` | Next.js standalone mode, i18n plugin, `ws` module inclusion |
| `components.json` | shadcn/ui component configuration |
| `tsconfig.json` | TypeScript strict mode config |
| `prisma/schema.prisma` | Single source of truth for all data types |
| `messages/*.json` | i18n strings (en, es, pl) |
| `.env` | Environment variables (not committed) |
