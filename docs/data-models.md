# DietAI — Data Models

> Generated: 2026-03-07 | Source: `prisma/schema.prisma` | Version: 1.2.0

## Database

- **Provider**: PostgreSQL
- **Hosting**: Supabase
- **ORM**: Prisma v6 (client generated to `src/generated/prisma`)
- **Migrations**: `prisma/migrations/`
- **Seed**: `prisma/seed.ts`

## Entity Relationship Overview

```
User (1) ──────── (1) UserProfile
                        └──── (many) FamilyMember
User (1) ──────── (many) Recipe
                        ├──── (many) RecipeIngredient
                        ├──── (many) RecipeCategory  [many-to-many]
                        └──── (many) UserFavorite     [many-to-many]
User (1) ──────── (many) MealPlanTemplate
                        ├──── (many) MealPlanDay
                        │           └──── (many) MealPlanMeal → Recipe
                        └──── (many) MealPlanSchedule
User (1) ──────── (many) EdamamUserMacroCache → Recipe
User (1) ──────── (1)   ShoppingPreferences
User (1) ──────── (many) StoreCredential

FdcCache            [global lookup cache]
EdamamRecipeCache   [global Edamam cache, fingerprint-keyed]
```

---

## Models

### User
Primary identity model. Email/password auth.

| Field | Type | Notes |
|---|---|---|
| id | String (UUID) | PK |
| email | String | Unique |
| password | String | Hashed |
| createdAt | DateTime | Auto |
| updatedAt | DateTime | Auto |

Relations: `profile`, `recipes`, `favorites`, `edamamMacroCache`, `mealPlanTemplates`, `mealPlanSchedules`, `shoppingPreferences`, `storeCredentials`

---

### UserProfile
Dietary preferences and physical metrics for a user.

| Field | Type | Notes |
|---|---|---|
| id | String (UUID) | PK |
| userId | String | FK → User (unique, cascade) |
| dateOfBirth | DateTime | — |
| dailyCalories | Int | Target kcal/day |
| carbsGrams | Int | Daily carb target |
| proteinGrams | Int | Daily protein target |
| fatGrams | Int | Daily fat target |
| heightCm | Float | — |
| weightKg | Float | — |
| gender | String | — |
| activityLevel | String | — |
| dietaryGoal | String | e.g., "weight_loss" |
| dietaryType | String[] | e.g., ["vegetarian"] |
| allergies | String[] | — |
| cuisinePrefs | String[] | — |
| onboardingCompleted | Boolean | Default false |

Relations: `user`, `familyMembers`

---

### FamilyMember
Optional family members tied to a user profile.

| Field | Type | Notes |
|---|---|---|
| id | String (UUID) | PK |
| profileId | String | FK → UserProfile (cascade) |
| name | String | — |
| relationship | String | — |
| dateOfBirth | DateTime | — |
| gender | String | — |
| heightCm | Float? | Optional |
| weightKg | Float? | Optional |
| dietaryNeeds | String[] | — |

---

### Recipe
User's personal recipes.

| Field | Type | Notes |
|---|---|---|
| id | String (UUID) | PK |
| userId | String | FK → User (cascade) |
| title | String | — |
| description | String? | — |
| imageUrl | String? | — |
| prepTime | Int? | Minutes |
| cookTime | Int? | Minutes |
| servings | Int | Default 1 |
| difficulty | String? | easy / medium / hard |
| ingredients | Json? | Raw form data `{ name, amount, unit }` |
| instructions | String[] | Step-by-step |
| calories | Float? | Per serving |
| protein | Float? | Per serving |
| carbs | Float? | Per serving |
| fat | Float? | Per serving |
| fiber | Float? | Per serving |
| source | String? | url / manual / imported |
| sourceUrl | String? | — |
| tags | String[] | — |
| isPublic | Boolean | Default false |

Relations: `user`, `categories`, `favoritedBy`, `recipeIngredients`, `edamamMacroCache`, `mealPlanMeals`

---

### RecipeCategory
Global category taxonomy for recipes.

| Field | Type | Notes |
|---|---|---|
| id | String (UUID) | PK |
| name | String | — |
| slug | String | Unique |
| description | String? | — |
| iconName | String? | UI icon identifier |

---

### UserFavorite
Join table — user's favorited recipes.

| Field | Type | Notes |
|---|---|---|
| id | String (UUID) | PK |
| userId | String | FK → User (cascade) |
| recipeId | String | FK → Recipe (cascade) |

Unique constraint: `[userId, recipeId]`

---

### FdcCache
Global cache for USDA FoodData Central API responses.

| Field | Type | Notes |
|---|---|---|
| fdcId | Int | PK (FDC food ID) |
| description | String | — |
| dataType | String | Indexed |
| brandOwner | String? | Max 255 chars |
| foodPortions | Json? | FDC portions array |
| foodNutrients | Json? | FDC nutrients (abridged/full) |
| labelNutrients | Json? | Per-serving info (branded foods) |
| lastFetchedAt | DateTime | Auto |

Indexes: `dataType`, `description`

---

### RecipeIngredient
Parsed ingredients with USDA FDC matches — used for accurate macro resolution.

| Field | Type | Notes |
|---|---|---|
| id | String (UUID) | PK |
| recipeId | String | FK → Recipe (cascade) |
| originalText | String | Raw ingredient line |
| nameNorm | String | Normalized name for matching |
| qty | Float | Parsed quantity |
| unit | String | Normalized unit (g, cup, tbsp…) |
| fdcId | Int? | Matched USDA FDC food ID |
| gramWeight | Float? | Resolved grams (qty × unit) |
| confidence | Float? | Match confidence (0.0–1.0) |
| debugJson | Json? | Troubleshooting data |

Indexes: `recipeId`, `nameNorm`

---

### EdamamRecipeCache
Global cache for Edamam nutrition analysis results. Fingerprint-based deduplication.

| Field | Type | Notes |
|---|---|---|
| id | String (UUID) | PK |
| fingerprint | String | Unique — deterministic hash of recipe content |
| etag | String | Edamam ETag (cost control) |
| recipeData | Json | Original recipe data sent to Edamam |
| fullResponse | Json | Complete Edamam response (all 28 nutrients) |
| lastAnalyzed | DateTime | Auto |
| analysisCount | Int | Usage counter |

Indexes: `fingerprint`, `lastAnalyzed`

---

### EdamamUserMacroCache
Per-user macro cache — stores only 4 macros per Edamam's data retention policy.

| Field | Type | Notes |
|---|---|---|
| id | String (UUID) | PK |
| userId | String | FK → User (cascade) |
| recipeId | String | FK → Recipe (cascade) |
| calories | Float | kcal |
| protein | Float | grams |
| fat | Float | grams |
| netCarbs | Float | total carbs − fiber |
| servings | Int | Default 1 |

Unique constraint: `[userId, recipeId]`
Indexes: `userId`, `recipeId`

---

### MealPlanTemplate
Reusable meal plan templates (no fixed dates — scheduled separately).

| Field | Type | Notes |
|---|---|---|
| id | String (UUID) | PK |
| userId | String | FK → User (cascade) |
| name | String | — |
| duration | Int | Days (e.g., 7 for weekly) |
| mealSlots | String[] | Default: breakfast, lunch, dinner |
| targetCalories | Float? | kcal/day target |
| targetProtein | Float? | g/day target |
| targetCarbs | Float? | g/day target |
| targetFat | Float? | g/day target |
| isPublic | Boolean | Default false |
| shareToken | String? | Unique — for share links |

Relations: `user`, `days`, `schedules`
Indexes: `userId`, `shareToken`

---

### MealPlanSchedule
Tracks when a template is applied to the calendar.

| Field | Type | Notes |
|---|---|---|
| id | String (UUID) | PK |
| templateId | String | FK → MealPlanTemplate (cascade) |
| userId | String | FK → User (cascade) |
| startDate | DateTime | Schedule start date |
| status | String | Default "active" — active / completed / cancelled |

Indexes: `userId`, `templateId`, `startDate`, `[userId, startDate]` (overlap detection)

---

### MealPlanDay
Individual days within a meal plan template (relative, not date-bound).

| Field | Type | Notes |
|---|---|---|
| id | String (UUID) | PK |
| templateId | String | FK → MealPlanTemplate (cascade) |
| dayNumber | Int | Relative day (1, 2, 3…) |

Unique constraint: `[templateId, dayNumber]`
Index: `templateId`

---

### MealPlanMeal
Recipe assignments within a meal plan day.

| Field | Type | Notes |
|---|---|---|
| id | String (UUID) | PK |
| mealPlanDayId | String | FK → MealPlanDay (cascade) |
| recipeId | String | FK → Recipe (cascade) |
| mealType | String | breakfast / lunch / dinner / snack |
| servings | Int | Default 1 (overrides recipe default) |
| sortOrder | Int | Default 0 — ordering within slot |

Indexes: `mealPlanDayId`, `recipeId`, `[mealPlanDayId, mealType]`

---

### ShoppingPreferences
User's preferred store and shopping automation configuration.

| Field | Type | Notes |
|---|---|---|
| id | String (UUID) | PK |
| userId | String | FK → User (unique, cascade) |
| selectedStore | String? | "auchan" / "frisco" / "carrefour" |
| deliveryPreference | String | Default "delivery" — delivery / pickup |
| zipCode | String? | — |
| preferOrganic | Boolean | Default false |
| preferStoreBrand | Boolean | Default false |
| allowSubstitutions | Boolean | Default true |
| maxPricePerItem | Float? | — |

---

### StoreCredential
Encrypted per-store login credentials for shopping automation.

| Field | Type | Notes |
|---|---|---|
| id | String (UUID) | PK |
| userId | String | FK → User (cascade) |
| store | String | "auchan" / "frisco" / "carrefour" |
| email | String | Store account email |
| encryptedPassword | String | AES-256-GCM encrypted |
| iv | String | Initialization vector |
| authTag | String | GCM authentication tag |

Unique constraint: `[userId, store]`
Index: `userId`

---

## Migrations

| Migration | Description |
|---|---|
| `0_init` | Initial schema |
| `20250106_meal_plan_template_refactor` | Template-based meal plan architecture |
