# Active Context

## Current Work Focus

- Defining and documenting the core product scope, features, and architecture in the memory bank.
- Ensuring all initial setup steps are complete and aligned with project goals.

## Recent Changes

- Initialized Next.js project and folder structure.
- Set up Bun, Prisma, ShadCN UI, and organized components.
- Created and filled out memory bank templates for project documentation.

## Next Steps

- Review and approve the PRD and memory bank documentation.
- Once approved, begin planning the first Epic/Page (e.g., Dashboard) with detailed feature breakdown and TDD plan.

## Active Decisions

- All business logic via server actions with authentication/access checks.
- All responses follow `{ data: ..., error: "This is the error" }` format.
- Errors shown via ShadCN UI toast.
- No mock data unless explicitly requested and always in sync with Prisma types.
- Less code, less complexity, MVP-first mindset.
