---
project_name: 'DietAI'
user_name: 'Cristian'
date: '2026-03-06'
sections_completed:
  - technology_stack
  - language_rules
  - framework_rules
  - testing_rules
  - quality_rules
  - workflow_rules
  - anti_patterns
status: 'complete'
rule_count: 25
optimized_for_llm: true
---

# Project Context for AI Agents

_This file contains critical rules and patterns that AI agents must follow when implementing code in this project. Focus on unobvious details that agents might otherwise miss._

---

## Technology Stack & Versions

| Layer                  | Technology                                                    | Version                 |
| ---------------------- | ------------------------------------------------------------- | ----------------------- |
| Framework              | Next.js (App Router, Turbopack)                               | 15.3.6                  |
| UI Runtime             | React / React DOM                                             | 19.2.3                  |
| Language               | TypeScript (strict)                                           | ^5                      |
| ORM                    | Prisma Client                                                 | 6.9.0                   |
| Database               | PostgreSQL via Supabase                                       | —                       |
| Auth                   | NextAuth                                                      | 4.24.11                 |
| Styling                | Tailwind CSS v4                                               | ^4                      |
| UI Components          | shadcn/ui (new-york style) + Radix UI                         | 3.5.0 / latest          |
| Forms                  | React Hook Form + Zod                                         | 7.59.0 / 3.25.67        |
| i18n                   | next-intl                                                     | 4.3.1                   |
| Animations             | Framer Motion                                                 | 12.23.3                 |
| Charts                 | Recharts                                                      | 2.15.3                  |
| DnD                    | @dnd-kit/core + sortable + utilities                          | 6.3.1 / 10.0.0 / 3.2.2  |
| Icons                  | Lucide React                                                  | 0.508.0                 |
| PDF                    | jsPDF                                                         | 3.0.4                   |
| Unit/Integration Tests | Vitest + jsdom + @testing-library/react                       | 3.2.4 / 26.1.0 / 16.3.0 |
| E2E Tests              | Playwright                                                    | 1.54.1                  |
| Package Manager        | Bun (dev) / npm (compatible)                                  | —                       |
| External APIs          | Edamam, USDA FoodData Central (FDC), Google Cloud Document AI | —                       |

---

## Critical Implementation Rules

### 1. Prisma Client Import Path

**🚨 NEVER import from `@prisma/client`.** Prisma generates to a custom path.

Always use:
```typescript
import { PrismaClient, Prisma } from "@/generated/prisma";
import prisma from "@/lib/prisma"; // singleton — use this everywhere
```

Singleton pattern (already in `src/lib/prisma.ts`):
```typescript
const globalForPrisma = global as unknown as { prisma: PrismaClient };
export const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

### 2. TypeScript Strict Mode

`tsconfig.json` sets `"strict": true`:
- Never use implicit `any` — use `unknown` for error catches
- Always guard optional values (strict null checks)
- Path alias `@/*` → `./src/*` — never use relative `../../` paths from within `src/`

### 3. Server Actions Pattern

All data mutations use Next.js Server Actions. Every action file:
```typescript
"use server"; // Required at top of file
```

Standard auth guard — replicate in every action:
```typescript
async function getAuthenticatedUser() {
  const session = await getServerSession();
  if (!session?.user?.email) throw new Error("Unauthorized");
  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) throw new Error("User not found");
  return user;
}
```

### 4. i18n Routing — Locale Segment

All user-facing pages live under `src/app/[locale]/`:
- `(protected-pages)` — auth-required routes
- `(public-pages)` — sign-in, sign-up

Supported locales: `["en", "pl", "es"]` — default `"en"`.  
**Never hardcode UI strings** — always use `next-intl` translation keys.  
New pages must always live inside `[locale]/`.

### 5. Supabase Client — Lazy Initialization

**Never call `createClient()` at module scope.** Use the lazy pattern from `src/lib/supabase.ts`:
```typescript
import { getSupabase } from "@/lib/supabase"; // or proxy: supabase
```
Module-scope instantiation causes build-time failures when env vars are absent.

### 6. Zod Schema Co-location

All Zod schemas live in `src/types/`. Derive TypeScript types from schemas:
```typescript
export type RecipeFormData = z.infer<typeof recipeFormSchema>;
```
Forms use `@hookform/resolvers/zod`. Schema-first — never define standalone interfaces for form types.

### 7. shadcn/ui Component Rules

- Component alias: `@/components/ui/`
- **Always use `cn()` from `@/lib/utils`** for className merging — never concatenate strings
- Icon library: **Lucide React only** (no other icon sets)
- Style: `new-york` — add components via `npx shadcn add <component>`
- CSS variables enabled — **never hardcode color values**
- Never modify files in `src/components/ui/` directly — they are regenerated

### 8. Edamam API — Persistent Storage Compliance

**Critical API policy:** Only 4 macros may be persisted to DB:
- `calories` (kcal), `protein` (g), `fat` (g), `netCarbs` (total carbs − fiber, g)

`fullNutrients` (all other nutritional data) → immediate display only, **never save to DB**.  
Models `EdamamUserMacroCache` and `EdamamRecipeCache` enforce this boundary.

### 9. Store Credentials Encryption

`src/lib/encryption.ts` uses AES-256-GCM. Requires `STORE_CREDENTIALS_ENCRYPTION_KEY` (32-byte hex).  
**Never store plaintext passwords.** DB fields: `encryptedPassword`, `iv`, `authTag`.

---

## Code Organization

```
src/
  actions/        # Next.js Server Actions (all mutations live here)
  app/
    [locale]/
      (protected-pages)/  # Auth-required pages
      (public-pages)/     # Public pages (sign-in, sign-up)
    api/          # REST API route handlers
  components/
    ui/           # shadcn/ui components (DO NOT EDIT)
    custom-ui/    # Shared custom components (PascalCase files)
    [feature]/    # Feature-specific components (PascalCase files)
  hooks/          # Custom React hooks (use-*.ts naming)
  i18n/           # next-intl config
  lib/            # Service clients and utilities
  providers/      # React context providers
  types/          # Zod schemas + inferred TS types
  generated/      # Prisma-generated client (NEVER EDIT MANUALLY)
```

---

## Naming Conventions

- **Component files:** `PascalCase.tsx` (e.g., `DashboardStats.tsx`)
- **Utility/lib files:** `kebab-case.ts` (e.g., `meal-plan-macros.ts`)
- **Hooks:** `use-*.ts` pattern (e.g., `use-recipe-form.ts`)
- **Server Action exports:** verb-first camelCase (e.g., `createRecipe`, `updateProfile`)
- **Test files:** `*.test.ts` / `*.spec.ts` in `tests/unit/` or `tests/integration/`

---

## Testing Rules

- **Unit tests:** `tests/unit/*.test.ts` — Vitest, pure logic, no network
- **Integration tests:** `tests/integration/*.test.ts` — may hit real APIs; `testTimeout: 30000ms`
- **E2E tests:** `e2e/` — Playwright, requires running dev server at `http://127.0.0.1:3000`
- `vitest.config.mts` sets `globals: true` — **do not import `describe/it/expect`**
- **Mocks:** Vitest's built-in utils only. **Never use `jest.*`** — this project uses Vitest
- Coverage reporters: `text`, `json`, `html`; excludes `src/generated/`, `.next/`
- Env vars loaded automatically via `loadEnv(mode, process.cwd(), "")`

---

## Development Commands

```bash
bun run dev          # Dev server (Turbopack)
npm run test:unit    # Vitest unit tests
npm run test:integration  # Vitest integration tests
npm run e2e          # Playwright E2E
npx prisma migrate dev    # Run DB migrations
npx prisma generate       # Regenerate client → src/generated/prisma
bun run prisma/seed.ts    # Seed database
npm run lint         # ESLint (flat config)
```

---

## ESLint Rules

- Extends: `next/core-web-vitals` + `next/typescript`
- Unused vars: **warn** (prefix with `_` to suppress: `_unused`)
- Ignored: `src/generated/**/*`, `*.config.js`, `*.config.mjs`, `.next/**/*`

---

## Required Environment Variables

```env
DATABASE_URL                        # Prisma pooled connection
DIRECT_URL                          # Prisma direct connection (migrations)
NEXTAUTH_SECRET                     # NextAuth JWT secret
NEXT_PUBLIC_SUPABASE_URL            # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY       # Supabase anon key
STORE_CREDENTIALS_ENCRYPTION_KEY    # AES-256 32-byte hex key
FDC_API_KEY                         # USDA FoodData Central
EDAMAM_APP_ID                       # Edamam nutrition API
EDAMAM_APP_KEY                      # Edamam nutrition API
GOOGLE_CLOUD_PROJECT_ID             # Document AI (recipe import)
```

---

## Usage Guidelines

**For AI Agents:**
- Read this file before implementing any code in this project
- Follow ALL rules exactly as documented — especially Prisma import paths and Edamam storage policy
- When in doubt, prefer the more restrictive interpretation
- Update this file when new patterns emerge

**For Humans:**
- Keep lean and focused on what agents commonly miss
- Update immediately when technology stack changes
- Review quarterly for outdated rules
- Remove rules that become obvious over time

_Last Updated: 2026-03-06_



## Step 3: Finalization Complete

Project context file finalized and optimized at `_bmad-output/project-context.md`.

**Summary:**
- 25 critical implementation rules across 9 categories
- Technology stack with exact versions documented
- Lean format optimized for LLM context efficiency
- Frontmatter updated with `status: complete`
- Usage guidelines appended for agents and humans

**Key rules captured:**
1. Prisma custom client path (`@/generated/prisma`, not `@prisma/client`)
2. TypeScript strict mode + `@/*` path aliases
3. Server Actions `"use server"` + NextAuth guard pattern
4. i18n `[locale]` routing with next-intl (no hardcoded strings)
5. Supabase lazy initialization (no module-scope `createClient`)
6. Zod schema co-location in `src/types/`
7. shadcn/ui `cn()` helper + Lucide icons + CSS variables
8. Edamam 4-macro persistence policy (compliance critical)
9. AES-256-GCM credential encryption
