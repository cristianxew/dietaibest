# DietAI — Documentation Index

> Generated: 2026-03-07 | Scan Level: Quick | Workflow: document-project v1.2.0

## Project Overview

- **Name:** DietAIbook
- **Type:** Full-stack Next.js Monolith
- **Primary Language:** TypeScript
- **Architecture Pattern:** Next.js App Router (co-located frontend + backend)
- **Status:** Live Beta (2,500+ users)

## Quick Reference

| Category | Detail |
|---|---|
| Framework | Next.js 15.3.6 (App Router) |
| Language | TypeScript 5 |
| Database | PostgreSQL via Supabase + Prisma v6 |
| Auth | NextAuth v4 + Supabase Auth |
| UI | shadcn/ui + Radix UI + Tailwind v4 |
| i18n | next-intl (en, es, pl) |
| Package manager | Bun (required) |
| Deployment | Docker (standalone) / Vercel |
| Testing | Vitest + Playwright |

**Entry point:** `src/app/[locale]/layout.tsx`
**Middleware:** `src/middleware.ts` (auth + locale routing)
**DB schema:** `prisma/schema.prisma`
**Server Actions:** `src/actions/`

---

## Generated Documentation

| Document | Purpose |
|---|---|
| [Project Overview](./project-overview.md) | Executive summary, tech stack, pages, integrations |
| [Architecture](./architecture.md) | Full architecture doc — patterns, stack, security, async flows |
| [Data Models](./data-models.md) | All 16 Prisma models with field tables and relationships |
| [API Contracts](./api-contracts.md) | All API routes — auth, FDC, nutrition, recipes, shopping |
| [Source Tree Analysis](./source-tree-analysis.md) | Annotated directory tree with entry points |
| [Component Inventory](./component-inventory.md) | All 153 components — shadcn, custom, feature-scoped |
| [Development Guide](./development-guide.md) | Setup, env vars, commands, conventions, testing |
| [Deployment Guide](./deployment-guide.md) | Docker, Vercel, migrations, CI/CD |

---

## Existing Documentation

| File | Purpose |
|---|---|
| [README.md](../README.md) | Project setup + overview |
| [PRODUCT_BRIEF.md](../PRODUCT_BRIEF.md) | Product brief (BMad artifact) |
| [TESTING.md](../TESTING.md) | Testing strategy + command reference |
| [BROWSER_USE_CLOUD.md](../BROWSER_USE_CLOUD.md) | Shopping automation integration details |
| [CLAUDE.md](../CLAUDE.md) | AI agent instructions |
| [.agent/System/project_architecture.md](../.agent/System/project_architecture.md) | Architecture agent notes |
| [.agent/System/database_schema.md](../.agent/System/database_schema.md) | Database schema agent notes |
| [.agent/System/design_system.md](../.agent/System/design_system.md) | Design system agent notes |
| [.agent/SOP/react_hooks_pitfalls.md](../.agent/SOP/react_hooks_pitfalls.md) | React hooks best practices |
| [.agent/Tasks/deployment.md](../.agent/Tasks/deployment.md) | Deployment task notes |
| [.agent/Tasks/meal_planning_refactor.md](../.agent/Tasks/meal_planning_refactor.md) | Meal planning refactor notes |
| [.agent/Tasks/recipe_page_redesign.md](../.agent/Tasks/recipe_page_redesign.md) | Recipe page redesign notes |

---

## Getting Started

```bash
bun install
cp .env.example .env.local   # Configure API keys
bun run db:push && bun run db:seed
bun dev
```

→ Full setup: [Development Guide](./development-guide.md)

---

## For AI-Assisted Development

When starting work on a new feature, provide the AI agent with:

- **Full-stack feature** → `docs/architecture.md` + `docs/data-models.md` + `docs/api-contracts.md`
- **UI-only feature** → `docs/component-inventory.md` + `docs/source-tree-analysis.md`
- **API/backend feature** → `docs/api-contracts.md` + `docs/data-models.md`
- **New brownfield PRD** → Point PRD workflow to this `docs/index.md`

**State file:** [project-scan-report.json](./project-scan-report.json)
