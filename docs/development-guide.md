# DietAI — Development Guide

> Generated: 2026-03-07 | Version: 1.2.0

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Bun | latest | **Required** — no npm/yarn |
| Node.js | 18+ | Required for tooling |
| PostgreSQL | 14+ | Via Supabase (cloud) or local docker-compose |
| Git | — | — |

> ⚠️ **Bun only.** This project uses Bun exclusively. Do not use `npm` or `yarn`.

---

## Initial Setup

```bash
# 1. Clone the repository
git clone <repository-url>
cd dietaibest

# 2. Install dependencies
bun install

# 3. Configure environment variables
cp .env.example .env.local
# Edit .env.local with your API keys (see Environment Variables below)

# 4. Initialize the database
bun run db:push     # Push Prisma schema to PostgreSQL
bun run db:seed     # Seed default categories and sample data

# 5. Start development server
bun dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

```bash
# ── Supabase (PostgreSQL + Auth + Realtime) ──────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
DATABASE_URL=postgresql://...          # Pooled connection (Supabase)
DIRECT_URL=postgresql://...            # Direct connection (for migrations)

# ── Edamam APIs ──────────────────────────────────────────────────────────────
EDAMAM_APP_ID=your_edamam_app_id
EDAMAM_APP_KEY=your_edamam_app_key

# ── USDA FoodData Central ────────────────────────────────────────────────────
USDA_API_KEY=your_usda_api_key

# ── Browser-Use Cloud (Shopping Automation) ──────────────────────────────────
BROWSER_USE_API_KEY=your_browser_use_key

# ── Authentication ───────────────────────────────────────────────────────────
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret

# ── Google Cloud Document AI (Recipe OCR) ────────────────────────────────────
GOOGLE_CLOUD_PROJECT_ID=your_project_id
GOOGLE_CLOUD_PROCESSOR_ID=your_processor_id
# (service account credentials as needed)

# ── Stripe (Billing — partially implemented) ─────────────────────────────────
STRIPE_PUBLISHABLE_KEY=your_stripe_public_key
STRIPE_SECRET_KEY=your_stripe_secret_key

# ── Shopping Credential Encryption ───────────────────────────────────────────
ENCRYPTION_KEY=your_aes_256_key    # 32-byte key for AES-256-GCM
```

---

## Common Development Commands

```bash
# Development
bun dev                     # Start dev server (hot reload)
bun build                   # Production build
bun start                   # Start production server

# Database
bun run db:push             # Push schema changes (no migration file)
bun run db:migrate          # Run pending migrations (creates migration files)
bun run db:seed             # Run seed script
bun run db:studio           # Open Prisma Studio (DB browser)

# Code Quality
bun run lint                # Run ESLint

# Testing
bun test                    # Run all unit + integration tests (Vitest)
bun run test:unit           # Unit tests only
bun run test:integration    # Integration tests only
bun run test:watch          # Watch mode
bun run test:coverage       # Coverage report
bun run test:ui             # Vitest UI browser

# E2E Testing (Playwright)
bun run e2e                 # Run E2E tests (headless)
bun run e2e:ui              # Playwright UI mode
bun run e2e:headed          # Run with browser visible
bun run e2e:debug           # Debug mode
bun run e2e:report          # View test report
```

---

## Project Conventions

### Package Manager
Always use `bun`. Never use `npm install` or `yarn add`.

### TypeScript
- Strict mode enabled
- All types derived from Prisma-generated types where possible
- Never use `any` — use `unknown` if type is genuinely unknown

### Server Actions
- All data mutations go through `src/actions/`
- Every Server Action **must** validate authentication before proceeding
- Use Zod schemas for input validation

### UI Components
- Use shadcn/ui components from `src/components/ui/`
- **Never modify** files in `src/components/ui/` directly
- Add new shadcn components via: `npx shadcn@latest add <component>`
- Feature components go in their respective feature folder

### Database
- Prisma is the single source of truth for all TypeScript types
- Always use `bun run db:migrate` for schema changes in production
- Use `bun run db:push` only for rapid development iteration

### Authentication
- All protected routes handled by `src/middleware.ts`
- Client-side auth state via `src/hooks/use-auth.ts`
- Server-side auth check required in every Server Action

### i18n
- All user-facing strings must be in `messages/*.json`
- Use `next-intl` hooks in client components
- Use `next-intl` server utilities in Server Components and Actions

---

## Testing Strategy

See [TESTING.md](../TESTING.md) for the full testing guide.

### Unit Tests (Vitest)
- **Config**: `vitest.config.mts`
- **Setup**: `vitest.setup.ts`
- **Location**: Colocated with source (`*.test.ts`, `*.spec.ts`) or in `tests/`
- **Framework**: Vitest + Testing Library + jsdom

```bash
bun test                    # Run all
bun run test:coverage       # With coverage
```

### E2E Tests (Playwright)
- **Config**: `playwright.config.ts`
- **Location**: `tests/` folder
- Requires a running dev or staging server

```bash
bun run e2e                 # Run all E2E
bun run e2e:ui              # Interactive mode
```

---

## Adding a New Feature (Checklist)

1. **Add Prisma model** (if DB changes needed) → `prisma/schema.prisma` → `bun run db:migrate`
2. **Add i18n strings** → `messages/en.json`, `messages/es.json`, `messages/pl.json`
3. **Create Server Action** → `src/actions/` with auth check + Zod validation
4. **Create API route** (if external integration or async task needed) → `src/app/api/`
5. **Build components** → `src/components/[feature]/`
6. **Add page** → `src/app/[locale]/(protected-pages)/[feature]/page.tsx`
7. **Add navigation link** → `src/components/navigation/`
8. **Write tests** → Unit tests for actions/utils, E2E for critical paths

---

## Docker Development

```bash
# Start full stack (app + PostgreSQL)
docker-compose up

# Build production image
docker build -t dietai .

# Run container
docker run -p 3000:3000 --env-file .env.local dietai
```

The `Dockerfile` uses Next.js `standalone` output for minimal image size. The `ws` module is explicitly included for Supabase realtime support.
