# .agent Documentation Index

**DietAI - AI-Powered Meal Planning & Nutrition Management**

Last Updated: 2026-06-24

---

## =� Documentation Structure

This directory contains comprehensive documentation for the DietAI project, organized into three main categories:

### 1. System Documentation (`/System/`)
Core architecture, database design, and technical specifications for understanding how the system works.

### 2. Task Documentation (`/Tasks/`)
Feature PRDs (Product Requirement Documents) and implementation plans for specific features and capabilities.

### 3. Standard Operating Procedures (`/SOP/`)
Best practices, workflows, and step-by-step guides for common development tasks.

---

## =� Documentation Index

### System Documentation

#### [Project Architecture](./System/project_architecture.md)
**Purpose:** Complete technical overview of the DietAI application

**Contains:**
- Project goals and value propositions
- Complete tech stack breakdown (Next.js 15, Prisma, Supabase, etc.)
- Project structure and folder organization
- Core features detailed explanation:
  - Recipe management (create, import, analyze)
  - Meal planning system (drag-and-drop, macro tracking)
  - Nutritional analysis (USDA FoodData Central — FDC-only)
  - User onboarding flow
  - Recipe import system (URL + photo/PDF via Supadata + Gemma)
- External integrations:
  - USDA FoodData Central (the nutrition engine — ingredient matching + nutrient data)
  - Supadata (URL recipe extraction)
  - Google Gemini / Gemma (photo/PDF recipe extraction)
  - Browser-Use Cloud (AI web automation — shopping only)
  - Supabase (database + auth)
- Authentication & authorization patterns
- Data flow diagrams
- Key design patterns (Server Actions, Repository, Service Layer)
- Performance and security considerations

**When to read:**
- Onboarding new developers
- Understanding system architecture
- Planning new features
- Troubleshooting integration issues

---

#### [Recipe Import System](./System/recipe_import_system.md)
**Purpose:** The shared recipe-import engine (Supadata + Gemma), used from both the AI chat and the "Add Recipe" modal

**Contains:**
- The shared extraction engine: `extractRecipe` (URL → Supadata + Gemma) and `GemmaProvider.extractRecipe` (photo/PDF → Gemini)
- The two entry points: chat tools (`importRecipeFromUrl` / `importRecipeFromImage`) and the modal routes (`/api/recipes/import/url` · `/api/recipes/import/image`)
- Why Browser-Use (URL) + Document AI (photo/PDF) were discontinued (2026-06-14); Browser-Use is now shopping-only

**When to read:**
- Working on recipe import features
- Debugging extraction issues in the chat
- Understanding the Supadata / Gemma import pipeline

---

#### [Nutrition Unit Handling (FDC pipeline)](./System/nutrition_units.md)
**Purpose:** How ingredient lines become grams and then a nutrition profile via USDA FDC — the source of truth for ingredient **units**

**Contains:**
- The `unit-registry.ts` single source of truth (canonical units, en/es/pl aliases, kind, base conversion, dropdown list)
- Parser behavior: attached units (`200ml`), multi-word units (`fl oz`)
- The gram-resolution ladder (7 strategies incl. count-unit defaults) and that confidence is **internal-only**
- FDC-only calculation (Edamam off the hot path)
- The recipe-form `UnitCombobox` and the no-confidence `/nutrition` results UI
- The reliability harness (Capa 0): golden-recipe eval in `tests/eval/nutrition/`, deterministic + in CI, with an opt-in live recorder
- Rules for adding new units / where ingredient density lives

**When to read:**
- Touching ingredient units, parsing, gram resolution, or the unit dropdown
- Adding a new unit or locale spelling
- Working on nutrition analysis or the shopping-list quantity transform
- Adding a golden recipe or changing nutrition-calc behavior (run/extend the harness)

---

#### [Chat AI Agent](./System/chat_agent.md)
**Purpose:** Architecture of the in-app chat agent — runtime, LLM layer, tools, prompt composition

**Contains:**
- AgentRuntime contract (`run → AsyncIterable<AgentEvent>`)
- LlmProvider seam (Anthropic / Mock) and the "no-execute" tool contract
- ConversationStore seam
- Tool definition shape: `description` (schema channel) vs `guidance` (system-prompt channel)
- Entitlement filtering (hybrid C+B) and feature-flag gating at the registry
- System prompt composition: the three-category split + desync elimination
- Medical-refusal classifier constraint (decision #117) → links ADR-0001 + the refusal eval

**When to read:**
- Adding or changing a chat tool
- Touching the system prompt or agent behavior
- Adding an LLM provider or conversation store backend
- Working on the medical-refusal / nutrition guardrails

---

#### [Design System](./System/design_system.md)
**Purpose:** Comprehensive styling guidelines for the "Botanical Precision" design system

**Contains:**
- Design philosophy and aesthetic principles
- Color system (brand palette, warm stone neutrals)
- Typography (Inter, Space Grotesk, Geist Mono)
- Semantic color tokens for light/dark modes
- Component styling patterns (cards, buttons, forms)
- Landing page component guidelines
- Utility classes (glass effect, animations)
- Dark mode implementation
- Migration guide from old design system

**When to read:**
- Creating new UI components
- Updating existing component styles
- Ensuring dark mode compatibility
- Understanding the design language
- Working on landing page components

---

#### [PWA Implementation](./System/pwa_implementation.md)
**Purpose:** Progressive Web App implementation documentation

**Contains:**
- PWA features (installable app, offline support, optimized caching)
- Technical implementation (next.config.ts, manifest.json, metadata)
- Caching strategies (CacheFirst, NetworkFirst, StaleWhileRevalidate)
- PWA icons and generation scripts
- Development vs production modes
- Testing procedures and browser support
- Troubleshooting guide
- Best practices and future enhancements

**When to read:**
- Understanding PWA functionality
- Regenerating app icons
- Updating caching strategies
- Troubleshooting service worker issues
- Testing PWA installation
- Enhancing offline capabilities

---

#### [Database Schema](./System/database_schema.md)
**Purpose:** Complete database design documentation with entity relationships

**Contains:**
- Schema overview and design principles
- Entity-relationship diagram
- Core entities:
  - User & UserProfile
  - Recipe & RecipeCategory
  - FamilyMember
  - UserFavorite
- Nutrition & caching models:
  - RecipeIngredient
  - FdcCache (USDA food-detail cache)
  - FdcSearchCache (USDA search-step cache)
  - IngredientNameCache (LLM canonical-name cache)
  - IngredientEstimateCache (LLM per-100g estimates for foods USDA lacks)
  - RecipeAnalysisCache (cached LLM-primary 22-nutrient analysis)
- Meal planning system:
  - MealPlan
  - MealPlanDay
  - MealPlanMeal
- Relationship mapping and cascade deletes
- Indexes and performance optimization
- Data types, constraints, and validation
- Migration strategy

**When to read:**
- Adding new database tables
- Understanding data relationships
- Planning database migrations
- Optimizing database queries
- Troubleshooting data issues

---

### Task Documentation

#### [Deployment Guide](./Tasks/deployment.md)
**Purpose:** Complete deployment documentation for Hostinger VPS with Dokploy

**Contains:**
- Architecture overview (Docker + PostgreSQL + Traefik)
- Dokploy setup steps (project, compose, env vars, domain)
- CI/CD pipeline configuration (GitHub webhooks)
- Database management (backup, restore, migrations)
- Troubleshooting guide
- Security checklist
- Monitoring recommendations

**When to read:**
- Setting up production deployment
- Configuring CI/CD pipeline
- Managing production database
- Troubleshooting deployment issues

---

#### [Public Sharing Feature](./Tasks/public-sharing-feature.md)
**Purpose:** Public recipes & meal plans — discovery tabs, author identity, share links

**Contains:**
- isPublic flow for recipes (Public Recipes tab) and meal plans (Discover tab)
- Author identity rules (displayName, getAuthorName, email-privacy invariant)
- Unauthenticated share-link route and middleware public-prefix config
- Ownership/visibility access-control patterns (viewerIsOwner)
- Related indexes and unit tests

**When to read:**
- Touching public visibility, sharing, or author attribution
- Adding new publicly-readable content types

---

#### [Nutrition engine: LLM-primary canonicalization](./Tasks/ingredient-llm-canonicalizer.md)
**Purpose:** Redesign making LLM canonicalization (Gemini 2.5 Flash) the **primary** normalizer, owning the engine on USDA FDC, retiring Edamam and the `SYNONYMS` table, with an honest per-ingredient output contract. Supersedes the prior fallback design — see [ADR 0003](../docs/adr/0003-llm-primary-nutrition-canonicalization.md).

**Contains:**
- Why: the synonym table over-collapses multi-word names and pre-empts the fallback; the total silently zeroes no-matches; Edamam's licence forbids caching micronutrients (USDA FDC is public-domain → cacheable)
- Single-pass pipeline + two cached LLM stages (name-scoped Stage 1; recipe-fingerprint Stage 2 for cooked-weight + diet/health labels)
- Honest output contract (`status`/`source`/coverage), coverage chain (FDC → LLM-estimate → honest gap), and the 5 open implementation decisions

**When to read:**
- Implementing the LLM-primary nutrition pipeline or retiring Edamam
- Touching `resolveIngredientMatches`, `IngredientNameCache`, `SYNONYMS`, or the canonicalizer

---

#### [Nutrition Learning Hub](./Tasks/nutrition_learning_hub.md)
**Purpose:** Architecture and gotchas for the `/nutrition` Learning Hub (compare, vs-day, encyclopedia, swaps)

**Contains:**
- Route map and module breakdown
- Pure-logic layer (`src/lib/nutrients/`) and data-flow (USDA-only, extended FdcCache profiles)
- Insight engine and personalized RDA design
- Gotchas: message-catalog caching, prisma migrate drift, fdcId verification

**When to read:**
- Adding nutrients, swaps, or encyclopedia entries
- Touching the FDC cache or nutrition comparison logic
- Working on hub UI modules

---

**Future documents:**
- `meal_planning_feature.md` - Meal planning system PRD
- `recipe_import_feature.md` - Recipe import system PRD
- `shopping_list_automation.md` - Shopping list AI automation PRD

---

### Standard Operating Procedures

#### [React Hooks - Common Pitfalls](./SOP/react_hooks_pitfalls.md)
**Purpose:** Quick reference for avoiding common React hooks mistakes

**Contains:**
- isMountedRef initialization pattern
- EventSource cleanup best practices
- AbortController usage for fetch
- Stale closure prevention
- Production examples from codebase

**When to read:**
- Before implementing complex async flows
- Debugging state update warnings
- Working with EventSource/SSE
- Code review checklist

---

#### [Server Action Runtime](./SOP/server-action-runtime.md)
**Purpose:** How to write a gated server action using the `serverAction` runtime in `src/lib/server-action.ts`

**Contains:**
- The wrapper shape (HOF declarative form)
- What the runtime owns (auth, validation, entitlement, error, revalidation)
- What stays in the body (ownership, user includes, domain logic)
- Patterns: single/multi/parameterized assertions, static/dynamic revalidates, no-input actions
- Shadow-mode interaction (`ENTITLEMENTS_ENFORCED`)
- Result contract (`ActionResult<T>`)
- Migration checklist for pre-runtime actions

**When to read:**
- Before adding a new gated server action
- When migrating an old action to the runtime
- When debugging an entitlement payload not opening the paywall

---

#### [Nutrition LLM rollout (Phase G)](./SOP/nutrition-llm-rollout.md)
**Purpose:** Turning on the LLM-primary + RAG nutrition engine in production — the live switch for the work built behind `INGREDIENT_LLM_FALLBACK` ([ADR 0003](../docs/adr/0003-llm-primary-nutrition-canonicalization.md) / [ADR 0004](../docs/adr/0004-llm-assisted-food-resolution.md))

**Contains:**
- Pre-flight: prod Prisma migrations, **Vertex auth on the Dokploy VPS via inline `GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON`** (not a file mount), and an auth probe before flipping
- The flag flip + prod smoke test, and `IngredientNameCache` backfill/warming
- Monitoring + the one-line rollback (`INGREDIENT_LLM_FALLBACK` → not `1`, redeploy)

**When to read:**
- Enabling the LLM nutrition engine in production
- Debugging Vertex auth / `UNRECOGNIZED` spikes after the flip

---

## =� Quick Start for New Developers

### 1. Read These First (in order):
1. **[Project README](../README.md)** - Project overview and setup instructions
2. **[Project Architecture](./System/project_architecture.md)** - System overview and tech stack
3. **[Database Schema](./System/database_schema.md)** - Database design and relationships

### 2. Set Up Development Environment:
```bash
# Install dependencies
bun install

# Set up environment variables
cp .env.example .env.local
# Fill in API keys and database URLs

# Initialize database
bun prisma db push
bun prisma db seed

# Start development server
bun dev
```

### 3. Explore Key Directories:
- `src/actions/` - Server-side business logic
- `src/components/` - React UI components
- `src/lib/` - Utilities and API clients
- `src/types/` - TypeScript type definitions
- `prisma/schema.prisma` - Database schema

---

## =
 Finding Information

### By Topic:

**Tech Stack Questions**
- Next.js / React patterns � [Project Architecture - Tech Stack](./System/project_architecture.md#tech-stack)
- Database / Prisma � [Database Schema](./System/database_schema.md)

**UI & Styling**
- Design system overview � [Design System](./System/design_system.md)
- Color tokens & theming � [Design System - Semantic Tokens](./System/design_system.md#semantic-tokens)
- Landing page components � [Design System - Landing Page Components](./System/design_system.md#landing-page-components)
- Dark mode implementation � [Design System - Dark Mode](./System/design_system.md#dark-mode-implementation)

**Feature Implementation**
- Recipe management � [Project Architecture - Core Features](./System/project_architecture.md#core-features)
- Meal planning � [Project Architecture - Meal Planning System](./System/project_architecture.md#2-meal-planning-system)
- Nutrition analysis � [Project Architecture - Nutritional Analysis](./System/project_architecture.md#3-nutritional-analysis)

**External APIs**
- USDA FoodData Central (nutrition engine) � [Project Architecture - USDA FoodData Central](./System/project_architecture.md#1-usda-fooddata-central-api)
- Browser-Use � [Project Architecture - Browser-Use Cloud](./System/project_architecture.md#2-browser-use-cloud-api)

**Database Questions**
- Table structure � [Database Schema - Core Entities](./System/database_schema.md#core-entities)
- Relationships � [Database Schema - Relationships](./System/database_schema.md#relationships)
- Indexes � [Database Schema - Indexes & Performance](./System/database_schema.md#indexes--performance)

**Authentication**
- Auth flow � [Project Architecture - Authentication & Authorization](./System/project_architecture.md#authentication--authorization)
- User permissions � [Database Schema - User & UserProfile](./System/database_schema.md#user)

---

## =� Documentation Maintenance

### When to Update Documentation:

**After implementing a feature:**
1. Update relevant sections in [Project Architecture](./System/project_architecture.md)
2. Update [Database Schema](./System/database_schema.md) if database changed
3. Add feature PRD to `/Tasks/` if significant
4. Update this README index

**After changing database schema:**
1. Update [Database Schema](./System/database_schema.md)
2. Update schema diagram
3. Document migration strategy
4. Update related sections in Project Architecture

**After adding external integration:**
1. Add to [Project Architecture - External Integrations](./System/project_architecture.md#external-integrations)
2. Document API endpoints, authentication, and usage
3. Add environment variables to project README
4. Create SOP for integration if complex

**After fixing critical bug:**
1. Document root cause in relevant section
2. Add to troubleshooting guide (if pattern emerges)
3. Update best practices in relevant SOP

---

## <� Documentation Goals

### Objectives:
1. **Onboard new developers quickly** - All information in one place
2. **Reduce knowledge silos** - Document tribal knowledge
3. **Enable autonomous development** - Answer common questions
4. **Maintain system consistency** - Document patterns and conventions
5. **Facilitate debugging** - Clear data flow and architecture docs

### Principles:
- **Always up-to-date:** Update docs when code changes
- **Single source of truth:** Each concept documented once
- **Cross-referenced:** Link related documents
- **Examples-driven:** Show code examples where possible
- **Searchable:** Use clear headings and keywords

---

## > Contributing to Documentation

### Creating New Documentation:

**New Feature PRD (in `/Tasks/`):**
1. Use template: Title, Overview, Requirements, Implementation Plan, Testing
2. Link to related System docs
3. Update this README index
4. Keep updated during implementation

**New SOP (in `/SOP/`):**
1. Use template: Title, Purpose, Prerequisites, Steps, Examples, Troubleshooting
2. Focus on "how-to" not "why" (architecture docs explain "why")
3. Update this README index
4. Test the SOP yourself before committing

**Updating System Documentation:**
1. Verify information is accurate and current
2. Update Last Updated date
3. Maintain existing structure and format
4. Add cross-references to related sections
5. Update this README if new sections added

---

## =� Questions or Issues?

If you can't find information in this documentation:
1. Check if it should be documented (if yes, add it!)
2. Search the codebase for examples
3. Ask the team (then document the answer)
4. Review git history for context

**Remember:** If you needed to search for it, the next person will too. Document it!

---

## =� Related Resources

### External Documentation:
- [Next.js 15 Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [ShadCN UI Components](https://ui.shadcn.com/)
- [USDA FoodData Central API](https://fdc.nal.usda.gov/api-guide.html)
- [next-intl Documentation](https://next-intl-docs.vercel.app/)

### Project Files:
- [Main README](../README.md) - Project setup and overview
- [Prisma Schema](../prisma/schema.prisma) - Database schema source
- [Package.json](../package.json) - Dependencies and scripts
- [TypeScript Config](../tsconfig.json) - TS configuration

---

**Last Updated:** 2026-06-24
**Maintained By:** Development Team
**Next Review:** When major features are added or architecture changes
