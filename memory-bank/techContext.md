# Tech Context

## Core Technologies

### Framework & Language

- **Next.js 15** (App Router, server actions, TypeScript 5)
- **Bun** (exclusive package manager - never use npm/yarn)
- **TypeScript** (strict mode with ESLint + Prettier)

### Database & ORM

- **Supabase** (PostgreSQL 14 with row-level security)
- **Prisma** (ORM, type source - all data types derived from schema)

### UI & Styling

- **ShadCN UI** (accessible components, never modify directly)
- **Tailwind CSS v3** (mobile-first responsive design)
- **Framer Motion** (animations for drag-and-drop interactions)

### Authentication

- **Supabase Auth** (primary authentication service)
- **next-auth** (JWT handling, Google OAuth integration)
- **JWT in httpOnly cookies** (secure token storage)

## External API Integrations

### Edamam APIs

- **Recipe Search API**: Nutritional analysis for user-created recipes
- **Meal Planner API**: Automated meal plan generation with 28 nutrients
- **Rate Limits**: 20 meal plans/day, 300 recipe calls/minute (Developer tier)
- **Features**: 40 diet labels, custom nutritional targets, shopping list generation

### Browser-Use Cloud API

- **Service**: AI agents for automated grocery shopping
- **Function**: Navigate websites, search products, add to shopping carts
- **Integration**: RESTful API with progress polling and status updates
- **Store Support**: Major grocery chains with real-time availability

### Additional Services

- **Stripe** (billing and subscription management)
- **Supabase Real-time** (live data synchronization)
- **Vercel** (deployment and hosting)

## Development Setup

### Package Management

- **Bun exclusive**: All scripts, dependencies, and package operations
- **No npm/yarn**: Maintain consistency with Bun ecosystem

### Data Access Patterns

- **Prisma types only**: Never create local types for data models
- **Server actions first**: All business logic via Next.js server actions
- **Authentication required**: Every server action must check user authentication
- **Consistent responses**: `{ data: ..., error: "This is the error" }` format

### Development Tools

- **Claude Task Master**: Task management and complexity analysis
- **Cursor Rules**: 5 comprehensive rule files for development consistency
- **Memory Bank**: 6 documentation files for project context and progress

### Testing Framework

- **Vitest**: Fast unit test framework with Jest-compatible API
- **React Testing Library**: Component testing with user-centric approach
- **Playwright**: Cross-browser end-to-end testing (Chromium, Firefox, WebKit)
- **JSdom**: DOM environment for unit tests
- **Coverage Reporting**: Built-in coverage with text, JSON, and HTML output
- **Test Structure**: Organized in `tests/unit/`, `tests/integration/`, and `e2e/` directories

## Technical Constraints

### Development Standards

- **No mock data** unless explicitly requested (must match Prisma types)
- **Minimal client state**: Prefer server-driven UI with real-time updates
- **Mobile-first design**: Responsive breakpoints (sm: 640px, md: 768px, lg: 1024px)
- **Accessibility**: WCAG 2.1 AA compliance with proper ARIA labels

### API Limitations

- **Edamam quotas**: Monitor usage and implement user-based rate limiting
- **Browser-Use costs**: Tier-based pricing requires usage tracking
- **Supabase limits**: Row-level security and connection pooling considerations

### Performance Requirements

- **Bundle size**: ≤ 200 kB main chunk with code splitting
- **Loading states**: Skeleton components for all async operations
- **Error boundaries**: Graceful handling of uncaught errors
- **Offline support**: Service worker for read-only functionality

## Environment Configuration

### Required Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Edamam APIs (shared credentials)
EDAMAM_APP_ID=
EDAMAM_APP_KEY=

# Browser-Use Cloud
BROWSER_USE_API_KEY=

# Next.js Authentication
NEXTAUTH_URL=
NEXTAUTH_SECRET=

# Stripe (optional for billing)
STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
```

## Task Management Integration

### Claude Task Master

- **Location**: `.taskmaster/` directory with tasks.json and individual task files
- **Complexity scoring**: 1-10 scale with automatic expansion for scores 8-10
- **Dependency tracking**: Task relationships and implementation order
- **Progress monitoring**: Real-time status updates and next-task identification

### Development Workflow

1. **Memory Bank review**: Always start with context from memory-bank/ files
2. **Task selection**: Use Task Master to identify next logical implementation
3. **Complexity analysis**: Expand high-complexity tasks into atomic subtasks
4. **Implementation**: Follow detailed subtask breakdown with authentication checks
5. **Documentation**: Update progress.md and activeContext.md after completion

## Dependencies & Versions

### Core Dependencies

- Next.js 15 (App Router)
- React 18 with TypeScript 5
- Prisma ORM with Supabase client
- ShadCN UI + Tailwind CSS
- Bun runtime and package manager

### External Integrations

- Edamam Recipe + Meal Planner APIs
- Browser-Use Cloud automation service
- Supabase Auth + Database + Real-time
- Stripe payment processing

## Notes

- **Simplicity first**: Choose least complex solution that meets requirements
- **Service integration**: Prefer external APIs over custom development
- **Documentation-driven**: All decisions captured in Cursor Rules and Memory Bank
- **Progressive enhancement**: Core functionality works without JavaScript
