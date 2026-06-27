# DietAI - Project Architecture

**Last Updated:** 2026-06-24

## Related Documentation
- [Database Schema](./database_schema.md)
- [Recipe Import System](./recipe_import_system.md)
- [Design System](./design_system.md)
- [README Index](../README.md)

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Core Features](#core-features)
5. [External Integrations](#external-integrations)
6. [Authentication & Authorization](#authentication--authorization)
7. [Data Flow Architecture](#data-flow-architecture)
8. [Key Design Patterns](#key-design-patterns)

---

## Project Overview

**DietAI** is an AI-powered meal planning and nutrition management application that automates the entire meal planning workflow - from recipe storage and nutritional analysis to automated grocery shopping.

### Project Goals
- Automate meal planning with AI-powered weekly plans balanced to user macro goals
- Provide accurate nutritional analysis via USDA FoodData Central (22-nutrient per-serving profile)
- Enable one-click grocery shopping via Browser-Use AI agents
- Support multi-language users (English, Polish, Spanish)
- Deliver mobile-first, accessible user experience

### Key Value Propositions
1. **Smart Recipe Management**: Store recipes via manual entry, URL import, or AI-powered OCR
2. **Professional Nutrition Analysis**: Accurate macro tracking powered by USDA FoodData Central
3. **AI Meal Plan Generation**: Automated weekly meal plans with macro balancing
4. **One-Click Shopping**: AI agents fill grocery carts automatically
5. **Family-Friendly**: Support for family members with different dietary needs

---

## Tech Stack

### Frontend Framework
- **Next.js 15** (App Router with Turbopack)
  - Server Components for improved performance
  - Server Actions for business logic (no API routes for CRUD)
  - React 19 with concurrent features
- **TypeScript 5** (strict mode)
- **Bun** (exclusive package manager, no npm/yarn)

### UI & Design System
- **"Botanical Precision" Design System** - Custom design language with warm stone neutrals and green brand accents
- **ShadCN UI** - Pre-built accessible component library
- **Tailwind CSS 4** - Utility-first styling with CSS variables
- **Radix UI** - Unstyled accessible primitives
- **Framer Motion** - Animation library
- **Lucide React + Iconify** - Icon systems (Lucide for general, Iconify Solar for landing)
- **next-themes** - Dark mode support with full semantic token system
- See [Design System Documentation](./design_system.md) for comprehensive styling guidelines

### Database & ORM
- **Supabase PostgreSQL** - Managed PostgreSQL with row-level security
- **Prisma ORM** - Type-safe database client
  - Output: `src/generated/prisma` (single source of truth for types)
  - Provider: PostgreSQL via Supabase

### Authentication
- **NextAuth.js v4** - Authentication framework
- **Supabase Auth** - JWT-based authentication backend
- Session management with automatic token refresh

### Internationalization (i18n)
- **next-intl** - Type-safe internationalization
- Supported locales: English (en), Polish (pl), Spanish (es)
- All user-facing text uses translation keys

### Form Management & Validation
- **React Hook Form** - Form state management
- **Zod** - Schema validation
- **@hookform/resolvers** - Bridge between RHF and Zod

### External API Clients
- **USDA FoodData Central** - The nutrition engine: ingredient matching + nutrient data
- **Browser-Use Cloud** - AI web automation for grocery shopping
- **Supadata** - URL recipe extraction (video `/extract`, article `/web/scrape`)
- **Google Gemini / Gemma** - photo/PDF recipe extraction (vision + native PDF)

### Testing
- **Vitest** - Unit and integration testing
- **Testing Library** - Component testing
- **Playwright** - E2E testing

### Development Tools
- **ESLint 9** - Linting
- **PostCSS** - CSS processing
- **Turbopack** - Fast bundler (Next.js 15)

---

## Project Structure

```
dietaibest/
├── .agent/                      # Project documentation (this folder)
│   ├── System/                  # Architecture, database, integrations
│   ├── Tasks/                   # Feature PRDs and implementation plans
│   ├── SOP/                     # Standard operating procedures
│   └── README.md                # Documentation index
│
├── prisma/
│   └── schema.prisma            # Database schema (single source of truth)
│
├── src/
│   ├── actions/                 # Server Actions (business logic)
│   │   ├── onboarding.ts       # User onboarding flow
│   │   ├── recipe.ts           # Recipe CRUD operations
│   │   ├── meal-plan.ts        # Meal planning operations
│   │   ├── nutrition.ts        # Nutrition analysis
│   │   └── analyzeRecipe.ts    # Recipe AI analysis
│   │
│   ├── app/                     # Next.js 15 App Router
│   │   ├── [locale]/           # Internationalized routes
│   │   │   ├── (public-pages)/ # Marketing and public pages
│   │   │   ├── (protected-pages)/ # Authenticated user routes
│   │   │   │   ├── dashboard/
│   │   │   │   ├── recipes/
│   │   │   │   ├── meal-plans/
│   │   │   │   ├── nutrition/
│   │   │   │   ├── shopping/
│   │   │   │   ├── profile/
│   │   │   │   └── settings/
│   │   │   ├── sign-in/
│   │   │   ├── sign-up/
│   │   │   ├── onboarding/
│   │   │   └── layout.tsx      # Locale-specific layout
│   │   │
│   │   ├── api/                # API routes (external integrations only)
│   │   │   ├── auth/           # NextAuth handlers
│   │   │   ├── recipes/[id]/image/ # Recipe image upload endpoint
│   │   │   ├── nutrition/      # Nutrition analysis
│   │   │   └── fdc/            # FoodData Central proxy
│   │   │
│   │   ├── layout.tsx          # Root layout
│   │   └── page.tsx            # Root redirect
│   │
│   ├── components/             # React components
│   │   ├── ui/                # ShadCN UI components (never modify)
│   │   ├── auth/              # Authentication components
│   │   ├── forms/             # Reusable form components
│   │   ├── navigation/        # Header, nav, menus
│   │   ├── onboarding/        # Onboarding wizard
│   │   ├── recipes/           # Recipe management UI
│   │   ├── meal-plans/        # Meal planning UI
│   │   └── nutrition/         # Nutrition calculator
│   │
│   ├── generated/
│   │   └── prisma/            # Generated Prisma client
│   │
│   ├── hooks/                 # Custom React hooks
│   │   ├── use-auth.ts
│   │   ├── use-mobile.ts
│   │   ├── use-debounce.ts
│   │   ├── use-undo.ts
│   │   └── use-recipe-nutrition.ts
│   │
│   ├── i18n/                  # Internationalization
│   │   ├── request.ts         # Server-side i18n
│   │   └── messages/          # Translation files (en/pl/es)
│   │
│   ├── lib/                   # Utilities & external clients
│   │   ├── prisma.ts          # Prisma client singleton
│   │   ├── supabase.ts        # Supabase client
│   │   ├── browser-use.ts     # Browser-Use client (shopping automation)
│   │   ├── fdc.ts             # FoodData Central client (pure)
│   │   ├── fdcRepo.ts         # FDC cache-aware repository
│   │   ├── recipe-analysis-repo.ts # LLM-primary analysis cache (ADR 0003/0004)
│   │   └── utils.ts           # General utilities
│   │
│   ├── providers/             # React Context providers
│   │   └── AuthProvider.tsx
│   │
│   ├── types/                 # TypeScript definitions
│   │   ├── index.ts
│   │   ├── recipe.ts
│   │   ├── meal-plan.ts
│   │   ├── onboarding.ts
│   │   └── navigation.ts
│   │
│   └── middleware.ts          # Next.js middleware (auth + i18n)
│
├── tests/                     # Test suites
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── public/                    # Static assets
├── .env.local                 # Environment variables (not in git)
├── components.json            # ShadCN configuration
├── next.config.mjs            # Next.js configuration
├── tailwind.config.ts         # Tailwind configuration
├── tsconfig.json              # TypeScript configuration
└── package.json               # Dependencies (Bun)
```

---

## Core Features

### 1. Recipe Management
**Location:** `src/actions/recipe.ts`, `src/app/[locale]/(protected-pages)/recipes/`

**Capabilities:**
- Create recipes manually with form validation
- Import recipes from a URL or a photo/PDF — from the AI chat or the "Add Recipe" modal (URL → Supadata, image/PDF → Gemma)
- Automatic nutritional analysis via USDA FoodData Central (full 22-nutrient profile)
- Categorization and tagging
- Favorites system
- Search and filtering with pagination
- Public/private sharing

**Key Components:**
- `RecipeForm.tsx` - Multi-step recipe creation
- `RecipeCard.tsx` - Recipe display card
- `modal/screens/EntryScreen.tsx` - "Add Recipe" chooser (Manual / Ask the assistant / Import URL · photo/PDF)
- `IngredientsList.tsx` - Dynamic ingredient management

**Server Actions:**
- `createRecipe()` - Create new recipe
- `updateRecipe()` - Edit existing recipe
- `deleteRecipe()` - Remove recipe
- `getRecipes()` - List with filters
- `toggleFavorite()` - Favorite/unfavorite

**Import System:**
- One shared engine (Supadata + Gemma), two entry points: the AI chat and the modal's "Import" option (Browser-Use URL import + Document AI photo/PDF were discontinued 2026-06-14)
- Chat: `importRecipeFromUrl` (Supadata) / `importRecipeFromImage` (Gemma)
- Modal: `POST /api/recipes/import/url` and `POST /api/recipes/import/image` → prefill form → preview → save
- See [Recipe Import System](./recipe_import_system.md) for details

### 2. Meal Planning System
**Location:** `src/actions/meal-plan.ts`, `src/components/meal-plans/`

**Capabilities:**
- Create weekly meal plans with customizable date ranges
- Configure 2-6 meals per day (7 `MealType`s: breakfast, lunch, dinner, snacks, etc.)
- Drag-and-drop recipe assignment using `@dnd-kit/core`
- Real-time macro calculation per day/week
- Template system (duplicate/schedule plans)
- 3 editor layout modes (grid / stack / split) + regular/compact density toggle
- Month-grid schedule calendar for placing templates on dates
- Active plan management
- Public sharing with share tokens
- "Generate with AI" header button deep-links to the in-app chat agent

**Key Components (`src/components/meal-plans/`):**
- `MealPlanner.tsx` - Shell: header, planner/calendar tabs, loads templates, wires mutations
- `planner.tsx` - Exports `PlanSwitcher`, `RecipeLibrary`, `MealCell`, `DayMacros`, and the 3 editor layouts (`GridLayout` / `StackLayout` / `SplitLayout`)
- `ScheduleCalendar.tsx` - Month-grid calendar for scheduling templates on specific dates
- `WeeklyMacroStrip.tsx` - Weekly macro summary strip
- `MicronutrientPanel.tsx` - Collapsible micronutrient totals (`variant="aggregate"` daily-average panel + `variant="day"` per-day panel) with %DV bars (DIE-44)
- `shared.tsx` - Shared primitives: `RecipeThumb`, `MacroBar`, `Chip`
- `icons.tsx` - Lucide-react icon wrapper
- `MealPlanForm.tsx` - Create/edit meal plan dialog (unchanged)

**Shared Libraries:**
- `src/lib/meal-plan-adapter.ts` - `toTemplateDisplay()`: converts a Prisma `MealPlanTemplate` payload to the `MealPlanTemplateDisplay` display type
- `src/lib/meal-slot-meta.ts` - `MEAL_SLOT_META`: per-`MealType` icon / color / i18n-key metadata map (7 entries)
- `src/lib/meal-plan-macros.ts` - `calculateMealMacros()`, `sumMacros()`; plus `calculateMealMicros()` / `sumMicros()` / `emptyMicros()` for daily micronutrient aggregation (DIE-44)
- `src/lib/nutrition-rda.ts` - `getReferenceIntakes(profile?)` (DRI RDA by age+sex, FDA Daily Value fallback) + `percentOfReference()` for the micronutrient %DV display (DIE-44)

**Server Actions (`src/actions/meal-plan.ts` — unchanged from pre-migration):**
- `createMealPlan()` - Create new plan
- `updateMealPlan()` - Edit plan with date adjustment
- `deleteMealPlan()` - Remove plan
- `getMealPlan()` - Get plan with calculated macros
- `addMealToDay()` - Add recipe to meal slot
- `moveMeal()` - Drag-and-drop handler
- `updateMealServings()` - Adjust servings
- `scheduleMealPlan()` - Schedule template for future date
- `overwriteActivePlan()` - Replace active plan

**Macro Calculation:**
- Per-meal macros: `calculateMealMacros()` in `src/lib/meal-plan-macros.ts`
- Daily totals: `sumMacros()`
- Weekly averages: Calculated in `getMealPlan()`

**Micronutrient totals (DIE-44):** `toTemplateDisplay()` also aggregates the 17
micronutrients per meal (`calculateMealMicros`), per day (`sumMicros`), and as a
template `averageMicros` — no DB/Prisma change (the adapter already loads the full
recipe). The planner shows them via `MicronutrientPanel` with a **%DV** figure
resolved by `getReferenceIntakes()` (personalized by `UserProfile` age+sex, FDA
Daily Value fallback). Design recorded in `docs/adr/0002-meal-plan-micronutrient-totals-ui.md`.

**Styling & i18n:**
- All styling uses Tailwind/shadcn tokens — no custom CSS-variable system
- Full `next-intl` i18n across `en` / `es` / `pl` under the existing `mealPlans.*` namespace

### 3. Nutritional Analysis

**USDA FoodData Central (FDC) is the single nutrition engine for recipe
creation** (DIE-42). Every creation path — manual form, URL/image import, and
the chat `createRecipe` tool — computes the full **22-nutrient profile** (5
macros + 17 micronutrients) per serving and persists all fields on the Recipe
row. No Edamam call is made on the creation path.

**Editing** re-runs the same analysis, but **only when the ingredient lines
changed** (`updateRecipe` → `ingredientsChanged` → the shared
`reanalyzeRecipeNutrition`). A title/macro/order-only edit keeps the stored
profile so manual macro overrides survive. See the "Stale data" note in
[Nutrition Unit Handling](./nutrition_units.md).

**Location (creation path):** `src/lib/fdc.ts` (extraction/scaling/aggregation
helpers + nutrient-number map + `resolveGramWeightFromPortions`),
`src/lib/gram-resolution.ts` (the pure ingredient→grams `resolveGramWeight`
ladder), `src/lib/fdcRepo.ts` (FdcCache food-detail TTL + legacy core-only
refresh + `searchFoodsCached` ingredient-search cache),
`src/actions/analyzeRecipe.ts` (`analyzeRecipeProfileAction` + shared
`resolveIngredientMatches`), `src/actions/recipe.ts` `persistRecipe()` (writes
the 22 fields + `RecipeIngredient` rows), `src/actions/nutrition.ts`
`analyzeRecipeProfileForFormAction` (form preview button).

**Pipeline:** parse ingredient line → `searchFoodsCached` → `chooseBestMatch`
(`DATATYPE_PRIORITY`) → `getFoodsCached` → `resolveGramWeight` (6-tier ladder in
`gram-resolution.ts`) → `extractProfileFromFood` (per 100g, unit-guarded) →
`scaleProfilePer100g` → `addProfile` across ingredients → `divideProfile` by
servings.

**Search caching (DIE-46):** both USDA round-trips are now DB-cached. The
food-*detail* fetch was already cached (`getFoodsCached` → `FdcCache`); the
ingredient *search* step is cached by `searchFoodsCached` (`fdcRepo.ts`) into the
`FdcSearchCache` table, keyed by the normalized query (lowercased,
whitespace-collapsed). TTL is **90 days** — the same value `FdcCache`'s `isStale`
falls back to for entries without a known dataType, since a search result spans
multiple dataTypes. On a USDA error with a stale row present it serves stale
(rate-limit resilience); with nothing cached it rethrows so callers' existing
handling applies. Both callers use it — `resolveIngredientMatches`
(`analyzeRecipe.ts`) and the `/api/fdc/search` autocomplete route. `fdcSearch`
stays pure (network only). Covered by `tests/unit/fdc-search-cache.test.ts`.

**Gram-resolution accuracy (DIE-45):** the ingredient→grams step is the FDC
engine's weak point, so it is resolved by a confidence-scored ladder
(`gram-resolution.ts`), most-accurate first: direct grams (1.0) → USDA food
portions (0.9) → branded serving (0.85) → density table exact/whole-word
(0.7/0.6) → generic water-density conversion (0.5) → assume grams (0.3). Two
accuracy fixes: `resolveGramWeightFromPortions` now matches USDA's structured
`measureUnit` (with plural/synonym normalization via `normalizeUnit`) and
divides `gramWeight` by the portion `amount` (a "2 tbsp = 30g" portion yields
15g/tbsp, not 30); and `DENSITY_FALLBACK_G_PER_UNIT` (`ingredients.ts`) was
expanded to ~85 common ingredients so volume/count units rarely fall through to
the coarse water-density fallback. The per-ingredient `confidence` is persisted
on `RecipeIngredient.confidence` (internal/debug — no user-facing flagging by
product decision). Covered by `tests/unit/gram-resolution.test.ts` and
`tests/unit/fdc-portions.test.ts`.

**Nutrient mapping:** `PROFILE_NUTRIENT_MAP` in `fdc.ts` (canonical USDA numbers;
µg/mg-native, never IU). `carbs` stores FDC total carbs (nutrient 205); fiber is
stored separately.

**Edamam — fully retired (Phase E, [ADR 0003](../../docs/adr/0003-llm-primary-nutrition-canonicalization.md)).**
The `src/lib/edamam*.ts` clients, the `/api/nutrition/analyze` route, the
`EdamamRecipeCache` / `EdamamUserMacroCache` tables, and the
`edamamAnalysesPerMonth` entitlement have all been deleted. Nutrition analysis is
now USDA FDC only — free and ungated. `nutrition.ts` retains a single FDC action,
`analyzeRecipeProfileForFormAction` (the recipe-form preview button). The
LLM-assisted RAG layer ([ADR 0004](../../docs/adr/0004-llm-assisted-food-resolution.md))
caches its results in `IngredientNameCache` / `IngredientEstimateCache` /
`RecipeAnalysisCache` — see [Nutrition Unit Handling](./nutrition_units.md).

### 4. User Onboarding
**Location:** `src/components/onboarding/`, `src/actions/onboarding.ts`

**Capabilities:**
- Multi-step wizard (Demographics → Goals → Preferences)
- Family member profiles with dietary needs
- Macro target calculation based on user goals
- Progress tracking and validation
- Automatic profile creation

**Onboarding Steps:**
1. **Demographics:** Age, gender, height, weight, activity level
2. **Goals:** Weight loss/gain/maintenance, target calories
3. **Preferences:** Dietary type, allergies, cuisine preferences, family members

**Key Components:**
- `OnboardingWizard.tsx` - Main wizard container
- `DemographicsStep.tsx` - Basic user info
- `GoalsStep.tsx` - Dietary goals and targets
- `PreferencesStep.tsx` - Food preferences and restrictions
- `FamilyMemberForm.tsx` - Add family members

### 5. Recipe Import System
**Location:** shared engine `src/lib/ingest/extract-recipe.ts` + `src/lib/chat/llm-gemma.ts`; entry points `src/lib/chat/tools/importRecipeFrom{Url,Image}.ts` (chat) and `src/app/api/recipes/import/{url,image}/route.ts` (modal)

**Import Methods (chat + "Add Recipe" modal share one engine):**
1. **URL Import:** `extractRecipe` — Supadata extracts the recipe (video `/extract` or article scrape → Gemma)
2. **Image / PDF Import:** `GemmaProvider.extractRecipe` — Gemini reads an uploaded photo or PDF
3. **Manual Entry:** Form-based recipe creation in the "Add Recipe" modal

**Modal flow:** route extracts → prefill form (`importedToFormData`) → PreviewScreen → normal save (provenance + import entitlement enforced on save).

**Discontinued (2026-06-14):** the Browser-Use Cloud URL extraction and the
Google Document AI photo/PDF OCR. Browser-Use is now shopping-only.
See [Recipe Import System](./recipe_import_system.md).

**Chat import flow:**
1. User pastes a URL or uploads a photo in the chat
2. The model calls `importRecipeFromUrl` / `importRecipeFromImage`
3. The tool extracts structured recipe data, runs FDC nutrition analysis (full 22-nutrient profile), and `persistRecipe`s it
4. The chat returns a link to the saved recipe

### 6. Shopping List Generation (Planned)
**Status:** Planned feature, not yet implemented

**Planned Capabilities:**
- Generate shopping list from active meal plan
- Aggregate ingredients across multiple recipes
- Unit conversion and consolidation
- Browser-Use AI for automated cart filling

---

## External Integrations

### 1. USDA FoodData Central API
**Purpose:** The nutrition engine — ingredient matching and nutritional data
(FDC-only since Phase E; see [ADR 0003](../../docs/adr/0003-llm-primary-nutrition-canonicalization.md)).

**API Endpoints Used:**
- `/fdc/v1/foods/search` - Search for foods by name
- `/fdc/v1/foods` - Fetch full nutrient detail for matched foods

**Authentication:** API Key (environment variable)

**Features:**
- Ingredient name matching → full per-100g nutrient profile (22 nutrients)
- Portion size information for gram resolution
- Public-domain data, so the full profile is cacheable (`FdcCache`, `FdcSearchCache`,
  `RecipeAnalysisCache`) — unlike the retired Edamam

**Implementation:** `src/lib/fdc.ts` (pure client), `src/lib/fdcRepo.ts` (cache-aware repo)

### 2. Browser-Use Cloud API
**Purpose:** AI-powered web automation for **grocery shopping** (cart filling at
supported Polish stores). Recipe URL extraction via Browser-Use was
discontinued 2026-06-14.

**API Version:** v2

**API Endpoints Used:**
- `POST /api/v2/tasks` - Start new automation task
- `GET /api/v2/tasks/{taskId}` - Poll task status
- `POST /api/v2/sessions` - Persistent browser session (liveUrl for the user)

**Authentication:** API Key via `X-Browser-Use-API-Key` header

**Features:**
- Log in (optional) and fill the cart at Auchan / Frisco / Carrefour
- Handle cookie banners, pop-ups
- Structured JSON output (found / not-found / substituted items)
- Persistent session so the user can continue to checkout via `liveUrl`

**Implementation:** `src/lib/browser-use.ts`, `src/actions/shopping-automation.ts`,
`src/app/api/shopping/automate/*`

### 3. Google Gemini (Gemma) — multimodal recipe import
**Purpose:** Extract structured recipe data from an uploaded photo (the chat's
`importRecipeFromImage` tool). Replaced the previous Google Document AI OCR path.

**API:** Gemini API (`@google/genai`, Vertex AI)

**Authentication:** Service account (inline JSON env var or key file) resolved by
`src/lib/chat/tools/genai-options.ts`

**Features:**
- Vision-based recipe extraction (ingredients + instructions) from images
- Daily per-user cap (`src/lib/chat/multimodal-cap.ts`)

**Implementation:** `src/lib/chat/llm-gemma.ts`, `src/lib/chat/tools/importRecipeFromImage.ts`

### 4. Supabase
**Purpose:** PostgreSQL database and authentication backend

**Services Used:**
- **PostgreSQL Database:** Row-level security enabled
- **Supabase Auth:** JWT-based authentication
- **Real-time Subscriptions:** (Planned for collaborative features)

**Connection:**
- Database URL: `DATABASE_URL` (pooled connection)
- Direct URL: `DIRECT_URL` (migrations)
- Supabase API: `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Implementation:** `src/lib/supabase.ts`, `src/lib/prisma.ts`

---

## Authentication & Authorization

### Authentication Flow
1. User signs up/signs in via NextAuth
2. NextAuth creates session with JWT token
3. Token stored in HTTP-only cookies
4. Middleware validates token on protected routes
5. Automatic token refresh before expiration

### Authorization Strategy
- **Row-Level Security (RLS):** All Prisma queries filter by `userId`
- **Server Actions:** All actions call `getAuthenticatedUser()` first
- **Middleware:** Protects `/dashboard`, `/recipes`, `/meal-plans`, etc.
- **Public Sharing:** Share tokens for public meal plans

### NextAuth Configuration
**Provider:** Credentials provider with Supabase backend

**Session Strategy:** JWT (stateless)

**Protected Routes:**
- `/dashboard`
- `/recipes/*`
- `/meal-plans/*`
- `/nutrition`
- `/shopping`
- `/profile`
- `/settings`

**Implementation:** `src/app/api/auth/[...nextauth]/route.ts`

---

## Data Flow Architecture

### Recipe Creation Flow
```
User Form Input
  ↓
React Hook Form + Zod Validation
  ↓
Server Action: createRecipe()
  ↓
analyzeRecipeProfileAction() — USDA FDC (cached search + detail)
  ↓
Prisma: Insert recipe + RecipeIngredient rows (22-nutrient profile)
  ↓
Revalidate /recipes path
  ↓
Return recipe to client
```

### Meal Plan Macro Calculation Flow
```
getMealPlan(planId)
  ↓
Fetch plan with days and meals (Prisma)
  ↓
For each meal:
  - Get recipe macros from database
  - Calculate per-serving macros
  - Apply meal servings multiplier
  ↓
Sum macros per day
  ↓
Calculate weekly totals and averages
  ↓
Return MealPlanDisplay with calculated macros
```

### Recipe Import via Chat Flow
```
User pastes URL (or uploads a photo) in the AI chat
  ↓
Model calls importRecipeFromUrl (Supadata) or importRecipeFromImage (Gemma)
  ↓
Tool extracts structured recipe data
  ↓
USDA FDC nutrition analysis (22-nutrient profile)
  ↓
persistRecipe() saves the recipe
  ↓
Chat returns a link to the saved recipe
```

---

## Key Design Patterns

### 1. Server Actions Pattern
**All business logic uses Server Actions instead of API routes**

**Benefits:**
- Type-safe client-server communication
- Automatic serialization
- Built-in form integration
- Reduced bundle size (no client-side API calls)

**Example:**
```typescript
// src/actions/recipe.ts
"use server";

export async function createRecipe(data: RecipeFormData) {
  return serverAction(
    {
      input: recipeFormSchema,
      requires: (_, ctx) => assertCanCreateRecipe(ctx.user),
      revalidates: ["/recipes"],
    },
    async (ctx, validated) =>
      prisma.recipe.create({ data: { ...validated, userId: ctx.user.id } })
  )(data);
}
```

See pattern 8 below for the full Server Action Runtime that wraps every gated action.

### 2. Repository Pattern for External APIs
**Each external API has a pure client + a cache-aware repository**

**Example:**
```typescript
// src/lib/fdc.ts — pure USDA FoodData Central client (network only)
export async function fdcSearch(query: string): Promise<FdcSearchFood[]> {
  // USDA /foods/search call
}

// src/lib/fdcRepo.ts — cache-aware repository over the client
export async function searchFoodsCached(query: string): Promise<FdcSearchFood[]> {
  // serve from FdcSearchCache, else call fdcSearch and persist
}
```

### 3. Service Layer Pattern
**Business logic separated from API clients**

**Example:**
```typescript
// src/actions/analyzeRecipe.ts
export async function analyzeRecipeProfileAction(
  input: AnalyzeRecipeInput
): Promise<RecipeProfileResult> {
  // 1. Parse ingredient lines
  // 2. resolveIngredientMatches() — cached USDA search + detail
  // 3. resolveGramWeight() ladder → per-100g profile → scale → aggregate
  // 4. Divide by servings → 22-nutrient per-serving profile
}
```

### 4. Type-Driven Development
**Prisma schema is single source of truth for all types**

**Flow:**
```
Prisma Schema (schema.prisma)
  ↓
Generate Prisma Client
  ↓
Import Prisma types in Zod schemas
  ↓
Infer TypeScript types from Zod
  ↓
Use types throughout application
```

### 5. Internationalization Pattern
**All user-facing text uses translation keys**

**Example:**
```typescript
// Component
const t = useTranslations("recipes");
<h1>{t("title")}</h1>

// Translation file (messages/en.json)
{
  "recipes": {
    "title": "My Recipes"
  }
}
```

### 6. Error Handling Pattern
**Consistent error handling across all server actions**

**Example:**
```typescript
export async function createRecipe(data: RecipeFormData) {
  try {
    // Business logic
    return { data: recipe, error: null };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown error"
    };
  }
}
```

### 7. Caching Strategy
**Multi-level caching for API optimization**

1. **FDC caches:** `FdcCache` (food detail) + `FdcSearchCache` (search step), 90-day TTL, avoid repeat USDA round-trips
2. **LLM/analysis caches:** `IngredientNameCache`, `IngredientEstimateCache`, `RecipeAnalysisCache` reuse canonicalization + estimates + the full per-serving analysis (ADR 0003/0004)
3. **Next.js Caching:** Page-level caching with revalidation

### 8. Server Action Runtime (Pattern + Module)
**Single deep module wraps every gated server action with auth + validation + entitlement + error mapping + revalidation**

**Location:** `src/lib/server-action.ts`. SOP: `.agent/SOP/server-action-runtime.md`.

**Why:** Before this runtime, every action re-implemented the same skeleton ad-hoc — `getAuthenticatedUser` was duplicated in 7 files, `toEntitlementError` mapping in 5, `revalidatePath` scattered 33 times, `assertCan*` call sites had no central audit point (silent-bypass risk for revenue-protecting quotas).

**The interface:**
```typescript
serverAction(
  {
    input: zodSchema,                                          // optional Zod validation
    requires: (input, ctx) => assertCanX(ctx.user, input.x),   // optional entitlement assertion
    revalidates: ["/path"] | ((result) => ["/path"]),          // optional, static or dynamic
  },
  async (ctx, validatedInput) => { /* pure body */ }
)
```

**Pipeline (in order):** auth resolution → Zod parse → entitlement assertion → body → revalidate → wrap in `{ data, error }` tuple. Every throw is caught and mapped: `EntitlementError` → structured `EntitlementErrorPayload`; `ZodError` → `"Invalid input: ..."` string; anything else → `error.message` string + `console.error`.

**What stays in the body (NOT runtime concerns):**
- Resource ownership checks (`recipe.userId !== ctx.user.id`)
- Per-action user includes (fetch related rows separately)
- Domain decisions and side-effects (e.g. nutrition analysis after recipe create)
- Custom invariant errors (`throw new Error("Recipe not found")` — runtime maps it)

**Reuses (do not reinvent):**
- `src/lib/entitlements.ts` — pure `check*` + async `assertCan*` + shadow-mode `enforce()` kill switch
- `src/lib/entitlement-error.ts` — `toEntitlementError(err)` → `EntitlementErrorPayload | null`

**Migrated to date (gated actions):**
- `src/actions/recipe.ts` — `createRecipe`, `createImportedRecipe`
- `src/actions/meal-plan.ts` — `createMealPlan` (parameterized assertion via `input.duration`)
- `src/actions/shopping-automation.ts` — `startShoppingTask`

**Pending migration (non-gated, lower priority):** `dashboard.ts`, `profile.ts`, `subscription.ts`, `onboarding.ts`, `shopping-list.ts`, `analyzeRecipe.ts`, plus the read/update functions in already-migrated files (`getRecipes`, `updateRecipe`, etc.). Migrate as touched.

**Known divergence:** `nutrition.ts`'s remaining action (`analyzeRecipeProfileForFormAction`) uses the `{ success, data?, error?, code?, retryable? }` shape instead of the standard `{ data, error }` tuple. Migration would require updating consumer hooks (`use-recipe-modal.ts`, `use-recipe-nutrition.ts`). The old Edamam-gated `analyzeAndUpdateRecipe` and `assertCanUseEdamamAnalysis` were removed in Phase E — nutrition analysis is now free and ungated.

---

## Performance Considerations

### Database Optimization
- Indexes on frequently queried fields (userId, recipeId, date)
- Pagination for large datasets
- Select only required fields
- Prisma query optimization

### API Cost Control
- DB-backed FDC caches (`FdcCache` / `FdcSearchCache`) cut USDA round-trips
- LLM result caches (`IngredientNameCache` / `IngredientEstimateCache` / `RecipeAnalysisCache`)
- Request deduplication
- Rate limiting on import endpoints

### Frontend Performance
- Server Components by default
- Client Components only when needed (interactivity)
- Dynamic imports for large components
- Image optimization with Next.js Image
- Code splitting by route

### Bundle Size
- Tree shaking
- ShadCN UI (only import used components)
- Server Actions (reduce client bundle)
- Dynamic imports

---

## Security Considerations

### Authentication Security
- HTTP-only cookies for session storage
- JWT token expiration and refresh
- CSRF protection via NextAuth
- Secure password hashing (Supabase)

### Authorization Security
- All server actions validate user ownership
- Row-level security filters in Prisma queries
- Share tokens for public content
- API key security (environment variables)

### Input Validation
- Zod schema validation on all inputs
- SQL injection protection via Prisma
- XSS protection via React escaping
- File upload validation (size, type)

### API Security
- API keys in environment variables
- Rate limiting on import endpoints
- CORS configuration
- Request size limits

---

## Future Architecture Considerations

### Planned Features
1. **Shopping List Automation:** Browser-Use AI for cart filling
2. **Meal Plan AI Generation:** automated weekly plans via the in-app chat agent
3. **Real-time Collaboration:** Supabase real-time subscriptions
4. **Mobile App:** React Native with shared business logic
5. **Payment System:** Stripe integration for premium features

### Scalability Considerations
- Database connection pooling (Supabase)
- CDN for static assets
- Edge deployment for middleware
- Background job processing (for long-running tasks)
- Caching layer (Redis) for frequently accessed data

---

**End of Project Architecture Documentation**
