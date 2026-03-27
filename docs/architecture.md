# DietAI — Architecture Document

> Generated: 2026-03-07 | Scan Level: Quick | Version: 1.2.0

## Executive Summary

DietAI is a **full-stack Next.js monolith** built on the App Router paradigm. Business logic is colocated with the frontend using **Server Actions** as the primary data mutation layer, while **API routes** handle external integrations and async task workflows. The database is PostgreSQL managed through Prisma ORM, hosted on Supabase. Authentication is handled by NextAuth v4 layered on top of Supabase Auth.

## Architecture Pattern: Full-Stack Next.js (App Router)

```
Browser
  │
  ├─► Next.js App Router (src/app/)
  │     ├─► React Server Components (RSC) — data fetching
  │     ├─► React Client Components — interactive UI
  │     ├─► Server Actions (src/actions/) — mutations
  │     └─► API Routes (src/app/api/) — external integrations + async tasks
  │
  ├─► Middleware (src/middleware.ts)
  │     └─► Auth guard + locale routing
  │
  └─► External Services
        ├─► Supabase PostgreSQL (via Prisma ORM)
        ├─► Edamam APIs (nutrition + meal planner)
        ├─► USDA FoodData Central
        ├─► Browser-Use Cloud (shopping automation)
        ├─► Google Cloud Document AI (OCR)
        └─► Stripe (billing)
```

## Technology Stack

### Core

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Framework | Next.js | 15.3.6 | App Router, standalone output |
| Language | TypeScript | ^5 | Strict mode |
| Runtime | React | 19.2.3 | RSC + Client components |
| Package Manager | Bun | latest | Required — no npm/yarn |

### Data

| Layer | Technology | Version | Notes |
|---|---|---|---|
| Database | PostgreSQL | — | Hosted on Supabase |
| ORM | Prisma | ^6.9.0 | Single source of truth for types |
| Client | @prisma/client | ^6.9.0 | Generated to `src/generated/prisma` |
| Realtime | Supabase JS | ^2.50.2 | Subscriptions |

### Auth

| Layer | Technology | Notes |
|---|---|---|
| Session management | NextAuth v4 | JWT-based |
| Identity provider | Supabase Auth | OAuth + email/password |
| Route protection | `src/middleware.ts` | Next.js middleware |
| Client hook | `src/hooks/use-auth.ts` | — |
| Token refresh | `/api/auth/refresh` | Custom route |

### UI

| Component | Technology | Notes |
|---|---|---|
| Component primitives | Radix UI | Full suite (20+ primitives) |
| Component system | shadcn/ui | `components.json` config |
| Styling | Tailwind CSS v4 | PostCSS pipeline |
| Icons | Lucide React + Iconify | — |
| Animation | Framer Motion ^12 | Transitions + drag |
| Drag & Drop | @dnd-kit | Meal plan calendar |
| Charts | Recharts ^2 | Nutrition dashboards |
| Carousel | Embla Carousel | — |
| Date picker | React Day Picker ^9 | — |
| Toasts | Sonner ^2 | Notifications |

### Forms & Validation

| Component | Technology |
|---|---|
| Form management | React Hook Form ^7 |
| Schema validation | Zod ^3 |
| Resolver bridge | @hookform/resolvers |

### i18n

| Component | Technology | Notes |
|---|---|---|
| Library | next-intl ^4 | Integrated with Next.js App Router |
| Locales | en, es, pl | Messages in `messages/*.json` |
| Routing | `src/app/[locale]/` | Locale-prefixed routes |

### Testing

| Type | Framework | Config |
|---|---|---|
| Unit + integration | Vitest ^3 | `vitest.config.mts` |
| Component testing | Testing Library | React 16 |
| E2E | Playwright ^1 | `playwright.config.ts` |

## Application Structure

### Route Architecture

```
src/app/
├── [locale]/                          ← All user-facing routes (locale-prefixed)
│   ├── (protected-pages)/             ← Auth-guarded routes (middleware)
│   │   ├── dashboard/
│   │   ├── nutrition/
│   │   ├── meal-plans/
│   │   ├── recipes/
│   │   │   ├── new/
│   │   │   └── [id]/
│   │   │       └── edit/
│   │   ├── shopping/
│   │   ├── profile/
│   │   ├── settings/
│   │   └── onboarding/
│   └── (public-pages)/                ← Unauthenticated routes
│       ├── sign-in/
│       └── sign-up/
└── api/                               ← API routes
    ├── auth/
    │   ├── [...nextauth]/             ← NextAuth handler
    │   └── refresh/                  ← Token refresh
    ├── fdc/
    │   └── search/                   ← USDA FoodData Central proxy
    ├── nutrition/
    │   └── analyze/                  ← Edamam nutrition analysis
    ├── health/                        ← Health check
    ├── recipes/
    │   └── import/
    │       ├── url/                  ← Async URL recipe import
    │       │   ├── [taskId]/         ← Task status polling
    │       │   └── status/
    │       └── document/             ← OCR recipe import (Google Document AI)
    └── shopping/
        ├── (shopping list CRUD)
        └── automate/                 ← Browser-Use Cloud integration
            ├── [taskId]/             ← Async task result polling
            └── status/
```

### Async Task Pattern

Long-running operations (shopping automation, recipe URL import) use a **fire-and-poll** pattern:

```
Client → POST /api/shopping/automate → returns { taskId }
Client → GET  /api/shopping/automate/status?taskId=xxx → polls until done
Client → GET  /api/shopping/automate/[taskId] → fetches final result
```

### Server Actions Pattern

All CRUD operations and business logic use Next.js Server Actions located in `src/actions/`. These are called directly from React components without needing API routes.

### Middleware

`src/middleware.ts` handles:
- Authentication guard (redirect unauthenticated users)
- Locale routing (sets `[locale]` parameter)

## Data Architecture

See [data-models.md](./data-models.md) for the full database schema.

**Domain model summary:**

```
User
├── UserProfile         ← Dietary preferences, macro targets, goals
│   └── FamilyMember[]  ← Optional family member profiles
├── Recipe[]            ← Personal recipe library
│   ├── RecipeIngredient[]   ← Parsed USDA FDC-matched ingredients
│   ├── RecipeCategory[]     ← Category tags
│   └── UserFavorite[]       ← Favorited by users
├── MealPlanTemplate[]  ← Reusable meal plan templates
│   ├── MealPlanDay[]        ← Days (day 1, day 2, ...)
│   │   └── MealPlanMeal[]   ← Recipe assignments per slot
│   └── MealPlanSchedule[]   ← Calendar scheduling
├── EdamamUserMacroCache[]  ← Cached macros (Edamam policy compliance)
├── ShoppingPreferences     ← Store selection + automation settings
└── StoreCredential[]       ← Encrypted store login credentials

FdcCache                ← Global USDA FDC lookup cache
EdamamRecipeCache       ← Global Edamam analysis cache (fingerprint-based)
```

## Security Architecture

| Concern | Approach |
|---|---|
| Authentication | NextAuth JWT + Supabase session |
| Route protection | Next.js middleware (`src/middleware.ts`) |
| Server action auth | Every action checks authentication (convention) |
| Store credentials | AES-256-GCM encrypted at rest (IV + authTag stored) |
| DB access | Supabase Row-Level Security (RLS) |
| API secrets | Environment variables only (never client-exposed) |

## Deployment Architecture

See [deployment-guide.md](./deployment-guide.md) for details.

- **Docker**: `Dockerfile` with Next.js standalone output
- **docker-compose**: Full stack with PostgreSQL (dev/staging)
- **Vercel**: Recommended production platform
- **Standalone mode**: `output: "standalone"` in `next.config.ts`
- **i18n note**: `ws` module explicitly included in `outputFileTracingIncludes` for Supabase realtime

## Development Patterns & Conventions

| Convention | Detail |
|---|---|
| Package manager | Bun only (no npm/yarn) |
| TypeScript | Strict mode throughout |
| Database types | Always derive from Prisma-generated types |
| Server actions | All mutations go through `src/actions/` |
| UI components | Never modify `src/components/ui/` (shadcn managed) |
| Auth in actions | Every Server Action must validate session |
| Test commands | `bun test`, `bun run e2e` |
| Prisma commands | `bun run db:push`, `bun run db:seed` |

## Known Gaps / Incomplete Features

| Feature | Status |
|---|---|
| Stripe billing | Partially implemented — keys in env but integration incomplete |
| AI meal plan generation | Planned (Edamam Meal Planner integration) |
| Mobile app | Planned — currently web-only |
| CI/CD pipeline | No `.github/workflows/` found — manual deploy |
