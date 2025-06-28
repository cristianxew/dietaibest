# System Patterns

## Architecture Overview

- **Framework**: Next.js 15 App Router with TypeScript and Bun package manager
- **Database**: Supabase PostgreSQL with Prisma ORM (all types derived from Prisma schema)
- **UI System**: ShadCN UI + Tailwind CSS for consistent design system
- **State Management**: Server actions + React context (minimal client state)
- **External APIs**: Edamam (recipes/meal plans) + Browser-Use Cloud (shopping automation)
- **Task Management**: Claude Task Master for development workflow and complexity analysis

## Key Technical Decisions

### Server-First Architecture

- **Server actions** are the default for all CRUD and business logic
- **Authentication checks** required on ALL server actions
- **API response format**: `{ data: ..., error: "This is the error" }`
- **Error handling**: All errors shown via ShadCN UI toast notifications
- **Minimal client state**: Prefer server-driven UI with real-time updates

### External API Integration Strategy

- **Edamam Dual APIs**: Recipe Search (nutrition analysis) + Meal Planner (automated generation)
- **Browser-Use Cloud**: AI agents handle all browser automation for grocery shopping
- **Service-First Approach**: Leverage professional APIs instead of building custom solutions
- **Rate Limiting**: Client-side debouncing + backend user-based limiting
- **Caching Strategy**: Recipe nutrition (24h), Meal plans (1h), Shopping (no cache)

### Data and Type Management

- **Never build types locally**: Always use Prisma-generated types
- **No mock data** unless explicitly requested and must match Prisma types
- **Real-time macro recalculation**: Triggered on any nutrition-related changes
- **Nutritional tolerance system**: Green (±5%), Yellow (5-15%), Red (>15%)

## Design Patterns

### Component Hierarchy

```plaintext
components/
  ui/                    # ShadCN UI components (never modify directly)
  forms/                 # Reusable form components with react-hook-form + zod
  _components/           # Route-specific components (co-located with pages)
```

### Feature-First Structure

```plaintext
src/app/
  (auth)/               # Authentication routes
  (protected-pages)/    # Authenticated user routes
  (public-pages)/       # Public marketing pages
  api/                  # API routes and server actions
```

### External API Client Structure

```plaintext
src/lib/
  edamam.ts            # Unified client for Recipe Search + Meal Planner APIs
  browser-use.ts       # Browser-Use Cloud API client
  prisma.ts            # Database client (existing)
```

## Task Master Workflow Integration

### Development Lifecycle

1. **Memory Bank Review**: Read all memory-bank/ files before starting
2. **Task Selection**: Use Task Master to identify next logical task
3. **Complexity Analysis**: Tasks Score 8-10 must be expanded to 10-12 subtasks
4. **Implementation**: Follow atomic subtask breakdown
5. **Status Updates**: Mark tasks as done and update progress.md

### Task Complexity Management

- **Score 1-5**: Simple implementation, keep as-is
- **Score 6-7**: Medium complexity, consider expansion
- **Score 8-10**: High complexity, MUST expand to atomic subtasks
- **Atomic Principle**: Each subtask should be 1-2 hours maximum

### Task File Structure

```plaintext
.taskmaster/
  tasks/
    tasks.json           # Main task database
    task-{id}.md         # Individual task files
  reports/
    task-complexity-report.json  # Complexity analysis results
```

## Project Intelligence System

### Cursor Rules Integration

- **5 rule files** capture all patterns, decisions, and standards
- **Development consistency** through documented patterns
- **API integration guidelines** for external services
- **Component standards** and styling conventions
- **Workflow patterns** for feature development lifecycle

### Memory Bank Structure

```plaintext
memory-bank/
  projectbrief.md      # Foundation document (rarely changes)
  productContext.md    # Why this exists, problems solved
  systemPatterns.md    # This file - architecture and patterns
  techContext.md       # Technologies, constraints, dependencies
  activeContext.md     # Current focus, recent changes, next steps
  progress.md          # Implementation status, what's completed
```

## Component Relationships

### Authentication Flow

- **Supabase Auth + next-auth**: Dual authentication system
- **JWT in httpOnly cookies**: Secure token storage
- **Silent refresh mechanism**: Automatic token renewal
- **Route protection**: Middleware + server action checks
- **Context provider**: Global auth state management

### API Integration Flow

```typescript
// External API Pattern
const apiClient = {
  call: async (endpoint, payload) => {
    // Rate limiting check
    // Authentication headers
    // Error handling with retry logic
    // Response transformation
  },
};
```

### Real-time Update Pattern

- **Supabase subscriptions** for database changes
- **Server-sent events** for long-running operations (meal plan generation)
- **Optimistic UI updates** with rollback on failure
- **Toast notifications** for all state changes

## Quality Assurance Patterns

### Code Standards

- **TypeScript strict mode** with ESLint + Prettier
- **Server action authentication** checks mandatory
- **Consistent error responses** with user-friendly messages
- **Mobile-first responsive design** with Tailwind CSS
- **Accessibility standards** WCAG 2.1 AA compliance

### Testing Strategy

- **Component testing**: User interactions, error states, responsive design
- **API testing**: Server actions with/without auth, external API mocking
- **Integration testing**: End-to-end user workflows
- **Performance testing**: Bundle size, loading times, API response times

## Notes

- **Less code, less complexity**: Always choose simplest solution that works
- **MVP focus**: Core features first, enhancements later
- **Service integration**: Prefer external APIs over custom development
- **Documentation-driven**: All patterns and decisions captured in Cursor Rules
