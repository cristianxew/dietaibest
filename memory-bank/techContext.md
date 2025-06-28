# Tech Context

## Core Technologies

- **Next.js** (App Router, server actions)
- **Bun** (exclusive package manager)
- **Prisma** (ORM, type source)
- **ShadCN UI** (UI components, toast notifications)

## Development Setup

- Use Bun for all package management and scripts.
- All data access via Prisma; types always imported from Prisma.
- No mock data unless explicitly requested; must match Prisma types.
- All business logic in server actions; minimal client-side code.
- All server actions must check authentication and access.
- All server/API responses: `{ data: ..., error: "This is the error" }`.
- Errors shown on frontend via ShadCN UI toast.

## Technical Constraints

- No local types for data models; always use Prisma types.
- No mock data unless requested.
- Minimal client-side state; prefer server-driven UI.

## Dependencies

- Next.js
- Bun
- Prisma
- ShadCN UI

## Notes

- Simplicity and maintainability are top priorities.
- MVP focus: only core features, minimal complexity.
