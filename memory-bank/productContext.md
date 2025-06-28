# Product Context

## Why This Product Exists

- Modern users struggle to consistently plan healthy meals, track nutrition, and efficiently shop for groceries
- Existing solutions are fragmented, lack automation, or require too much manual effort
- **This product leverages professional AI services** (Edamam meal planning + Browser-Use shopping automation) to create a seamless, automated nutrition and shopping experience
- Focus on **service integration over custom development** for faster, more reliable features

## Problems Solved

### Core Pain Points

- **Manual meal planning**: Time-consuming (hours → minutes) through AI automation
- **Nutritional guesswork**: Precise macro tracking via Edamam's 28-nutrient analysis
- **Shopping inefficiency**: One-click grocery automation via Browser-Use AI agents
- **Fragmented workflow**: Integrated recipes → meal plans → shopping in one seamless flow
- **Technical complexity**: Users get professional-grade features without learning multiple apps

### User Experience Improvements

- **Edamam Integration**: Professional nutrition analysis and meal plan generation
- **Browser-Use Automation**: AI agents handle grocery shopping cart filling
- **Real-time Updates**: Live macro recalculation and progress tracking
- **Multi-language Support**: EN/PL/ES with localized nutrition standards

## User Experience Goals

### Effortless Automation

- **3-step onboarding**: Collect preferences → Calculate macros → Start generating plans
- **One-click meal plans**: AI generates balanced weekly plans instantly
- **Automated shopping**: AI agents fill grocery carts with meal plan ingredients
- **Real-time feedback**: Live macro validation and tolerance checking

### Technical Excellence

- **Fast, responsive UI**: Server-first architecture with minimal client complexity
- **Secure data handling**: Supabase auth with JWT httpOnly cookies
- **Accessibility focused**: WCAG 2.1 AA compliance with proper ARIA labels
- **Progressive enhancement**: Core features work without JavaScript

## Application Structure: PAGES (Epics)

### 1. Dashboard

- **Weekly meal plan overview** with nutrition summary and progress indicators
- **Quick actions**: Generate new plans, view shopping lists, edit current plan
- **Macro progress tracking**: Visual indicators with green/yellow/red tolerance system
- **Recent activity**: Last imported recipes, completed shopping, plan modifications

### 2. Recipes Page

- **Multiple input methods**: Manual form, URL scraping, image OCR, PDF upload
- **Automatic nutrition analysis**: Edamam Recipe Search API integration
- **Advanced organization**: Categories, tags, favorites with real-time search
- **Nutrition display**: Standardized macro format (1,240 cal • 45g protein • 120g carbs • 38g fat)

### 3. Meal Plans Page

- **AI-powered generation**: Edamam Meal Planner API with custom preferences
- **Drag-and-drop editing**: Intuitive calendar interface with real-time macro updates
- **Plan management**: Save, share, export (PDF), and track multiple plans
- **Tolerance checking**: Visual feedback for macro targets with adjustment suggestions

### 4. Shopping List Page

- **Auto-generation**: Date-range ingredient consolidation from meal plans
- **Browser-Use integration**: One-click cart filling with progress tracking
- **Smart management**: Quantity adjustment, pantry items, category organization
- **Multi-format export**: PDF download and direct store cart integration

### 5. Settings Page

- **Profile management**: Dietary preferences, macro targets, family members
- **Store preferences**: Grocery store selection for automated shopping
- **Language switching**: EN/PL/ES with persistent preferences
- **Account management**: Authentication, billing (Stripe), data export

## Core Feature Principles

### Technical Standards

- **Authentication required**: All server actions check user access and permissions
- **Consistent API responses**: `{ data: ..., error: "This is the error" }` format
- **Error handling**: All frontend errors shown via ShadCN UI toast notifications
- **Server-first architecture**: Minimal client state, maximum server actions

### External Service Integration

- **Edamam APIs**: Professional nutrition analysis and meal plan generation
- **Browser-Use Cloud**: AI agents for automated grocery shopping
- **Service reliability**: Proper rate limiting, caching, and fallback mechanisms
- **Cost optimization**: User-based rate limiting and efficient API usage

### Development Philosophy

- **Less code, less complexity**: Production-grade MVP focus with service integration
- **Professional APIs first**: Leverage existing services over custom development
- **Progressive enhancement**: Features degrade gracefully without JavaScript
- **Documentation-driven**: All patterns captured in Cursor Rules and Memory Bank

## Market Differentiation

### Unique Value Proposition

- **End-to-end automation**: Only app that integrates professional meal planning with AI shopping
- **Professional nutrition**: Edamam's 28-nutrient analysis vs. basic calorie counting
- **True automation**: Browser-Use AI agents actually fill shopping carts vs. just lists
- **Technical excellence**: Server-first architecture for speed and reliability

### Competitive Advantages

- **Service integration strategy**: Faster development, more reliable features
- **Real-time macro tracking**: Live updates vs. daily/weekly summaries
- **Multi-language nutrition**: Localized standards and currency support
- **Accessibility focus**: WCAG 2.1 AA compliance from day one
