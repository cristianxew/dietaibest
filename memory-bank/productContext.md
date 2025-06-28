# Product Context

## Why This Product Exists

- Modern users struggle to consistently plan healthy meals, track nutrition, and efficiently shop for groceries.
- Existing solutions are fragmented, lack automation, or are too complex for daily use.
- This product leverages AI agents to automate meal planning, recipe management, and grocery shopping, reducing user effort and improving health outcomes.

## Problems Solved

- Manual meal planning is time-consuming and error-prone.
- Users lack personalized nutrition guidance.
- Grocery shopping is inefficient without automated lists.
- Most apps do not integrate recipes, meal plans, and shopping in one seamless flow.

## User Experience Goals

- Effortless onboarding and setup.
- Minimal clicks to generate meal plans and shopping lists.
- Clear, actionable feedback (using toast notifications for errors).
- Fast, responsive UI with minimal complexity.
- Secure, privacy-focused data handling.

## Application Structure: PAGES (Epics)

### 1. Dashboard

- Users can view their upcoming meal plan for the week.
- Users can see nutrition summary and progress.
- Users can see quick actions (generate plan, view grocery list).

### 2. Recipes Page

- Users can view, add, edit, and delete recipes.
- Users can search and filter recipes.

### 3. Meal Plans Page

- Users can view, generate, and edit meal plans.
- Users can assign recipes to meal slots.

### 4. Grocery List Page

- Users can view and check off grocery items.
- Users can auto-generate grocery lists from meal plans.

### 5. Settings Page

- Users can update profile, dietary preferences, and notification settings.
- Users can manage account and authentication.

## Core Feature Principles

- All server actions must check authentication and access.
- All server/API responses: `{ data: ..., error: "This is the error" }`.
- All errors shown on frontend use ShadCN UI toast.
- Less code, less complexity, production-grade MVP focus.
