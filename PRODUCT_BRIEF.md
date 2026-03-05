# DietAI - Product Brief for Marketing Team

**Date:** March 1, 2026
**Version:** 1.0
**Status:** Live Product (Beta)
**URL:** dietai.best

---

## 1. PRODUCT OVERVIEW

### What is DietAI?

DietAI is an **AI-powered meal planning and nutrition management SaaS** that eliminates the guesswork from healthy eating. Unlike traditional calorie counters that force users to log every bite, DietAI uses a **"plan-first" approach** — users receive personalized meal plans optimized for their goals, then follow them with confidence.

### One-Liner

> "Stop guessing what to eat. Get personalized meal plans, real nutrition insights, and effortless grocery shopping — powered by AI."

### Elevator Pitch

Most people know they should eat better, but conflicting advice, time-consuming meal prep, and exhausting calorie tracking make it feel impossible. DietAI solves this by combining AI-powered meal planning with professional-grade nutrition analysis. Users tell us their goals, and we deliver weekly meal plans balanced to their macros — plus automated shopping lists and one-click grocery delivery. It's the nutrition app that actually works for busy people and families.

---

## 2. TARGET AUDIENCE

### Primary Segments

| Segment | Description | Pain Points |
|---------|-------------|-------------|
| **Health-Conscious Families** | Parents (25-45) managing nutrition for the whole family | Different dietary needs per family member, time-strapped, want healthy kids |
| **Busy Professionals** | Working adults (25-40) who value health but lack time | No time to meal plan, eat out too much, want structure without effort |
| **Fitness Enthusiasts** | Gym-goers, athletes tracking macros to hit performance goals | Need precise macro tracking, tired of manual logging, want variety |
| **Dietary-Restriction Communities** | People with allergies, intolerances, or specific diets (vegan, keto, etc.) | Hard to find recipes that fit restrictions, fear of nutritional gaps |

### User Demographics
- **Age:** 25-50 (primary), 18-65 (secondary)
- **Gender:** Skews slightly female (~60/40) based on meal planning behavior
- **Income:** Middle to upper-middle class (willing to pay for convenience)
- **Tech comfort:** Moderate to high (smartphone/web app users)
- **Geography:** English, Spanish, and Polish-speaking markets (currently supported locales)

---

## 3. COMPLETE FEATURE LIST

### 3.1 Recipe Management
- **Manual Recipe Creation** — Full form with ingredients, instructions, prep/cook time, servings, difficulty, categories
- **AI Recipe Import from URL** — Paste any recipe URL, AI extracts all details automatically (handles cookie banners, paywalls, popups)
- **Recipe Import from PDF/Image** — Upload a cookbook page or photo, OCR extracts the recipe
- **Automatic Nutrition Analysis** — Every recipe gets a 28-nutrient breakdown (calories, protein, carbs, fat, fiber, vitamins, minerals, etc.)
- **Recipe Categorization & Tagging** — Organize by meal type, cuisine, dietary labels
- **Favorites System** — Bookmark recipes for quick access
- **Search & Filtering** — Find recipes by name, category, dietary labels
- **Diet & Health Label Detection** — Auto-detects if recipe is vegan, vegetarian, keto, gluten-free, dairy-free, etc.
- **Allergen Warnings** — Flags potential allergens in recipes

### 3.2 Meal Planning
- **Weekly Meal Plan Builder** — Create plans with customizable date ranges
- **2-6 Meals Per Day** — Configure breakfast, lunch, dinner, and up to 3 snacks
- **Drag-and-Drop Interface** — Visually organize meals across the week
- **Real-Time Macro Tracking** — See daily and weekly macro totals update as you add/move meals
- **Macro Target Comparison** — Compare plan nutrition vs. your personal goals
- **Plan Templates** — Save plans as templates, duplicate and reuse
- **Schedule Plans** — Activate plans for specific future weeks
- **Active Plan Management** — One active plan at a time, switch easily

### 3.3 Nutrition Analysis
- **28-Nutrient Professional Analysis** — Powered by Edamam API (same data used by dietitians)
- **Per-Recipe Breakdown** — Calories, protein, carbs, fat, fiber, sugar, sodium, cholesterol, vitamins, minerals
- **Per-Serving Calculations** — Adjusts based on serving count
- **Daily & Weekly Tracking** — Dashboard shows progress against goals
- **Weekly Macro Charts** — Visual trends over time
- **Calorie Ring Chart** — At-a-glance daily progress

### 3.4 Personalized Onboarding
- **3-Step Wizard:**
  1. **Demographics** — Age, gender, height, weight, activity level
  2. **Goals** — Weight loss / maintenance / gain, target calories, macro ratios
  3. **Preferences** — Dietary type (omnivore, vegan, keto, etc.), allergies, cuisine preferences
- **Auto-Calculated Targets** — BMR-based calorie and macro recommendations
- **Family Member Profiles** — Add children/spouse with individual dietary needs

### 3.5 Shopping Lists
- **Auto-Generated from Meal Plans** — One click creates a shopping list from your active plan
- **Category-Based Organization** — Ingredients grouped by grocery aisle/category
- **Ingredient Consolidation** — Same ingredient from multiple recipes combined with proper quantities
- **Unit Conversion** — Automatic metric/imperial handling
- **PDF Export** — Print-friendly shopping list
- **Grocery Delivery Integration** — Connect with Auchan, Carrefour or your preferred grocery store
- **AI Shopping Automation** — AI agent fills your online grocery cart automatically 

### 3.6 Dashboard
- **Today's Nutrition Summary** — Calories, protein, carbs, fat at a glance
- **Weekly Macro Chart** — Visual comparison against targets
- **Active Plan Preview** — Current day's meals
- **Recent Recipes** — Quick access carousel
- **Quick Stats** — Recipe count, meal plans created, active schedules
- **Smart CTAs** — Contextual prompts based on user journey stage
- **Onboarding Progress** — Nudges to complete setup

### 3.7 User Profile & Settings
- **Dietary Goal Management** — Update goals anytime
- **Allergy & Restriction Management** — Add/remove dietary restrictions
- **Family Member Management** — Up to 5 family profiles
- **Store Preferences** — Preferred grocery services and credentials
- **Dark Mode** — Full dark/light theme support
- **Multi-Language Support** — English, Spanish, Polish

### 3.8 Authentication
- **Email/Password Sign-Up/Sign-In**
- **Secure Session Management** — JWT-based, HTTP-only cookies
- **Protected Routes** — All user data behind authentication

---

## 4. PRICING MODEL

### Three-Tier Freemium Structure

| | **Starter** | **Pro** | **Family** |
|---|---|---|---|
| **Price** | **Free forever** | **$12/month** | **$29/month** |
| **Saved Recipes** | 5 | Unlimited | Unlimited |
| **Meal Plans** | Basic | Unlimited | Unlimited |
| **Recipe Import** | Manual only | URL + PDF/Photo | URL + PDF/Photo |
| **Nutrition Analysis** | 5 basic nutrients | 28-nutrient (professional) | 28-nutrient (professional) |
| **Shopping List** | Basic CSV | Multi-format export | Consolidated family list |
| **Family Profiles** | 1 | 1 | Up to 5 |
| **Dietary Customization** | Basic | Advanced | Advanced per member |
| **Grocery Delivery** | — | Instacart / Amazon Fresh | Instacart / Amazon Fresh |
| **Learning Hub** | — | Yes | Yes |
| **Allergy Alerts** | — | — | Yes (family-wide) |
| **Priority Support** | — | — | Yes |

**Conversion Incentives:**
- 7-day free trial for Pro
- 30-day money-back guarantee
- No contracts, cancel anytime

---

## 5. KEY DIFFERENTIATORS (vs. Competitors)

| DietAI | MyFitnessPal / Cronometer / Yazio |
|--------|-----------------------------------|
| **Plan-first approach** — you follow a plan, not log every meal | Log-first — requires daily manual tracking of every food |
| **AI recipe import** — paste a URL, AI does the rest | Manual barcode scanning or food database search |
| **Professional 28-nutrient analysis** per recipe | Basic calorie/macro tracking |
| **Family plans** with individual dietary profiles | Single-user focused |
| **Automated shopping lists** from meal plans | No shopping integration |
| **AI-powered grocery delivery** | No shopping automation |
| **Recipe OCR** — import from cookbooks/photos | No OCR capability |
| **Macro optimization feedback** — AI suggests improvements | No AI optimization |
| **Visual drag-and-drop meal planning** | Calendar-style logging |

### Unique Value Proposition

**"The nutrition app that plans FOR you, not just tracks AFTER you eat."**

DietAI flips the traditional calorie-counting model. Instead of logging what you ate and feeling guilty, you get a personalized plan BEFORE the week starts — balanced to your exact macro targets, with recipes you'll actually enjoy. Then you just follow it.

---

## 6. SOCIAL PROOF & METRICS (from landing page)

- **2,500+ active users**
- **4.9/5 average rating**
- **85% monthly retention rate**
- **5 hours saved per week** (average user)
- **Testimonials highlight:**
  - Family eating 40% more vegetables
  - Saves 4+ hours/week on meal planning
  - Lost 15 lbs in 3 months
  - Hitting 150g protein daily for muscle building

---

## 7. USER JOURNEY MAP

```
AWARENESS → Landing Page (features, pricing, testimonials, FAQ)
    ↓
SIGN UP → Email/Password registration
    ↓
ONBOARDING → 3-step wizard (demographics → goals → preferences)
    ↓
ACTIVATION → Dashboard with contextual first-action CTA
    ↓
FIRST VALUE → Create or import first recipe → See nutrition analysis
    ↓
AHA MOMENT → Create first meal plan → See macros balanced to goals
    ↓
HABIT → Weekly meal planning cycle:
    Plan → Shop → Cook → Repeat
    ↓
EXPANSION → Upgrade to Pro (URL import, 28-nutrient, shopping)
    ↓
ADVOCACY → Share plans, invite family members, Family plan upgrade
```

---

## 8. TECHNOLOGY HIGHLIGHTS (for marketing copy)

These technical capabilities can be translated into marketing messages:

| Technical Feature | Marketing Message |
|---|---|
| Edamam API (28 nutrients) | "Professional-grade nutrition data used by real dietitians" |
| Browser-Use AI (recipe import) | "Paste any recipe URL — our AI extracts everything in seconds" |
| Google Document AI (OCR) | "Snap a photo of your grandma's recipe — we'll digitize it" |
| dnd-kit drag-and-drop | "Build your meal plan visually — just drag and drop" |
| next-intl (3 languages) | "Available in English, Spanish, and Polish" |
| Dark mode | "Easy on the eyes, day or night" |
| Mobile-responsive | "Plan your meals anywhere — phone, tablet, or desktop" |
| Real-time macro calculation | "See your nutrition update live as you build your plan" |

---

## 9. MARKETING ADVICE & RECOMMENDATIONS

### 9.1 Messaging Framework

**Primary Message (PAS Framework):**
- **Problem:** "You know you should eat better, but meal planning takes forever and calorie counting is exhausting"
- **Agitate:** "Every week it's the same: 'What's for dinner?' Google recipes, check if they're healthy, go shopping unprepared, end up ordering takeout"
- **Solution:** "DietAI gives you a personalized meal plan in minutes — balanced to YOUR goals, with recipes you'll love and a shopping list ready to go"

**Secondary Messages:**
1. **For Families:** "One app, every family member's diet covered — even picky eaters"
2. **For Fitness:** "Hit your macros without a spreadsheet. 28-nutrient analysis on every meal"
3. **For Busy People:** "Save 5 hours a week. Know what you're eating before Monday morning"

### 9.2 Content Marketing Ideas

1. **Blog Posts / SEO Content:**
   - "How to Meal Plan for a Family of 4 (Without Losing Your Mind)"
   - "Macro Tracking vs. Calorie Counting: Which Actually Works?"
   - "The Beginner's Guide to Meal Prep: A Week-by-Week Plan"
   - "Hidden Nutrients You're Probably Missing (And How to Fix It)"
   - "Keto/Vegan/Gluten-Free Meal Planning Made Easy"

2. **Social Media Angles:**
   - Before/after meal plan screenshots
   - "Did you know?" nutrition facts from the 28-nutrient analysis
   - Recipe of the week (imported via URL feature)
   - User transformation stories
   - Quick-tip reels: "How to import any recipe in 5 seconds"

3. **Email Sequences:**
   - Welcome series after sign-up (highlight features progressively)
   - Weekly meal plan inspiration
   - "You haven't logged in this week" re-engagement
   - Upgrade nudges (show what they're missing in Pro)

### 9.3 Paid Acquisition Channels

| Channel | Why | Target |
|---|---|---|
| **Instagram/TikTok** | Visual meal prep content, recipe reels | Health-conscious 25-40 |
| **Facebook** | Family targeting, interest-based | Parents 30-45 |
| **Google Search** | "meal planning app", "macro tracker", "family meal planner" | High-intent searchers |
| **YouTube** | Tutorial/demo content, influencer partnerships | Fitness & health community |
| **Pinterest** | Recipe pins linking to app | Meal prep enthusiasts |

### 9.4 Conversion Optimization Suggestions

1. **Add a demo/interactive preview** — Let visitors try a simplified meal planner before signing up
2. **Video walkthrough on landing page** — Show the drag-and-drop experience, it's a differentiator
3. **More specific social proof** — Real user names with photos and measurable results
4. **Comparison table on landing page** — DietAI vs. MyFitnessPal, Yazio, etc.
5. **Trust badges** — "Data encrypted", "GDPR compliant", "No credit card required for free plan"

---

## 10. IMPROVEMENT SUGGESTIONS

### 10.1 Product Gaps to Address

| Gap | Impact | Recommendation |
|-----|--------|----------------|
| **No social login** (Google, Apple, Facebook) | Reduces sign-up friction significantly | Add OAuth providers — critical for mobile conversion |
| **No mobile app** | Limits daily engagement and cooking-time usage | Consider React Native app or PWA as short-term solution |
| **Shopping automation is incomplete** | Promised on landing page but not fully functional | Either complete it or soften the marketing claim |
| **No payment system** | Can't actually charge for Pro/Family tiers | Integrate Stripe — essential before scaling paid acquisition |
| **No AI meal plan generation** | Listed as planned but not implemented | This is the #1 value prop — prioritize building it |
| **No Learning Hub** | Listed in Pro tier but doesn't exist | Build basic content or remove from pricing table |

### 10.2 Marketing-Specific Improvements

1. **Landing Page:**
   - Add a live interactive demo or video walkthrough
   - Include a competitor comparison section
   - Add trust/security badges
   - Consider adding an annual pricing option (20% discount) to increase LTV
   - Add a "Featured in" press/media section (even if self-published initially)

2. **Onboarding:**
   - Add a "quick win" — generate a sample meal plan immediately after onboarding
   - Show the "aha moment" faster (nutrition analysis of their first recipe)
   - Add progress emails for users who abandon onboarding

3. **Retention:**
   - Push notifications / email reminders for weekly planning
   - Weekly nutrition report emails
   - Streak/gamification ("You've planned 4 weeks in a row!")
   - Recipes shared by other users / community features

4. **Growth:**
   - Referral program ("Give $5, Get $5")
   - Shareable meal plans (social sharing)
   - Embeddable nutrition widgets for food bloggers
   - API for fitness coaches to create plans for clients

### 10.3 Localization Expansion Opportunities

Current: English, Spanish, Polish
**Recommended next:** Portuguese, French, German, Italian
**Reason:** Large health-conscious markets in Brazil, France, DACH region, and Italy with strong food culture alignment

---

## 11. COMPETITIVE LANDSCAPE SUMMARY

| Competitor | Pricing | Key Difference from DietAI |
|---|---|---|
| **MyFitnessPal** | Free / $19.99/mo | Food logging focused, no meal planning, no recipe import AI |
| **Cronometer** | Free / $9.99/mo | Deep nutrition tracking, but no meal plan builder |
| **Yazio** | Free / $6.99/mo | Good UX, but limited meal planning and no AI features |
| **Eat This Much** | Free / $8.99/mo | Auto-generates meal plans, but no recipe import, basic nutrition |
| **Mealime** | Free / $5.99/mo | Recipe-focused, no nutrition analysis depth |
| **Noom** | $59/mo | Weight loss coaching, not meal planning tool |

**DietAI's competitive edge:** The only app that combines AI recipe import + professional 28-nutrient analysis + visual meal planning + automated shopping — all in one platform.

---

## 12. BRAND ASSETS

- **Brand Name:** DietAI (stylized as "Dietai" in logo)
- **Design System:** "Botanical Precision" — warm stone neutrals with green/gold accents
- **Logos Available:**
  - `Dietai_logo_dark.png` — For light backgrounds
  - `Dietai_logo_light.png` — For dark backgrounds
  - `Dietai_logo_symbol.svg` — Symbol-only mark
- **Fonts:** Inter (body), Space Grotesk (headings), Geist Mono (data/code)
- **Color Palette:** Warm stone neutrals + brand green + gold accents
- **Tone:** Friendly, confident, practical — not clinical or preachy

---

*This document was generated from codebase analysis on March 1, 2026. Features marked as "planned" or "coming soon" should be verified with the development team before including in marketing materials.*
