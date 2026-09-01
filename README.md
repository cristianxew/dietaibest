# DietAI - AI-Powered Meal Planning & Nutrition Management

A comprehensive Next.js application that leverages professional AI services to automate the entire meal planning workflow - from recipe storage and nutritional analysis to automated grocery shopping.

## 🎯 What It Does

**DietAI** transforms meal planning from a time-consuming manual process into an automated, intelligent workflow:

- **Smart Recipe Management**: Store recipes via manual entry, URL import, or AI-powered OCR from images/PDFs
- **Professional Nutrition Analysis**: Powered by Edamam's 28-nutrient analysis engine for accurate macro tracking
- **AI Meal Plan Generation**: Automated weekly meal plans that balance calories and macronutrients to your goals
- **One-Click Shopping**: Browser-Use AI agents automatically fill grocery carts with your meal plan ingredients
- **Multi-Language Support**: Full localization for English, Polish, and Spanish markets

## 🏗️ Architecture Overview

### **services**

Rather than building everything from scratch, DietAI integrates best-in-class professional APIs:

- **[Edamam APIs](https://developer.edamam.com/)**: Recipe analysis + meal plan generation
- **[Browser-Use Cloud](https://browseruse.ai/)**: AI-powered grocery shopping automation
- **[Supabase](https://supabase.com/)**: PostgreSQL database + authentication + real-time
- **[Stripe](https://stripe.com/)**: Billing and subscription management

### **Core Technical Stack**

**Frontend Framework**

- **Next.js 15** (App Router) with TypeScript 5
- **Bun** package manager (exclusive - no npm/yarn)
- **Server Actions** for all business logic and CRUD operations

**UI & Design System**

- **ShadCN UI** + **Tailwind CSS** for consistent, accessible components
- **Framer Motion** for drag-and-drop interactions
- **Mobile-first responsive design** with WCAG 2.1 AA compliance

**Database & Authentication**

- **Supabase PostgreSQL** with row-level security
- **Prisma ORM** (single source of truth for all TypeScript types)
- **Next-auth** + **Supabase Auth** for JWT-based authentication

**External Integrations**

- **Edamam Recipe Search**: Nutritional analysis for user recipes
- **Edamam Meal Planner**: AI-generated balanced meal plans
- **Browser-Use Cloud**: Automated grocery cart filling
- **Real-time updates** via Supabase subscriptions

## 🚀 Getting Started

### Prerequisites

- **Bun** (required - this project uses Bun exclusively)
- **Node.js 18+**
- **PostgreSQL** (via Supabase)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd DietAI

# Install dependencies (Bun only)
bun install

# Set up environment variables
cp .env.example .env.local
# Configure your API keys (see Environment Variables section)

# Initialize database (local dev only — shared environments use migrations,
# see .agent/SOP/definition_of_done.md)
bunx prisma migrate dev    # Apply migrations to your local database
bunx prisma db seed        # Populate with default categories and sample data

# Start development server
bun dev
```

### Before you commit

```bash
bun run verify:full   # lint ratchet · typecheck · unit tests · nutrition eval · build
```

This is the local equivalent of the blocking CI jobs. See
[.agent/SOP/definition_of_done.md](.agent/SOP/definition_of_done.md) for the full
Definition of Done and [.agent/System/engineering_standards.md](.agent/System/engineering_standards.md)
for the standards it implements.

Open [http://localhost:3000](http://localhost:3000) to see the application.

### Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Edamam APIs
EDAMAM_APP_ID=your_edamam_app_id
EDAMAM_APP_KEY=your_edamam_app_key

# USDA FoodData Central
USDA_API_KEY=your_usda_api_key

# Browser-Use Cloud
BROWSER_USE_API_KEY=your_browser_use_key

# Authentication
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your_nextauth_secret

# Stripe (optional)
STRIPE_PUBLISHABLE_KEY=your_stripe_public_key
STRIPE_SECRET_KEY=your_stripe_secret_key
```

## 📁 Project Structure

```
src/
├── app/                    # Next.js 15 App Router
│   ├── [locale]/          # Internationalized routes (EN/PL/ES)
│   │   ├── (auth)/        # Authentication pages
│   │   ├── (protected-pages)/  # Authenticated user routes
│   │   └── (public-pages)/     # Public marketing pages
│   └── api/               # API routes & server actions
├── components/            # React components
│   ├── ui/               # ShadCN UI components (never modify)
│   ├── forms/            # Reusable form components
│   └── [feature]/        # Feature-specific components
├── lib/                  # Utilities & external API clients
├── types/                # TypeScript type definitions
└── actions/              # Server actions for business logic

memory-bank/              # Project intelligence & documentation
└── .taskmaster/          # Claude Task Master project management
```

## 🤝 Contributing

1. Review project context in `memory-bank/` directory
2. Use Claude Task Master for task selection and complexity analysis
3. Follow established patterns in `src/` structure
4. Ensure all server actions include authentication checks
5. Maintain TypeScript strict mode compliance

## 📚 Learn More

- **[Next.js Documentation](https://nextjs.org/docs)** - Framework features and API
- **[ShadCN UI](https://ui.shadcn.com/)** - Component system and theming
- **[Supabase Docs](https://supabase.com/docs)** - Database and authentication
- **[Edamam API](https://developer.edamam.com/)** - Nutrition and meal planning APIs

## 🚀 Deploy

The easiest way to deploy is via **[Vercel](https://vercel.com/new)**:

1. Connect your GitHub repository
2. Configure environment variables
3. Deploy with automatic CI/CD

Check out the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for other platforms.

---
