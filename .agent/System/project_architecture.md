# DietAIbook - Project Architecture

**Last Updated:** 2025-12-11

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

**DietAIbook** is an AI-powered meal planning and nutrition management application that automates the entire meal planning workflow - from recipe storage and nutritional analysis to automated grocery shopping.

### Project Goals
- Automate meal planning with AI-powered weekly plans balanced to user macro goals
- Provide professional-grade nutritional analysis via Edamam API (28-nutrient analysis)
- Enable one-click grocery shopping via Browser-Use AI agents
- Support multi-language users (English, Polish, Spanish)
- Deliver mobile-first, accessible user experience

### Key Value Propositions
1. **Smart Recipe Management**: Store recipes via manual entry, URL import, or AI-powered OCR
2. **Professional Nutrition Analysis**: Accurate macro tracking powered by Edamam's API
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
- **Edamam API** - Recipe analysis and nutrition data
- **USDA FoodData Central** - Ingredient matching
- **Browser-Use Cloud** - AI-powered web automation
- **Google Cloud Document AI** - OCR for recipe PDFs/images

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
│   │   │   ├── recipes/import/ # Recipe import endpoints
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
│   │   ├── edamam.ts          # Edamam API client
│   │   ├── edamam-service.ts  # Edamam business logic
│   │   ├── browser-use.ts     # Browser-Use AI client
│   │   ├── fdc.ts             # FoodData Central client
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
- Import recipes from URLs using Browser-Use AI
- Import recipes from PDFs/images using Google Document AI OCR
- Automatic nutritional analysis via Edamam API
- Categorization and tagging
- Favorites system
- Search and filtering with pagination
- Public/private sharing

**Key Components:**
- `RecipeForm.tsx` - Multi-step recipe creation
- `RecipeCard.tsx` - Recipe display card
- `RecipeImport.tsx` - URL/document import wizard
- `IngredientsList.tsx` - Dynamic ingredient management

**Server Actions:**
- `createRecipe()` - Create new recipe
- `updateRecipe()` - Edit existing recipe
- `deleteRecipe()` - Remove recipe
- `getRecipes()` - List with filters
- `toggleFavorite()` - Favorite/unfavorite

**URL Import System:**
- Task-based extraction via Browser-Use Cloud API v2
- Real-time progress via SSE (Server-Sent Events)
- Handles anti-bot protection, popups, structured data
- Data validation (ignores unreliable `isSuccess` flag)
- See [Recipe Import System](./recipe_import_system.md) for details

### 2. Meal Planning System
**Location:** `src/actions/meal-plan.ts`, `src/components/meal-plans/`

**Capabilities:**
- Create weekly meal plans with customizable date ranges
- Configure 2-6 meals per day (breakfast, lunch, dinner, snacks)
- Drag-and-drop recipe assignment using dnd-kit
- Real-time macro calculation per day/week
- Template system (duplicate/schedule plans)
- Active plan management
- Public sharing with share tokens

**Key Components:**
- `MealPlanForm.tsx` - Create/edit meal plans
- `MealPlanCalendar.tsx` - Drag-and-drop calendar view
- `MealSlotCard.tsx` - Individual meal slot
- `MacroTracker.tsx` - Real-time macro display

**Server Actions:**
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

### 3. Nutritional Analysis
**Location:** `src/lib/edamam-service.ts`, `src/components/nutrition/`

**Capabilities:**
- 28-nutrient analysis via Edamam API
- ETag-based caching for cost control
- Ingredient synonym translation (en/es/pl)
- Diet label detection (vegan, vegetarian, keto, etc.)
- Health label detection (gluten-free, dairy-free, etc.)
- Allergen warnings
- User-specific macro caching (Edamam policy compliance)

**Key Functions:**
- `analyzeRecipeNutrition()` - Full nutrition analysis
- `getCachedRecipeNutrition()` - Retrieve cached data
- `saveUserMacroCache()` - Store user-specific macros
- `getRecipeNutritionSummary()` - Aggregate multiple recipes

**Caching Strategy:**
1. **Recipe-level cache:** `EdamamRecipeCache` table stores full API responses with ETag
2. **User-level cache:** `EdamamUserMacroCache` stores only 4 macros (calories, protein, fat, net carbs) per Edamam policy
3. **Cache invalidation:** 304 Not Modified responses reuse cached data

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
**Location:** `src/app/api/recipes/import/`, `src/lib/browser-use.ts`

**Import Methods:**
1. **URL Import:** Browser-Use AI extracts recipe from any website
2. **Document Import:** Google Document AI OCR for PDFs/images
3. **Manual Entry:** Form-based recipe creation

**URL Import Flow:**
1. User provides recipe URL
2. Browser-Use AI navigates to URL
3. AI extracts structured recipe data (title, ingredients, instructions, etc.)
4. User reviews and edits imported data
5. Recipe saved with automatic nutrition analysis

**Document Import Flow:**
1. User uploads PDF or image
2. Google Document AI performs OCR
3. Text parsed into structured recipe format
4. User reviews and edits
5. Recipe saved with nutrition analysis

### 6. Shopping List Generation (Planned)
**Status:** Planned feature, not yet implemented

**Planned Capabilities:**
- Generate shopping list from active meal plan
- Aggregate ingredients across multiple recipes
- Unit conversion and consolidation
- Browser-Use AI for automated cart filling

---

## External Integrations

### 1. Edamam API
**Purpose:** Recipe nutritional analysis and meal planning

**API Endpoints Used:**
- `/api/nutrition-data` - Recipe analysis with 28 nutrients
- `/api/meal-planner` - AI-generated meal plans (future)

**Authentication:** App ID + App Key (environment variables)

**Features:**
- Full nutritional breakdown (28 nutrients)
- Diet and health label detection
- Allergen warnings
- ETag-based caching for cost optimization

**Cost Control:**
- ETags: Store `etag` header, send `If-None-Match` on subsequent requests
- 304 Not Modified: Reuse cached data without counting against quota
- User macro cache: Only store 4 macros persistently per Edamam policy

**Implementation:** `src/lib/edamam.ts`, `src/lib/edamam-service.ts`

### 2. USDA FoodData Central API
**Purpose:** Ingredient matching and nutritional data

**API Endpoints Used:**
- `/fdc/v1/foods/search` - Search for foods by name

**Authentication:** API Key (environment variable)

**Features:**
- Ingredient name matching
- Portion size information
- Nutritional data for individual ingredients

**Implementation:** `src/lib/fdc.ts`, `src/lib/fdcRepo.ts`

### 3. Browser-Use Cloud API
**Purpose:** AI-powered web automation for recipe extraction

**API Version:** v2

**API Endpoints Used:**
- `POST /api/v2/tasks` - Start new automation task
- `GET /api/v2/tasks/{taskId}` - Poll task status

**Authentication:** API Key via `X-Browser-Use-API-Key` header

**Features:**
- Navigate to recipe URLs
- Handle cookie banners, pop-ups, paywalls
- Extract structured recipe data
- Vision-enabled for image recognition
- Structured JSON output

**Task Configuration:**
- LLM: `gpt-4o` (default)
- Max Steps: 30
- Vision: Enabled
- Thinking: Enabled (shows reasoning)
- Structured Output: JSON schema for recipe format

**Implementation:** `src/lib/browser-use.ts`

### 4. Google Cloud Document AI
**Purpose:** OCR for recipe PDFs and images

**API:** Document AI OCR Processor

**Authentication:** Service account key (Google Cloud)

**Features:**
- Extract text from PDFs
- Extract text from images (JPG, PNG)
- Multi-language support

**Implementation:** `src/app/api/recipes/import/document/route.ts`

### 5. Supabase
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
Prisma: Insert recipe
  ↓
Optional: analyzeRecipeNutrition()
  ↓
Edamam API (with caching)
  ↓
Update recipe with nutrition data
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

### Recipe Import from URL Flow
```
User provides URL
  ↓
POST /api/recipes/import/url
  ↓
Browser-Use: startTask()
  ↓
AI navigates to URL and extracts data
  ↓
Poll task status until completion
  ↓
Parse extracted JSON
  ↓
Validate recipe data
  ↓
Return to client for review
  ↓
User edits and confirms
  ↓
createImportedRecipe() server action
  ↓
Save recipe + trigger nutrition analysis
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
  const user = await getAuthenticatedUser();
  const recipe = await prisma.recipe.create({
    data: { ...data, userId: user.id }
  });
  revalidatePath("/recipes");
  return { data: recipe, error: null };
}
```

### 2. Repository Pattern for External APIs
**Each external API has a dedicated client class**

**Example:**
```typescript
// src/lib/edamam.ts
export class EdamamClient {
  async analyzeRecipe(recipe: EdamamRecipeInput): Promise<EdamamAnalyzedRecipe> {
    // API logic here
  }
}

export function getEdamamClient(): EdamamClient {
  // Singleton pattern
}
```

### 3. Service Layer Pattern
**Business logic separated from API clients**

**Example:**
```typescript
// src/lib/edamam-service.ts
export async function analyzeRecipeNutrition(
  recipe: RecipeNutritionInput,
  userId: string
): Promise<NutritionAnalysisResult> {
  // 1. Check cache
  // 2. Process ingredients
  // 3. Call Edamam API
  // 4. Store in cache
  // 5. Return formatted result
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

1. **ETag Caching:** Recipe-level full nutrition data
2. **User Macro Cache:** User-specific 4-macro storage (Edamam policy)
3. **Next.js Caching:** Page-level caching with revalidation

---

## Performance Considerations

### Database Optimization
- Indexes on frequently queried fields (userId, recipeId, date)
- Pagination for large datasets
- Select only required fields
- Prisma query optimization

### API Cost Control
- ETag-based caching (Edamam)
- Request deduplication
- Background processing for non-critical analysis
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
2. **Meal Plan AI Generation:** Edamam Meal Planner API integration
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
