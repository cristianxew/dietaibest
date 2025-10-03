<PRD>
# DietAIbook - Product Requirements Document

---

## 1. Introduction

DietAIbook is a comprehensive meal planning and nutrition management web application that leverages AI agents to automate the entire process from recipe storage to grocery shopping. This document outlines the functional and technical requirements for developing a responsive Next.js application that helps users create balanced meal plans and provides a one-click shopping experience through automated browser agents.

The application targets health-conscious individuals who want to streamline their meal planning, nutrition tracking, and grocery shopping processes while maintaining accurate macro-nutrient balance in their diets.

## 2. Product overview

The DietAIbook front-end is a responsive single-page application (SPA) built with **Next.js 15** and **TypeScript**. It enables users to:

- create an account or sign in with Google
- complete a three-step onboarding wizard that determines dietary goals and preferences
- browse, create, and edit recipes (manual entry, URL scrape, image/PDF OCR)
- auto-generate or manually build weekly meal plans that balance calories and macros
- produce a consolidated shopping list and perform one-click purchase at a preferred grocery store
- manage profile, family members, language, and subscription billing

The app consumes typed REST/tRPC endpoints provided by the DietAIbook backend and third-party services (Edamam, Browser-Use Agent, Stripe, Supabase).

## 3. Goals and objectives

### Primary goals

- Reduce meal planning time from hours to minutes through AI automation
- Eliminate manual grocery shopping list creation and store navigation
- Ensure nutritional accuracy in all meal plans and recipes
- Provide seamless multi-language support (EN, PL, ES)
- Achieve high accessibility standards (WCAG 2.1 AA)

## 4. Target audience

### Primary users

- Health-conscious individuals aged 25-45
- Fitness enthusiasts tracking macronutrients
- Busy professionals seeking meal planning automation
- Families wanting organized meal preparation

### User personas

- **The Fitness Tracker**: Needs precise macro counting and meal variety
- **The Busy Parent**: Requires quick meal planning for family with dietary restrictions
- **The Nutrition Newbie**: Wants guidance on balanced eating with minimal effort
- **The Tech-Savvy Cook**: Appreciates automation and AI-powered features

## 5. Features and requirements

### 5.1 Global & architectural

- **FR-G1** Next.js 15 SPA with Shadcn UI, CSS/SASS modules, TypeScript.
- **FR-G2** Server Actions / typed fetch for data operations.
- _…see Appendix A for full list._

### 5.2 Authentication & onboarding

#### Profile creation and onboarding

- Multi-step wizard collecting user demographics, goals, and preferences
- Integration with Supabase Auth and Google OAuth
- Macro calculator for automatic nutritional target setting
- Family member profile management

#### Settings management

- Profile editing with real-time macro recalculation
- Multi-language support with persistent preferences
- Store preference configuration
- Billing management through Stripe integration

### 5.3 Core navigation & pages

Routes, behaviour, and UI elements as defined in section 3 of the functional spec (dashboard, recipes, meal plans, shopping list, settings).

### 5.4 Recipes module

#### Recipe storage and organization

- Multiple input methods: manual form, URL import, image OCR, PDF upload
- Automatic macro calculation via Edamam API integration
- Categorization and tagging system
- Favorites management with sync across devices

#### Recipe discovery and search

- Tabbed interface: In-house, My Recipes, Favourites
- Advanced filtering and sorting capabilities
- Detailed recipe view with ingredients, instructions, and nutritional information

### 5.5 Meal-plan module

#### AI-powered meal plan generation

- Automated weekly meal plan creation based on user preferences
- Source selection: in-house recipes, favorites, or mixed
- Drag-and-drop manual editing interface
- Real-time macro validation and adjustment

#### Plan management

- Multiple plan storage and organization
- Share and export functionality (PDF)
- Macro progress tracking with visual indicators

### 5.6 Shopping list & one-click purchase

#### Shopping list generation

- Date-range based ingredient consolidation
- Quantity adjustment with real-time recalculation
- Category-based organization with pantry management
- PDF export functionality

#### One-click shopping automation

- Browser-Use agent integration for automated cart filling
- Store selection and product matching
- Progress tracking with user feedback
- Graceful handling of unavailable items

### 5.7 Settings & localisation

- Language switcher (EN/PL/ES), preferred store, macro recalculation, Stripe billing portal (**FR-SET1**–**SET4**).

### 5.8 Non-functional

- Offline read-only service-worker mode (**FR-NF3**).
- Error boundaries, skeleton loaders, toast notifications (**FR-G8**, **NF-F5**).

## 6. User stories and acceptance criteria

| ID         | User story                                                                                                                               | Acceptance criteria                                                                                                                                                                                                       |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ST-101** | _As a visitor, I want to sign up with email so that I can create a DietAIbook account._                                                  | **AC1** “Sign up” form validates required fields.<br>**AC2** User receives magic-link email.<br>**AC3** Clicking link activates account and redirects to onboarding.<br>**AC4** Duplicate email shows error.              |
| **ST-102** | _As an authenticated user, I want my JWT to refresh silently so that long sessions remain active._                                       | **AC1** When an API call returns 401, front-end requests `/auth/refresh`.<br>**AC2** If refresh succeeds, original request retries.<br>**AC3** If refresh fails, user is logged out.                                      |
| **ST-103** | _As a new user, I want to complete a three-step onboarding wizard so that my macro targets are calculated._                              | **AC1** Wizard cannot advance until required fields filled.<br>**AC2** “Back” preserves state.<br>**AC3** Step 2 calls `/api/macros/estimate` and displays preview.<br>**AC4** Finish stores profile and opens dashboard. |
| **ST-104** | _As a user, I want to add family members during onboarding so that meal plans reflect household size._                                   | **AC1** “Add member” opens secondary form.<br>**AC2** Members persist to profile and are editable in settings.                                                                                                            |
| **ST-105** | _As a user, I want to import a recipe via URL so that I don’t type ingredients manually._                                                | **AC1** Pasting a valid URL triggers scrape; success pre-fills form.<br>**AC2** Unsupported site returns descriptive error.                                                                                               |
| **ST-106** | _As a user, I want to upload a recipe PDF and extract its ingredients._                                                                  | **AC1** Upload accepts PDF ≤ 10 MB.<br>**AC2** OCR returns structured list.<br>**AC3** User can edit before saving.                                                                                                       |
| **ST-107** | _As a user, I want macro chips to show kcal and P/C/F grams and percentages._                                                            | **AC1** Macro badge renders within recipe card and detail.<br>**AC2** High/low macros coloured per tokens.                                                                                                                |
| **ST-108** | _As a user, I want to favourite a recipe so that I can find it quickly later._                                                           | **AC1** Clicking star toggles instant state (optimistic UI).<br>**AC2** Failure reverts and shows toast.<br>**AC3** Favourites filter lists only starred recipes.                                                         |
| **ST-109** | _As a user, I want to auto-generate a weekly meal plan so that it fits my macro targets._                                                | **AC1** Clicking “Auto-generate” calls `/api/ai/meal-plan`.<br>**AC2** Progress bar shows SSE status.<br>**AC3** Result meets ±5 % tolerance.                                                                             |
| **ST-110** | _As a user, I want to drag a recipe onto a calendar cell so that it schedules that meal._                                                | **AC1** Drag-drop updates grid < 50 ms.<br>**AC2** Macro totals recalc in real time.<br>**AC3** Undo (Ctrl+Z) reverts last drag.                                                                                          |
| **ST-111** | _As a user, I want saving a meal plan to persist it in my account._                                                                      | **AC1** POST `/api/meal-plans` returns ID.<br>**AC2** Success toast and redirect.<br>**AC3** Network error shows retry.                                                                                                   |
| **ST-112** | _As a user, I want to download my shopping list as PDF._                                                                                 | **AC1** “Download PDF” invokes endpoint.<br>**AC2** Browser downloads with correct filename.<br>**AC3** Button disabled until list ready.                                                                                 |
| **ST-113** | _As a user, I want to adjust quantities in the shopping list and see totals update._                                                     | **AC1** ± buttons change quantity with debounce ≤ 200 ms.<br>**AC2** Macros recalc instantly.<br>**AC3** Negative values revert.                                                                                          |
| **ST-114** | _As a user, I want to purchase my list in one click so that items are added to my cart._                                                 | **AC1** “Add to cart” sends payload and shows spinner.<br>**AC2** Front-end polls every 3 s.<br>**AC3** Success opens store cart URL.<br>**AC4** Partial success lists skipped items.                                     |
| **ST-115** | _As a user, I want unavailable items marked in red and suggestions offered._                                                             | **AC1** Backend-flagged items display red.<br>**AC2** Click opens edit suggestion dialog.                                                                                                                                 |
| **ST-116** | _As a user, I want to switch language to Spanish and see all UI strings translated._                                                     | **AC1** Dropdown updates locale and cookie.<br>**AC2** Reload persists choice.                                                                                                                                            |
| **ST-117** | _As a user, I want offline read-only access to my saved recipes and plans._                                                              | **AC1** Service worker caches assets/IndexedDB.<br>**AC2** Offline banner shows.<br>**AC3** Editing disabled offline.                                                                                                     |
| **ST-118** | _As a developer, I want a normalised relational schema for users, recipes, plans, and shopping items so that data integrity is ensured._ | **AC1** ER diagram documented.<br>**AC2** Tables use UUID PKs/foreign keys.<br>**AC3** Composite indices for frequent queries.                                                                                            |
| **ST-119** | _As a screen-reader user, I want correct aria labels on buttons and interactive controls._                                               | **AC1** Axe/Lighthouse shows zero critical issues.<br>**AC2** All components implement role/aria attributes.                                                                                                              |
| **ST-120** | _As an analyst, I want to track the plan→cart funnel so that we can measure conversion._                                                 | **AC1** Plausible events fired on plan save/checkout success.<br>**AC2** Events contain anonymised IDs only.                                                                                                              |
| **ST-121** | _As a user, I want theme to persist across sessions._                                                                                    | **AC1** Preference stored in Supabase profile and cookie.<br>**AC2** Toggling rehydrates without reload.                                                                                                                  |
| **ST-122** | _As a user, I want graceful error pages with a retry option if something goes wrong._                                                    | **AC1** Error boundary catches uncaught errors.<br>**AC2** “Try again” refetches last request.                                                                                                                            |
| **ST-123** | _As a user, I want low initial download size for faster first load._                                                                     | **AC1** `next build` shows ≤ 200 kB main chunk.<br>**AC2** Editor and planner code-split.                                                                                                                                 |

_(Edge-case stories may be added during backlog refinement.)_

## 7. Technical requirements / stack

| Layer          | Tech / library                                                         | Notes                                      |
| -------------- | ---------------------------------------------------------------------- | ------------------------------------------ |
| Framework      | **Next.js 15 App Router**                                              | Server Actions; ISR for marketing pages    |
| Language       | TypeScript 5                                                           | Strict; ESLint + Prettier                  |
| UI kit         | Shadcn UI + Tailwind CSS v3                                            | Accessible components, custom themes       |
| State          | React context + React Query                                            | Prefetch mutations, skeleton UI            |
| Routing / i18n | `next-router`, `next-intl`                                             | EN, PL, ES; metric units, PLN currency     |
| Authentication | Supabase Auth + `next-auth`                                            | JWT in httponly cookie                     |
| API layer      | tRPC (preferred) or typed `fetch`                                      | Shared generated types                     |
| Data store     | Supabase (PostgreSQL 14)                                               | Row-level security; Prisma mirror          |
| External APIs  | Edamam, Browser-Use Agent, Stripe, OpenAI/Claude/Gemini (backend only) | Retry logic                                |
| DevOps         | Vercel, GitHub CI                                                      | Unit + e2e tests (Playwright), code-owners |

## 8. Design and user interface

### 8.1 Visual language

- **Look & feel** – Clean, airy layouts with soft shadows and 2xl rounded corners.
- **Colour tokens** – Accessible palette that passes WCAG contrast; macro chips use green/amber/red for thresholds.
- **Typography** – Variable font sizes: display-xl for hero, lg for section headings, base for body.

### 8.2 Interaction patterns

- **Drag-and-drop** – Smooth Framer Motion animations, spring physics.
- **Toast notifications** – Pending, success, and error states for every mutation.
- **Skeleton loaders** – Shimmer for recipe cards and planner while fetching.
- **Keyboard navigation** – Focus rings, skip-to-main link, aria-current on.tabs.

### 8.3 Responsive breakpoints

- **Mobile** (< 640 px) – Bottom-nav bar, stacked cards.
- **Tablet** (641-1024 px) – Two-column recipe detail.
- **Desktop** (> 1024 px) – Three-pane grid for planner with sticky sidebar.

### 8.4 Accessibility

- All interactive elements reachable via **Tab** order.
- Live regions (`aria-live="polite"`) for status updates (e.g., checkout polling).
- High-contrast mode toggle in footer.

---

### Appendix A – requirement traceability matrix

| Feature                     | Functional requirement IDs | User story IDs             |
| --------------------------- | -------------------------- | -------------------------- |
| **Auth & onboarding**       | FR-A1–A4, FR-G3-G4-G7      | ST-101–104, ST-102, ST-117 |
| **Recipes**                 | FR-R1–R5                   | ST-105–108                 |
| **Meal planning**           | FR-M1–M4                   | ST-109–111                 |
| **Shopping list**           | FR-S1–S5                   | ST-112–115                 |
| **Settings & localisation** | FR-SET1–SET4               | ST-116, ST-121             |
| **Global architecture**     | FR-G1–G8, NF-series        | ST-118–123, ST-102         |

</PRD>
