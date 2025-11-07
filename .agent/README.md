# .agent Documentation Index

**DietAIbook - AI-Powered Meal Planning & Nutrition Management**

Last Updated: 2025-10-25

---

## =Ú Documentation Structure

This directory contains comprehensive documentation for the DietAIbook project, organized into three main categories:

### 1. System Documentation (`/System/`)
Core architecture, database design, and technical specifications for understanding how the system works.

### 2. Task Documentation (`/Tasks/`)
Feature PRDs (Product Requirement Documents) and implementation plans for specific features and capabilities.

### 3. Standard Operating Procedures (`/SOP/`)
Best practices, workflows, and step-by-step guides for common development tasks.

---

## =Â Documentation Index

### System Documentation

#### [Project Architecture](./System/project_architecture.md)
**Purpose:** Complete technical overview of the DietAIbook application

**Contains:**
- Project goals and value propositions
- Complete tech stack breakdown (Next.js 15, Prisma, Supabase, etc.)
- Project structure and folder organization
- Core features detailed explanation:
  - Recipe management (create, import, analyze)
  - Meal planning system (drag-and-drop, macro tracking)
  - Nutritional analysis (Edamam API integration)
  - User onboarding flow
  - Recipe import system (URL + document OCR)
- External integrations:
  - Edamam API (nutrition analysis)
  - USDA FoodData Central (ingredient matching)
  - Browser-Use Cloud (AI web automation)
  - Google Document AI (OCR)
  - Supabase (database + auth)
- Authentication & authorization patterns
- Data flow diagrams
- Key design patterns (Server Actions, Repository, Service Layer)
- Performance and security considerations

**When to read:**
- Onboarding new developers
- Understanding system architecture
- Planning new features
- Troubleshooting integration issues

---

#### [Database Schema](./System/database_schema.md)
**Purpose:** Complete database design documentation with entity relationships

**Contains:**
- Schema overview and design principles
- Entity-relationship diagram
- Core entities:
  - User & UserProfile
  - Recipe & RecipeCategory
  - FamilyMember
  - UserFavorite
- Nutrition & caching models:
  - RecipeIngredient
  - FdcCache (USDA cache)
  - EdamamRecipeCache (ETag-based)
  - EdamamUserMacroCache (policy-compliant)
- Meal planning system:
  - MealPlan
  - MealPlanDay
  - MealPlanMeal
- Relationship mapping and cascade deletes
- Indexes and performance optimization
- Data types, constraints, and validation
- Migration strategy

**When to read:**
- Adding new database tables
- Understanding data relationships
- Planning database migrations
- Optimizing database queries
- Troubleshooting data issues

---

### Task Documentation

Currently no feature-specific PRDs. This section will contain:
- Feature PRDs (Product Requirement Documents)
- Implementation plans
- Technical specifications for specific features
- User stories and acceptance criteria

**Example future documents:**
- `meal_planning_feature.md` - Meal planning system PRD
- `recipe_import_feature.md` - Recipe import system PRD
- `shopping_list_automation.md` - Shopping list AI automation PRD

---

### Standard Operating Procedures

Currently no SOPs documented. This section will contain:
- Step-by-step guides for common tasks
- Development workflows
- Deployment procedures
- Troubleshooting guides

**Example future documents:**
- `adding_schema_migration.md` - How to add database migrations
- `adding_new_page_route.md` - How to add new Next.js routes
- `adding_server_action.md` - How to create server actions
- `integrating_external_api.md` - How to integrate new APIs
- `deployment_checklist.md` - Production deployment steps
- `testing_guidelines.md` - Unit, integration, and E2E testing

---

## =€ Quick Start for New Developers

### 1. Read These First (in order):
1. **[Project README](../README.md)** - Project overview and setup instructions
2. **[Project Architecture](./System/project_architecture.md)** - System overview and tech stack
3. **[Database Schema](./System/database_schema.md)** - Database design and relationships

### 2. Set Up Development Environment:
```bash
# Install dependencies
bun install

# Set up environment variables
cp .env.example .env.local
# Fill in API keys and database URLs

# Initialize database
bun prisma db push
bun prisma db seed

# Start development server
bun dev
```

### 3. Explore Key Directories:
- `src/actions/` - Server-side business logic
- `src/components/` - React UI components
- `src/lib/` - Utilities and API clients
- `src/types/` - TypeScript type definitions
- `prisma/schema.prisma` - Database schema

---

## = Finding Information

### By Topic:

**Tech Stack Questions**
- Next.js / React patterns ’ [Project Architecture - Tech Stack](./System/project_architecture.md#tech-stack)
- Database / Prisma ’ [Database Schema](./System/database_schema.md)

**Feature Implementation**
- Recipe management ’ [Project Architecture - Core Features](./System/project_architecture.md#core-features)
- Meal planning ’ [Project Architecture - Meal Planning System](./System/project_architecture.md#2-meal-planning-system)
- Nutrition analysis ’ [Project Architecture - Nutritional Analysis](./System/project_architecture.md#3-nutritional-analysis)

**External APIs**
- Edamam integration ’ [Project Architecture - External Integrations](./System/project_architecture.md#1-edamam-api)
- Browser-Use ’ [Project Architecture - Browser-Use Cloud](./System/project_architecture.md#3-browser-use-cloud-api)
- USDA FoodData Central ’ [Project Architecture - USDA FoodData Central](./System/project_architecture.md#2-usda-fooddata-central-api)

**Database Questions**
- Table structure ’ [Database Schema - Core Entities](./System/database_schema.md#core-entities)
- Relationships ’ [Database Schema - Relationships](./System/database_schema.md#relationships)
- Indexes ’ [Database Schema - Indexes & Performance](./System/database_schema.md#indexes--performance)

**Authentication**
- Auth flow ’ [Project Architecture - Authentication & Authorization](./System/project_architecture.md#authentication--authorization)
- User permissions ’ [Database Schema - User & UserProfile](./System/database_schema.md#user)

---

## =Ý Documentation Maintenance

### When to Update Documentation:

**After implementing a feature:**
1. Update relevant sections in [Project Architecture](./System/project_architecture.md)
2. Update [Database Schema](./System/database_schema.md) if database changed
3. Add feature PRD to `/Tasks/` if significant
4. Update this README index

**After changing database schema:**
1. Update [Database Schema](./System/database_schema.md)
2. Update schema diagram
3. Document migration strategy
4. Update related sections in Project Architecture

**After adding external integration:**
1. Add to [Project Architecture - External Integrations](./System/project_architecture.md#external-integrations)
2. Document API endpoints, authentication, and usage
3. Add environment variables to project README
4. Create SOP for integration if complex

**After fixing critical bug:**
1. Document root cause in relevant section
2. Add to troubleshooting guide (if pattern emerges)
3. Update best practices in relevant SOP

---

## <¯ Documentation Goals

### Objectives:
1. **Onboard new developers quickly** - All information in one place
2. **Reduce knowledge silos** - Document tribal knowledge
3. **Enable autonomous development** - Answer common questions
4. **Maintain system consistency** - Document patterns and conventions
5. **Facilitate debugging** - Clear data flow and architecture docs

### Principles:
- **Always up-to-date:** Update docs when code changes
- **Single source of truth:** Each concept documented once
- **Cross-referenced:** Link related documents
- **Examples-driven:** Show code examples where possible
- **Searchable:** Use clear headings and keywords

---

## > Contributing to Documentation

### Creating New Documentation:

**New Feature PRD (in `/Tasks/`):**
1. Use template: Title, Overview, Requirements, Implementation Plan, Testing
2. Link to related System docs
3. Update this README index
4. Keep updated during implementation

**New SOP (in `/SOP/`):**
1. Use template: Title, Purpose, Prerequisites, Steps, Examples, Troubleshooting
2. Focus on "how-to" not "why" (architecture docs explain "why")
3. Update this README index
4. Test the SOP yourself before committing

**Updating System Documentation:**
1. Verify information is accurate and current
2. Update Last Updated date
3. Maintain existing structure and format
4. Add cross-references to related sections
5. Update this README if new sections added

---

## =ç Questions or Issues?

If you can't find information in this documentation:
1. Check if it should be documented (if yes, add it!)
2. Search the codebase for examples
3. Ask the team (then document the answer)
4. Review git history for context

**Remember:** If you needed to search for it, the next person will too. Document it!

---

## =Ú Related Resources

### External Documentation:
- [Next.js 15 Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [ShadCN UI Components](https://ui.shadcn.com/)
- [Edamam API Documentation](https://developer.edamam.com/)
- [next-intl Documentation](https://next-intl-docs.vercel.app/)

### Project Files:
- [Main README](../README.md) - Project setup and overview
- [Prisma Schema](../prisma/schema.prisma) - Database schema source
- [Package.json](../package.json) - Dependencies and scripts
- [TypeScript Config](../tsconfig.json) - TS configuration

---

**Last Updated:** 2025-10-25
**Maintained By:** Development Team
**Next Review:** When major features are added or architecture changes
