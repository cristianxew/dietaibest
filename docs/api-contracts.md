# DietAI — API Contracts

> Generated: 2026-03-07 | Scan Level: Quick (pattern-based) | Version: 1.2.0

> **Note**: This document was generated via Quick Scan (directory structure analysis). Exact request/response schemas should be verified against source files in `src/app/api/`.

## Overview

DietAI uses Next.js App Router API routes for:
1. External API proxies (Edamam, USDA FDC)
2. Async task workflows (shopping automation, recipe import)
3. Authentication endpoints

All mutation operations (CRUD) are handled via **Server Actions** in `src/actions/` — not API routes.

---

## Authentication

### `[...nextauth]` — NextAuth Handler
**Path**: `/api/auth/[...nextauth]`
**Methods**: GET, POST
**Purpose**: NextAuth.js catch-all handler. Manages sign-in, sign-out, session, CSRF, and OAuth callbacks.

### Token Refresh
**Path**: `/api/auth/refresh`
**Method**: POST
**Purpose**: Refresh expired Supabase/NextAuth session tokens.

---

## Health

### Health Check
**Path**: `/api/health`
**Method**: GET
**Purpose**: Basic health/readiness check endpoint.
**Response**: `{ status: "ok" }` (or similar)

---

## USDA FoodData Central

### Food Search
**Path**: `/api/fdc/search`
**Method**: GET (or POST)
**Purpose**: Proxy to USDA FoodData Central API. Searches for foods by name. Results are cached in `FdcCache` table.

**Query params** (inferred):
- `q` — Search query string
- `pageSize?` — Results per page

**Response** (inferred from FdcCache schema):
```json
{
  "foods": [
    {
      "fdcId": 123456,
      "description": "Chicken breast, cooked",
      "dataType": "SR Legacy",
      "brandOwner": null,
      "foodPortions": [...],
      "foodNutrients": [...],
      "labelNutrients": null
    }
  ]
}
```

---

## Nutrition Analysis

### Analyze Recipe
**Path**: `/api/nutrition/analyze`
**Method**: POST
**Purpose**: Sends recipe to Edamam Nutrition Analysis API. Results cached in `EdamamRecipeCache` (fingerprint-based). Returns full 28-nutrient breakdown.

**Request body** (inferred):
```json
{
  "title": "Chicken Salad",
  "ingr": ["200g chicken breast", "1 tbsp olive oil", "..."]
}
```

**Response** (inferred from EdamamRecipeCache schema):
```json
{
  "calories": 350,
  "totalNutrients": { ... },
  "totalDaily": { ... },
  "dietLabels": ["..."],
  "healthLabels": ["..."],
  "etag": "abc123"
}
```

---

## Recipe Import

### Import from URL (start task)
**Path**: `/api/recipes/import/url`
**Method**: POST
**Purpose**: Starts an async recipe import from a given URL. Returns a `taskId` for polling.

**Request body**:
```json
{ "url": "https://example.com/recipe" }
```

**Response**:
```json
{ "taskId": "uuid-task-id" }
```

### Import URL — Poll Status
**Path**: `/api/recipes/import/url/status`
**Method**: GET
**Query params**: `taskId`
**Purpose**: Polls the status of a URL import task.

**Response**:
```json
{
  "taskId": "uuid-task-id",
  "status": "pending" | "processing" | "completed" | "failed",
  "result": { ... } | null
}
```

### Import URL — Get Result
**Path**: `/api/recipes/import/url/[taskId]`
**Method**: GET
**Purpose**: Fetch the final result of a completed URL import task.

### Import from Document (OCR)
**Path**: `/api/recipes/import/document`
**Method**: POST
**Purpose**: Extracts recipe from an uploaded image or PDF using Google Cloud Document AI.

**Request**: `multipart/form-data` with file attachment (inferred)

**Response**: Parsed recipe data object (inferred)

---

## Shopping Automation

### Shopping List CRUD
**Path**: `/api/shopping`
**Methods**: GET, POST, PUT, DELETE
**Purpose**: Manage the user's shopping list items.

### Start Automation
**Path**: `/api/shopping/automate`
**Method**: POST
**Purpose**: Triggers Browser-Use Cloud AI agent to automatically fill a grocery cart on the user's selected store. Returns a `taskId` for polling.

**Request body** (inferred):
```json
{
  "items": ["2kg chicken breast", "1L olive oil", "..."],
  "store": "auchan" | "frisco" | "carrefour"
}
```

**Response**:
```json
{ "taskId": "uuid-task-id" }
```

### Automation — Poll Status
**Path**: `/api/shopping/automate/status`
**Method**: GET
**Query params**: `taskId`
**Purpose**: Polls the real-time status of a running shopping automation.

**Response**:
```json
{
  "taskId": "uuid-task-id",
  "status": "pending" | "running" | "completed" | "failed",
  "progress": 0.75,
  "message": "Adding item 3 of 4..."
}
```

### Automation — Get Result
**Path**: `/api/shopping/automate/[taskId]`
**Method**: GET
**Purpose**: Fetch the final result of a completed shopping automation task.

---

## Async Task Pattern

Long-running operations follow the fire-and-poll pattern:

```
1. POST /api/{resource}/automate  →  { taskId }
2. GET  /api/{resource}/automate/status?taskId=xxx  →  { status, progress }
   (repeat until status === "completed" or "failed")
3. GET  /api/{resource}/automate/{taskId}  →  final result
```

This is used for:
- Shopping automation (Browser-Use Cloud)
- Recipe URL import
- Recipe document OCR import

---

## Server Actions (not API routes)

All user-facing CRUD operations are handled via Next.js Server Actions in `src/actions/`. These are called directly from React components and include:

- User profile management
- Recipe create/update/delete
- Meal plan template management
- Meal plan scheduling
- Shopping preferences

> For full Server Action signatures, see source files in `src/actions/`.
