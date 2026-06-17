# DietAI - Database Schema Documentation

**Last Updated:** 2025-10-25

## Related Documentation
- [Project Architecture](./project_architecture.md)
- [README Index](../README.md)

---

## Table of Contents
1. [Overview](#overview)
2. [Schema Diagram](#schema-diagram)
3. [Core Entities](#core-entities)
4. [Nutrition & Caching Models](#nutrition--caching-models)
5. [Meal Planning System](#meal-planning-system)
6. [Relationships](#relationships)
7. [Indexes & Performance](#indexes--performance)
8. [Data Types & Constraints](#data-types--constraints)

---

## Overview

### Database Platform
- **Provider:** PostgreSQL (via Supabase)
- **ORM:** Prisma
- **Generated Client:** `src/generated/prisma`
- **Migration Strategy:** `prisma migrate` or `prisma db push`

### Key Design Principles
1. **Row-Level Security:** All user data filtered by `userId`
2. **Cascade Deletes:** User deletion removes all related data
3. **Normalized Design:** Separate tables for recipes, meal plans, and caching
4. **Performance Indexes:** On foreign keys and frequently queried fields
5. **JSON Fields:** Used for flexible/unstructured data (ingredients, nutrients)

---

## Schema Diagram

```
┌─────────────────┐
│      User       │
│─────────────────│
│ id (PK)         │◄───┐
│ email (unique)  │    │
│ password        │    │
│ createdAt       │    │
│ updatedAt       │    │
└─────────────────┘    │
         │             │
         │ 1           │
         │             │
         │ 1           │
         ▼             │
┌─────────────────────┐│
│   UserProfile       ││
│─────────────────────││
│ id (PK)             ││
│ userId (FK, unique) ││
│ dateOfBirth         ││
│ gender              ││
│ heightCm            ││
│ weightKg            ││
│ activityLevel       ││
│ dietaryGoal         ││
│ dietaryType[]       ││
│ allergies[]         ││
│ cuisinePrefs[]      ││
│ dailyCalories       ││
│ proteinGrams        ││
│ carbsGrams          ││
│ fatGrams            ││
│ onboardingCompleted ││
└─────────────────────┘│
         │             │
         │ 1           │
         │             │
         │ *           │
         ▼             │
┌─────────────────────┐│
│   FamilyMember      ││
│─────────────────────││
│ id (PK)             ││
│ profileId (FK)      ││
│ name                ││
│ dateOfBirth         ││
│ gender              ││
│ relationship        ││
│ heightCm            ││
│ weightKg            ││
│ dietaryNeeds[]      ││
└─────────────────────┘│
                       │
┌─────────────────┐    │
│     Recipe      │    │
│─────────────────│    │
│ id (PK)         │    │
│ userId (FK)     │────┘
│ title           │
│ description     │
│ imageUrl        │
│ prepTime        │
│ cookTime        │
│ servings        │
│ difficulty      │
│ ingredients     │  (JSON)
│ instructions[]  │
│ calories        │
│ protein         │
│ carbs           │
│ fat             │
│ fiber           │
│ source          │
│ sourceUrl       │
│ tags[]          │
│ isPublic        │
└─────────────────┘
         │
         │ *
         │
         │ *
         ▼
┌─────────────────────┐
│  RecipeCategory     │
│─────────────────────│
│ id (PK)             │
│ name                │
│ slug (unique)       │
│ description         │
│ iconName            │
└─────────────────────┘

┌─────────────────────┐
│   UserFavorite      │
│─────────────────────│
│ id (PK)             │
│ userId (FK)         │────┐
│ recipeId (FK)       │    │
│ createdAt           │    │
└─────────────────────┘    │
                           │
┌──────────────────────────┘
│
│  ┌─────────────────────────┐
│  │   RecipeIngredient      │
│  │─────────────────────────│
│  │ id (PK)                 │
│  │ recipeId (FK)           │
│  │ originalText            │
│  │ nameNorm                │
│  │ qty                     │
│  │ unit                    │
│  │ fdcId                   │
│  │ gramWeight              │
│  │ confidence              │
│  │ debugJson               │
│  └─────────────────────────┘
│
│  ┌─────────────────────────┐
│  │ EdamamUserMacroCache    │
│  │─────────────────────────│
│  │ id (PK)                 │
│  │ userId (FK)             │
│  │ recipeId (FK)           │
│  │ calories                │
│  │ protein                 │
│  │ fat                     │
│  │ netCarbs                │
│  │ servings                │
│  │ createdAt               │
│  │ updatedAt               │
│  └─────────────────────────┘
│
└──────────────────────────────┐
                               │
┌──────────────────────────────┘
│
│  ┌─────────────────────────┐
│  │      MealPlan           │
│  │─────────────────────────│
│  │ id (PK)                 │
│  │ userId (FK)             │
│  │ name                    │
│  │ startDate               │
│  │ endDate                 │
│  │ mealSlots[]             │
│  │ targetCalories          │
│  │ targetProtein           │
│  │ targetCarbs             │
│  │ targetFat               │
│  │ isActive                │
│  │ isPublic                │
│  │ shareToken (unique)     │
│  └─────────────────────────┘
│           │
│           │ 1
│           │
│           │ *
│           ▼
│  ┌─────────────────────────┐
│  │     MealPlanDay         │
│  │─────────────────────────│
│  │ id (PK)                 │
│  │ mealPlanId (FK)         │
│  │ date                    │
│  │ dayOfWeek               │
│  └─────────────────────────┘
│           │
│           │ 1
│           │
│           │ *
│           ▼
│  ┌─────────────────────────┐
│  │    MealPlanMeal         │
│  │─────────────────────────│
│  │ id (PK)                 │
│  │ mealPlanDayId (FK)      │
│  │ recipeId (FK)           │
│  │ mealType                │
│  │ servings                │
│  │ sortOrder               │
│  └─────────────────────────┘
│
└────────────────────────────────────┐
                                     │
┌────────────────────────────────────┘
│
│  ┌─────────────────────────┐
│  │      FdcCache           │
│  │─────────────────────────│
│  │ fdcId (PK)              │
│  │ description             │
│  │ dataType                │
│  │ brandOwner              │
│  │ foodPortions            │  (JSON)
│  │ foodNutrients           │  (JSON)
│  │ labelNutrients          │  (JSON)
│  │ lastFetchedAt           │
│  └─────────────────────────┘
│
└──────────────────────────────────┐
                                   │
┌──────────────────────────────────┘
│
│  ┌──────────────────────────┐
└──│  EdamamRecipeCache       │
   │──────────────────────────│
   │ id (PK)                  │
   │ fingerprint (unique)     │
   │ etag                     │
   │ recipeData               │  (JSON)
   │ fullResponse             │  (JSON)
   │ lastAnalyzed             │
   │ analysisCount            │
   └──────────────────────────┘
```

---

## Core Entities

### User
**Purpose:** Core user account

```prisma
model User {
  id               String                 @id @default(uuid())
  email            String                 @unique
  password         String
  createdAt        DateTime               @default(now())
  updatedAt        DateTime               @updatedAt

  // Relations
  profile          UserProfile?
  recipes          Recipe[]
  favorites        UserFavorite[]
  edamamMacroCache EdamamUserMacroCache[]
  mealPlans        MealPlan[]
}
```

**Key Constraints:**
- `email` must be unique
- `id` is UUID (default)
- Cascade delete on all relations

**Use Cases:**
- Authentication and authorization
- User ownership of all data
- Session management

---

### UserProfile
**Purpose:** User demographics and dietary preferences

```prisma
model UserProfile {
  id                  String         @id @default(uuid())
  userId              String         @unique
  dateOfBirth         DateTime
  gender              String
  heightCm            Float
  weightKg            Float
  activityLevel       String         // sedentary, light, moderate, active, very_active
  dietaryGoal         String         // lose_weight, maintain, gain_muscle
  dietaryType         String[]       // vegetarian, vegan, keto, paleo, etc.
  allergies           String[]       // peanuts, dairy, gluten, etc.
  cuisinePrefs        String[]       // italian, mexican, asian, etc.
  dailyCalories       Int
  proteinGrams        Int
  carbsGrams          Int
  fatGrams            Int
  onboardingCompleted Boolean        @default(false)
  createdAt           DateTime       @default(now())
  updatedAt           DateTime       @updatedAt

  // Relations
  user                User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  familyMembers       FamilyMember[]
}
```

**Key Constraints:**
- One profile per user (`userId` unique)
- Array fields for multi-select values
- Cascade delete on user deletion

**Use Cases:**
- Onboarding wizard data storage
- Meal plan macro target calculation
- Recipe filtering by dietary restrictions

---

### FamilyMember
**Purpose:** Additional profiles for family members with different dietary needs

```prisma
model FamilyMember {
  id           String      @id @default(uuid())
  profileId    String
  name         String
  dateOfBirth  DateTime
  gender       String
  relationship String       // spouse, child, parent, etc.
  heightCm     Float?
  weightKg     Float?
  dietaryNeeds String[]     // allergies, restrictions
  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  // Relations
  profile      UserProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)
}
```

**Key Constraints:**
- Many family members per profile
- Optional height/weight (for children who may not track)
- Cascade delete on profile deletion

**Use Cases:**
- Family meal planning
- Multiple dietary restriction tracking
- Serving size adjustments

---

### Recipe
**Purpose:** User-created or imported recipes

```prisma
model Recipe {
  id           String   @id @default(uuid())
  userId       String
  title        String
  description  String?
  imageUrl     String?
  prepTime     Int?     // minutes
  cookTime     Int?     // minutes
  servings     Int      @default(1)
  difficulty   String?  // easy, medium, hard
  ingredients  Json?    // Raw ingredients { name, amount, unit }
  instructions String[] // Array of steps

  // Nutritional information per serving
  calories Float?
  protein  Float?
  carbs    Float?
  fat      Float?
  fiber    Float?

  // Metadata
  source    String?  // manual, url, imported
  sourceUrl String?
  tags      String[]
  isPublic  Boolean  @default(false)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  user              User                   @relation(fields: [userId], references: [id], onDelete: Cascade)
  categories        RecipeCategory[]
  favoritedBy       UserFavorite[]
  recipeIngredients RecipeIngredient[]
  edamamMacroCache  EdamamUserMacroCache[]
  mealPlanMeals     MealPlanMeal[]
}
```

**Key Constraints:**
- Each recipe belongs to one user
- `ingredients` stored as JSON for flexibility
- `instructions` as string array for ordered steps
- Cascade delete on user deletion

**JSON Structure for `ingredients`:**
```json
[
  {
    "name": "all-purpose flour",
    "amount": 2,
    "unit": "cups"
  },
  {
    "name": "sugar",
    "amount": 1,
    "unit": "cup"
  }
]
```

**Use Cases:**
- Recipe creation and management
- Meal plan recipe assignment
- Nutrition tracking
- Recipe sharing (public recipes)

---

### RecipeCategory
**Purpose:** Categorize recipes (breakfast, lunch, dinner, vegetarian, etc.)

```prisma
model RecipeCategory {
  id          String  @id @default(uuid())
  name        String
  slug        String  @unique
  description String?
  iconName    String?  // lucide-react icon name
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  // Relations
  recipes Recipe[]
}
```

**Key Constraints:**
- `slug` must be unique (URL-friendly identifier)
- Many-to-many with Recipe (implicit join table)

**Default Categories:**
- Breakfast
- Lunch
- Dinner
- Snacks
- Desserts
- Beverages
- Vegetarian
- Vegan
- Gluten-Free
- Low-Carb

**Use Cases:**
- Recipe filtering
- Recipe organization
- UI grouping and icons

---

### UserFavorite
**Purpose:** Track user's favorite recipes

```prisma
model UserFavorite {
  id       String @id @default(uuid())
  userId   String
  recipeId String
  createdAt DateTime @default(now())

  // Relations
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  recipe Recipe @relation(fields: [recipeId], references: [id], onDelete: Cascade)

  @@unique([userId, recipeId])
}
```

**Key Constraints:**
- Unique constraint on `userId + recipeId` (prevent duplicates)
- Cascade delete on user or recipe deletion

**Use Cases:**
- Quick access to favorite recipes
- Recipe filtering by favorites
- User preference tracking

---

## Nutrition & Caching Models

### RecipeIngredient
**Purpose:** Parsed ingredient data with USDA FoodData Central matches.
**Populated on recipe creation (DIE-42)** by `persistRecipe()` from the FDC
analysis (`analyzeRecipeProfileAction.items`) — one row per ingredient with its
resolved `fdcId`, `gramWeight`, and `confidence`. Re-saves use delete-then-insert.

```prisma
model RecipeIngredient {
  id           String @id @default(uuid())
  recipeId     String
  originalText String  // "2 cups all-purpose flour"
  nameNorm     String  // "all purpose flour"
  qty          Float   // 2.0
  unit         String  // "cup"
  fdcId        Int?    // USDA FDC food ID
  gramWeight   Float?  // Resolved grams
  confidence   Float?  // Matching confidence (0.0-1.0)
  debugJson    Json?   // Debug info

  // Relations
  recipe Recipe @relation(fields: [recipeId], references: [id], onDelete: Cascade)

  @@index([recipeId])
  @@index([nameNorm])
}
```

**Key Constraints:**
- Indexed on `recipeId` and `nameNorm` for performance
- Optional `fdcId` (may not match to USDA database)
- Cascade delete on recipe deletion

**Use Cases:**
- Ingredient matching to USDA database
- Granular nutrition calculation
- Debug and troubleshooting ingredient parsing

---

### FdcCache
**Purpose:** Cache USDA FoodData Central API responses

```prisma
model FdcCache {
  fdcId           Int      @id
  description     String
  dataType        String   // Foundation, SR Legacy, Branded, etc.
  brandOwner      String?  @db.VarChar(255)
  foodPortions    Json?    // Portion size data
  foodNutrients   Json?    // Full nutritional breakdown
  labelNutrients  Json?    // Branded food label info
  lastFetchedAt   DateTime @default(now())
  nutrientProfile String   @default("core") // "core" (5 macros) | "extended" (full registry)

  @@index([dataType])
  @@index([description])
}
```

**Key Constraints:**
- `fdcId` is primary key (USDA's unique identifier)
- Indexes on `dataType` and `description` for search
- JSON fields for flexible storage

**Use Cases:**
- Reduce API calls to USDA (food *detail* step)
- Offline ingredient matching
- Performance optimization

---

### FdcSearchCache
**Purpose:** Cache the USDA FDC ingredient *search* step (DIE-46). Complements
`FdcCache` (which caches food *detail*) so a recipe analysis issues no live USDA
search for an ingredient already seen.

```prisma
model FdcSearchCache {
  query         String   @id // normalized query (lowercased, whitespace-collapsed)
  results       Json         // cached FdcSearchFood[] from the search endpoint
  lastFetchedAt DateTime @default(now())

  @@index([lastFetchedAt])
}
```

**Key Constraints:**
- `query` (normalized) is the primary key — repeated/shared ingredients collapse onto one row
- Index on `lastFetchedAt` for stale-entry maintenance

**Freshness:** 90-day TTL (consistent with `FdcCache`'s unknown-dataType
fallback). Managed by `searchFoodsCached` in `src/lib/fdcRepo.ts`; serves stale
on USDA error when a row exists (rate-limit resilience).

---

### EdamamRecipeCache
**Purpose:** Cache Edamam API recipe analysis responses (ETag-based)

```prisma
model EdamamRecipeCache {
  id            String   @id @default(uuid())
  fingerprint   String   @unique  // Hash of recipe content
  etag          String             // ETag from Edamam API
  recipeData    Json               // Original request
  fullResponse  Json               // Complete API response
  lastAnalyzed  DateTime @default(now())
  analysisCount Int      @default(1)

  @@index([fingerprint])
  @@index([lastAnalyzed])
}
```

**Key Constraints:**
- `fingerprint` is unique (deterministic hash)
- Indexes for cache lookups and expiration
- JSON fields for full API response storage

**Fingerprint Generation:**
```typescript
// Title + sorted ingredient list
const fingerprint = createHash('sha256')
  .update(title + ingredients.sort().join(','))
  .digest('hex');
```

**ETag Flow:**
1. First analysis: Store response + ETag
2. Subsequent analysis: Send ETag in `If-None-Match` header
3. 304 Not Modified: Reuse cached data (no API quota usage)
4. 200 OK: Update cache with new data + ETag

**Use Cases:**
- Reduce Edamam API costs
- Fast nutrition re-analysis
- Support for recipe modifications

---

### EdamamUserMacroCache
**Purpose:** User-specific cacheable macros (Edamam policy compliance)

```prisma
model EdamamUserMacroCache {
  id       String @id @default(uuid())
  userId   String
  recipeId String

  // Only 4 macros allowed per Edamam policy
  calories Float  // kcal
  protein  Float  // grams
  fat      Float  // grams
  netCarbs Float  // grams (total carbs - fiber)

  servings  Int      @default(1)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  recipe Recipe @relation(fields: [recipeId], references: [id], onDelete: Cascade)

  @@unique([userId, recipeId])
  @@index([userId])
  @@index([recipeId])
}
```

**Key Constraints:**
- Unique constraint on `userId + recipeId` (one cache per user per recipe)
- Only 4 macros stored (Edamam policy: no persistent storage of full nutrients)
- Cascade delete on user or recipe deletion

**Edamam Policy Compliance:**
- Full nutritional data (28 nutrients) can only be displayed, not stored
- User-specific macro caching allowed for 4 core macros
- Must re-fetch full nutrients from Edamam API or cache for display

**Use Cases:**
- Meal plan macro calculations
- User-specific nutrition tracking
- Quick macro lookups without API calls

---

## Meal Planning System

### MealPlan
**Purpose:** Weekly/custom-duration meal plan

```prisma
model MealPlan {
  id     String @id @default(uuid())
  userId String
  name   String

  // Date range
  startDate DateTime
  endDate   DateTime

  // Meal configuration
  mealSlots String[] @default(["breakfast", "lunch", "dinner"])

  // Macro targets (daily averages)
  targetCalories Float?
  targetProtein  Float?
  targetCarbs    Float?
  targetFat      Float?

  // Status
  isActive Boolean @default(false)  // Only one active plan per user
  isPublic Boolean @default(false)
  shareToken String? @unique

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // Relations
  user User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  days MealPlanDay[]

  @@index([userId])
  @@index([shareToken])
  @@index([userId, isActive])
}
```

**Key Constraints:**
- Only one `isActive` plan per user (enforced in server actions)
- `shareToken` unique for public sharing
- `mealSlots` array defines which meals to show per day
- Cascade delete on user deletion

**Meal Slot Options:**
- `breakfast`
- `morningSnack`
- `lunch`
- `afternoonSnack`
- `dinner`
- `eveningSnack`
- `snack`

**Use Cases:**
- Weekly meal planning (7 days)
- Custom duration plans (3-day, 14-day, etc.)
- Macro target tracking
- Template/schedule system

---

### MealPlanDay
**Purpose:** Single day within a meal plan

```prisma
model MealPlanDay {
  id         String   @id @default(uuid())
  mealPlanId String
  date       DateTime  // Specific date (YYYY-MM-DD)
  dayOfWeek  Int       // 0=Sunday, 1=Monday, ..., 6=Saturday
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  // Relations
  mealPlan MealPlan       @relation(fields: [mealPlanId], references: [id], onDelete: Cascade)
  meals    MealPlanMeal[]

  @@unique([mealPlanId, date])
  @@index([mealPlanId])
  @@index([date])
}
```

**Key Constraints:**
- Unique constraint on `mealPlanId + date` (one entry per day)
- `dayOfWeek` for UI display (calendar view)
- Cascade delete on meal plan deletion

**Use Cases:**
- Calendar display
- Drag-and-drop day selection
- Daily macro aggregation

---

### MealPlanMeal
**Purpose:** Individual meal assignment within a day

```prisma
model MealPlanMeal {
  id            String @id @default(uuid())
  mealPlanDayId String
  recipeId      String
  mealType      String  // breakfast, lunch, dinner, snack
  servings      Int     @default(1)
  sortOrder     Int     @default(0)  // Order within meal slot
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  // Relations
  mealPlanDay MealPlanDay @relation(fields: [mealPlanDayId], references: [id], onDelete: Cascade)
  recipe      Recipe      @relation(fields: [recipeId], references: [id], onDelete: Cascade)

  @@index([mealPlanDayId])
  @@index([recipeId])
  @@index([mealPlanDayId, mealType])
}
```

**Key Constraints:**
- Many meals per day per meal type
- `servings` can override recipe default
- `sortOrder` for ordering multiple meals in same slot
- Cascade delete on day or recipe deletion

**Use Cases:**
- Recipe assignment to meal slots
- Drag-and-drop meal reordering
- Serving size adjustments
- Macro calculation per meal

---

## Relationships

### One-to-One Relationships
- `User` ↔ `UserProfile` (one profile per user)

### One-to-Many Relationships
- `User` → `Recipe[]` (user owns many recipes)
- `User` → `UserFavorite[]` (user has many favorites)
- `User` → `MealPlan[]` (user creates many meal plans)
- `UserProfile` → `FamilyMember[]` (profile has many family members)
- `Recipe` → `RecipeIngredient[]` (recipe has many parsed ingredients)
- `MealPlan` → `MealPlanDay[]` (plan has many days)
- `MealPlanDay` → `MealPlanMeal[]` (day has many meals)

### Many-to-Many Relationships
- `Recipe` ↔ `RecipeCategory` (implicit join table via Prisma)
- `User` ↔ `Recipe` (via `UserFavorite` explicit join table)

### Cascade Delete Chains
When a `User` is deleted:
1. `UserProfile` deleted
2. `FamilyMember[]` deleted (via profile)
3. `Recipe[]` deleted
4. `RecipeIngredient[]` deleted (via recipes)
5. `EdamamUserMacroCache[]` deleted (via recipes)
6. `UserFavorite[]` deleted
7. `MealPlan[]` deleted
8. `MealPlanDay[]` deleted (via plans)
9. `MealPlanMeal[]` deleted (via days)

---

## Indexes & Performance

### Primary Indexes (Automatic)
All `@id` fields are automatically indexed.

### Foreign Key Indexes
Foreign keys are automatically indexed by Prisma for performance.

### Custom Indexes

**FdcCache:**
- `@@index([dataType])` - Filter by food type
- `@@index([description])` - Search by ingredient name

**EdamamRecipeCache:**
- `@@index([fingerprint])` - Cache lookups
- `@@index([lastAnalyzed])` - Cache expiration

**RecipeIngredient:**
- `@@index([recipeId])` - Recipe lookups
- `@@index([nameNorm])` - Ingredient searches

**EdamamUserMacroCache:**
- `@@index([userId])` - User nutrition history
- `@@index([recipeId])` - Recipe macro lookups

**MealPlan:**
- `@@index([userId])` - User's meal plans
- `@@index([shareToken])` - Public sharing lookups
- `@@index([userId, isActive])` - Active plan per user

**MealPlanDay:**
- `@@index([mealPlanId])` - Days in plan
- `@@index([date])` - Date-based queries

**MealPlanMeal:**
- `@@index([mealPlanDayId])` - Meals per day
- `@@index([recipeId])` - Recipe usage tracking
- `@@index([mealPlanDayId, mealType])` - Meals by slot

---

## Data Types & Constraints

### Common Patterns

**UUIDs:**
- All primary keys use `@default(uuid())`
- Benefits: Distributed ID generation, no collisions

**Timestamps:**
- `createdAt` with `@default(now())`
- `updatedAt` with `@updatedAt`

**Arrays:**
- `String[]` for tags, allergies, dietary preferences
- PostgreSQL array support
- Use `hasSome` for filtering in Prisma

**JSON Fields:**
- `Json` type for flexible/unstructured data
- Used for: ingredients, API responses, debug info
- Queryable with Prisma JSON filtering

**Unique Constraints:**
- `@unique` for single-field uniqueness
- `@@unique([field1, field2])` for composite uniqueness

### Validation Strategy

**Schema-Level:**
- Required fields (no `?`)
- Default values
- Foreign key constraints

**Application-Level:**
- Zod schemas in `src/types/`
- Form validation (React Hook Form)
- Server Action validation

**Database-Level:**
- Foreign key constraints
- Unique constraints
- Check constraints (if needed)

---

## Migration Strategy

### Development
```bash
# Push schema changes without migration files
bun prisma db push
```

### Production
```bash
# Create migration files
bun prisma migrate dev --name description

# Apply migrations
bun prisma migrate deploy
```

### Schema Changes Best Practices
1. **Always backup before migrations**
2. **Test migrations on staging first**
3. **Use reversible migrations when possible**
4. **Document breaking changes**
5. **Coordinate with frontend changes**

---

**End of Database Schema Documentation**
