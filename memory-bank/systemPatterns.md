# System Patterns

## Architecture Overview

- Monorepo Next.js app using Bun as the package manager.
- All business logic handled via server actions (Next.js server components).
- Prisma ORM for all data access; types always derived from Prisma schema.
- ShadCN UI for all UI components and toast notifications.
- No mock data unless explicitly requested; if used, must match Prisma types.
- Never build types locally; always use Prisma types directly.

## Key Technical Decisions

- Server actions are the default for all CRUD and business logic.
- Every server action checks for authentication and user access.
- All API/server responses follow `{ data: ..., error: "This is the error" }` format.
- Errors surfaced to frontend via ShadCN UI toast.
- Minimal client-side state; prefer server-driven UI.

## Design Patterns

- Feature-first folder structure: each route/page has its own `_components` folder for non-reusable components.
- Shared UI components live in `src/components/ui`.
- All data fetching and mutations via server actions.
- Use React context/providers only for global state (e.g., auth, theme).

## Component Relationships

- Pages (Epics) are entry points; each manages its own state and server actions.
- Shared UI components are stateless and reusable.
- Route-specific components live in their respective `_components` folders.

## Project Folder Structure Diagram

```plaintext
src/
  app/
    dashboard/
      _components/         # Dashboard-specific components
      page.tsx
    recipes/
      _components/         # Recipes page components
      page.tsx
    meal-plans/
      _components/         # Meal plans page components
      page.tsx
    grocery-list/
      _components/         # Grocery list page components
      page.tsx
    settings/
      _components/         # Settings page components
      page.tsx
    layout.tsx
    globals.css
  components/
    ui/                    # Shared UI components (ShadCN)
  lib/
    prisma.ts              # Prisma client
  hooks/
  providers/
  types/
```

## Notes

- Never use mock data unless requested, and always sync with Prisma types.
- Less code, less complexity, always production-grade MVP focus.
