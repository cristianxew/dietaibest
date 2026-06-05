# DIE-30 — UI/UX Design Requirements

**Feature**: In-app AI Chat Agent for recipes & meal plans (v1)
**Linear**: [DIE-30](https://linear.app/dietai-manager/issue/DIE-30/prd-in-app-ai-chat-agent-for-recipes-and-meal-plans-v1-mcp-server-v11)
**Audience**: Design team (UI/UX)
**Author**: Cristian Bernal
**Date**: 2026-05-16
**Status**: Ready for design

---

## 1. Executive summary

We're shipping a **conversational chat** inside the app, **Pro users only**, that lets them operate the entire recipe and meal plan domain in natural language. Users will be able to:

- Create recipes by describing them in their own words
- Import recipes by pasting a link (YouTube, TikTok, Instagram, any web URL)
- Import recipes by uploading a **photo** (cookbook page, IG screenshot, restaurant chalkboard, handwritten note)
- Request a meal plan for N days with target macros
- Edit / delete / move meals via conversation
- Search through their own recipes

**This is NOT a generic ChatGPT-style chat.** It's a *conversational command bar* that triggers real product actions. This distinction is critical for design — read section 3 carefully.

---

## 2. Product context

### 2.1. Why does this feature exist?

Today DietAI has separate UI flows for each intent: a form to create a recipe, a wizard to import one, drag-and-drop for meal plans. Each interaction is correct but isolated. Pro users repeatedly say things like *"I want a high-protein vegetarian risotto"*, *"grab the recipe from this YouTube video"*, *"build me a 7-day plan around 1800 kcal"* — and there's no direct path in the product. Everything has to be translated into clicks.

The chat unifies user intent with product actions. **It's a sidekick, not a destination.**

### 2.2. Who will use it?

- **Pro user** (subscribed): the target. Full access.
- **Free user**: sees the entry point but on click hits the existing paywall (same component, same UX as `aiMealPlan`, `recipeImport`).
- **Operator / us**: monthly cost cap per user; UI shows "you've used your monthly AI budget" when the cap is hit.

### 2.3. Locales

**en, es, pl** — all three already supported. The chat inherits the user's locale and responds in that language. For `es`, the model responds in **Rioplatense Spanish**.

---

## 3. Core UX principle (READ BEFORE DESIGNING ANYTHING)

> **The chat is a command bar, NOT a display surface.**

Concretely:

| The chat DOES | The chat does NOT |
|---|---|
| Show text messages from the agent | Show recipe cards inside the chat |
| Show structured **status messages** (i18n keys) like "Importing recipe…", "Saving…", "Analyzing macros…" | Render macro tables, ingredients, instructions |
| Show **links** like "View recipe →" that go to the existing UI | Replace the UI of `/recipes/{id}` or `/meal-plans/{id}` |
| Show **inline confirmation buttons** (Yes / No) for destructive actions | Have complex cards with tabs / accordions / embedded nutrition |
| Show **progress** during long operations (meal plan, import) | Do anything with drag-and-drop or visual plan editing |

**Why this matters:** when the agent imports a recipe, the recipe shows up in `/recipes` (the existing page) thanks to cache revalidation. The user has the chat open on the **right** and `/recipes` on the **left** — they see the recipe appear in the list in real time. That's the magic. **We do NOT replicate `/recipes/{id}` inside the chat.**

> **Practical rule for design:** if you find yourself drawing a "recipe card" or "nutrition card" inside the chat panel — stop. That goes in the existing UI, and the chat just links to it.

---

## 4. Surface and mounting

### 4.1. Trigger — Floating Action Button (FAB)

- **Position**: sticky bottom-right, on **all protected pages** (`(protected-pages)`)
- **Visibility**: always visible for authenticated users (Free and Pro)
- **Iconography**: chat / sparkle / AI icon — design to propose (suggestion: "personal assistant" feel, not a "generic chat bubble"). Differentiate it from a support live-chat.
- **Active state**: visual change when the drawer is open (underline, color, etc.)
- **Touch target**: minimum 44×44px (a11y)
- **Should NOT block** critical page content (e.g. a form's "Save" button). Consider offset.

**Click handler:**
- Free user → opens the existing `Paywall` with `feature: "aiChat"` (existing component `src/components/billing/Paywall.tsx`)
- Pro user → toggles the drawer

### 4.2. Technical mount (info for your implementation, not UI)

- A single instance of the drawer mounted in `src/app/[locale]/(protected-pages)/layout.tsx`
- The drawer **survives cross-route navigation** — the user can move from `/recipes` to `/meal-plans` and the conversation stays intact
- No separate `/chat` route — always an overlay

### 4.3. Desktop layout — Right drawer

- **Fixed width: 420px**
- **Behavior: push-aside** (NOT overlay on top of content)
- When opened, main content **shrinks** to the left
- Reason: the user needs to see `/recipes` (list) **at the same time** as the chat to witness the recipe appearing
- Drawer header with: title "DietAI Assistant" (or whatever name design defines), "Clear conversation" button, close button (X)
- Fixed footer: composer (input + send button + attach button)
- Body: internal scroll, stacked messages

### 4.4. Mobile layout — Bottom sheet

- **Full height** with safe-area padding (notch / home indicator)
- Header always visible (with close button)
- Composer pinned to the bottom, above the keyboard
- **No split-view** on mobile — the bottom sheet takes the full screen. The user alternates between chat and `/recipes` via close + navigation.
- Swipe-down-to-close gesture support

### 4.5. Single conversation

> **ONE active conversation per user. NO conversation list, NO `/chat/history`.**

- "Clear conversation" button in the header → archives the current one and starts fresh
- Confirm before archiving (short modal: "Sure? This closes the current conversation")
- When the user reopens the drawer, they always see the active conversation with its scroll position preserved

---

## 5. User flows

### 5.1. Free user — Paywall

1. Click on FAB
2. The existing **Paywall** opens (`src/components/billing/Paywall.tsx`) — same component, same aesthetic as `aiMealPlan`'s
3. The `aiChat` feature appears in the list of features that get unlocked
4. CTA "Upgrade to Pro" leads to `/subscribe` (existing)

**For design**: we need copy + icon + description for **"AI Chat Assistant"** as a feature card in the paywall. Coordinate with copy of the other already-listed features.

### 5.2. Pro user — First time (empty state)

When the user opens the chat for the first time (or after "Clear conversation"):

- **Header**: "DietAI Assistant" (TBD by design)
- **Body** (empty state): welcome message + clickable suggestions
  - "Create a recipe by describing it"
  - "Import from a link (YouTube, IG, TikTok, web)"
  - "Upload a photo of a recipe"
  - "Ask for a 7-day plan at 1800 kcal"
- Each suggestion, on click, **fills the composer** (does not auto-send)
- **Composer** (footer): autosize textarea + send button + 📎 attach button
- **Placeholder microcopy**: "Tell me what you want to cook…" (en), "Decime qué querés cocinar…" (es), variant for `pl`

### 5.3. Pro user — Normal conversation

**User messages:**
- Bubble right-aligned
- Brand color, white/high-contrast text
- Multiline support
- If it has an image attachment: thumbnail above the text

**Agent messages:**
- Left-aligned, no dense bubble (more like an "assistant response" style)
- Streaming text (typing/cursor animation while it arrives)
- Can contain:
  - **Text** (basic markdown: bold, italic, lists, inline code)
  - **Status messages** (see 5.4)
  - **Links to existing UI** (see 5.5)
  - **Inline confirmation buttons** for destructive actions (see 5.6)

**Tool / status messages:**
- Visually differentiated from agent text (subtle color, small icon)
- Inline with the flow, not in a separate panel
- Visual example:
  ```
  [agent]: Importing recipe from the link…
  [status • ⏳]: Extracting from the video…
  [status • ⏳]: Analyzing ingredients…
  [status • ⏳]: Calculating macros…
  [status • ✅]: Recipe saved
  [agent]: Done. Here it is:
  [link]: 📄 Mushroom risotto →  (clickable, leads to /recipes/{id})
  ```

### 5.4. Status messages (provisional catalog — i18n)

Design must treat these as **small, lightweight components**, not as cards. Each one is **a single line with icon + i18n text**.

| Key | When it appears | Suggested text (en) |
|---|---|---|
| `chat.status.tool.invoked` | When any tool starts | "Working…" |
| `chat.status.recipe.creating` | `createRecipe` started | "Creating recipe…" |
| `chat.status.recipe.analyzing` | Calling Edamam | "Analyzing macros…" |
| `chat.status.recipe.saving` | Persisting to DB | "Saving…" |
| `chat.status.import.fetching` | Downloading the link | "Fetching the content…" |
| `chat.status.import.extracting` | Supadata extracting | "Extracting the recipe…" |
| `chat.status.import.fallback` | Falls back to Browser-Use | "Retrying with another method…" |
| `chat.status.media.uploading` | Uploading photo | "Uploading image…" |
| `chat.status.media.extracting` | Gemma processing image | "Reading the recipe from the photo…" |
| `chat.status.mealplan.skeleton` | Sonnet building skeleton | "Building the plan…" |
| `chat.status.mealplan.fanout` | Haiku populating | "Generating recipes for the days… ({completed}/{total})" |
| `chat.status.mealplan.persisting` | Saving MealPlanTemplate | "Saving the plan…" |

**States**: `pending` (spinner), `success` (check), `error` (warning).

### 5.5. Links to existing UI (reusable component)

When a tool finishes, it returns a link. Design should define the `<ToolResultLink>` component with:

- **Icon** by type: 📄 recipe, 🗓️ meal plan, 🛒 shopping list
- **Label** (provided by the backend, e.g. "Mushroom risotto", "Plan for week of 5/14")
- **Clear "this is clickable and takes you out of the chat" affordance**
- Hover/focus state
- Visually it should feel like a "chip" or "minimal card" — NOT a brand button, doesn't compete with primary CTAs
- Mobile: 100% width of the message, comfortable touch target

### 5.6. Inline confirmations (destructive)

For `deleteRecipe`, `removeMealFromDay`, etc.:

```
[agent]: Are you sure you want to delete "Mushroom risotto"?
[ Yes, delete ]   [ No, cancel ]
```

- **Do NOT** open a modal
- **Do NOT** leave the chat
- Inline buttons in the conversation
- Once resolved (click on either), the buttons get replaced by a final status line ("✅ Deleted" / "Cancelled")
- Destructive button uses the existing design system's warning/destructive color

### 5.7. Multimodal — Image upload

**Composer gains a 📎 button:**
- Desktop: file picker
- Desktop: drag-and-drop on the composer (show overlay "Drop the image here")
- Mobile: native picker → camera or gallery

**Constraints (show them in the UI when applicable):**
- Formats: JPEG, PNG, WebP, HEIC
- Max size: 10 MB
- Max 10 imports/day/user

**"Image attached before sending" state:**
- Thumbnail above the textarea, with X button to remove it
- Size / filename indicator
- If exceeds limit: inline error, send disabled

**Processing state:**
- User message shows the thumbnail
- Status sequence: `chat.status.media.uploading` → `chat.status.media.extracting` → `chat.status.recipe.analyzing` → `chat.status.recipe.saving` → link

**Failure state:**
- Agent message: "I couldn't extract the recipe from that photo. Try another one or enter it manually."
- Option: link to `/recipes/new` for manual entry (existing UI)

---

## 6. Special states

### 6.1. Monthly cost cap reached

When the user exceeds their monthly AI budget:

- **Blocking** message in the chat (cannot send new messages)
- Composer in disabled state, with explanatory tooltip
- System message (not the agent) explaining:
  - "You've reached your monthly AI usage limit"
  - "Resets on {next 1st of the month}"
  - No upgrade CTA — they're already Pro; this is operational, not monetizable
- Visual: neutral/informative tone, NOT alarming

### 6.2. Medical refusal

When the user asks about diabetes, allergies, pregnancy, kidney conditions, etc.:

- Agent message with a **respectful and clear** tone:
  - "I can't give you medical advice. For matters about {topic}, consult with a healthcare professional."
- No CTA, no buttons — just text
- The agent **stays available** for other questions (does not block)

### 6.3. Nutrition guardrail — redaction

If the model attempts to drop a macro number in prose, we redact it. The user sees:

- Agent text with `[…]` or `[macro info available in the recipe]` where the number used to be
- **Do NOT** show the original number
- Subtle status below: `chat.guardrail.nutritionRedacted` — "For precise macros, open the recipe"
- Link to the recipe when applicable

### 6.4. Provider down / transient error

- Agent message: "I had a problem processing this. Try again in a minute."
- Inline "Retry" button
- Doesn't kick the user out of the chat

### 6.5. Empty / whitespace-only message

- Send button disabled
- Don't show an error — just visual affordance

---

## 7. Required visual components

List for design to produce specs / handoff (in priority order):

### 7.1. New components

1. **`ChatFAB`** — floating button with states (idle / hover / active / drawer-open)
2. **`ChatDrawer`** — desktop container (push-aside, 420px) + mobile (full-height bottom sheet)
3. **`ChatHeader`** — title + clear button + close button
4. **`ChatComposer`** — textarea + send + attach + attachment state + disabled state (cost cap)
5. **`ChatMessage`** — user bubble (right-aligned) and agent response (left-aligned, no dense bubble)
6. **`ChatStatus`** — status line with icon + i18n text + state (pending/success/error)
7. **`ToolResultLink`** — clickable link to existing UI, with icon by type
8. **`ConfirmInline`** — pair of inline buttons for destructive actions
9. **`AttachmentPreview`** — thumbnail with remove button in the composer
10. **`EmptyChat`** — empty conversation state with clickable suggestions
11. **`CostCapNotice`** — blocking message when cap is hit

### 7.2. Existing components to integrate (do NOT redesign)

- `Paywall` (`src/components/billing/Paywall.tsx`) — for Free users
- `PaywallProvider` (`src/components/billing/PaywallProvider.tsx`) — `usePaywall` hook
- `UpgradeCTA` (existing) — tone reference
- Existing `(protected-pages)` layout — the FAB mounts here

### 7.3. Iconography

- FAB icon (design proposal — must differentiate from a support live-chat)
- Link type icons: recipe, meal plan, shopping list
- Attach icon (📎 standard)
- State icons: pending (spinner), success (check), error (warning)
- "Clear conversation" icon (broom / subtle trash)

---

## 8. Aesthetic / Tone & feel

- **Tone**: professional, warm, efficient. It's an assistant, not a toy.
- **Differentiation**: should NOT feel like generic ChatGPT — should feel like **part of DietAI**, integrated into the existing design system
- **Density**: high information density — the chat is functional, not entertainment. Spacing consistent with the rest of the app.
- **Animation**:
  - Smooth text streaming, blinking cursor
  - Statuses enter with subtle fade
  - Drawer enters with horizontal slide (desktop) / vertical slide (mobile)
  - **No** flashy animations like confetti, glow, etc.
- **Dark mode**: full support (the app already has dark mode)
- **Reduced motion**: respect `prefers-reduced-motion`

---

## 9. Internationalization (i18n)

- **Supported locales**: `en`, `es`, `pl`
- **New namespace**: `chat.*` in `messages/{en,es,pl}.json`
- **Design must deliver copy in all 3 languages** or coordinate with the copy team
- For `es`: **Rioplatense** (voseo, "decime", "querés", "dale") — consistent with landing and rest of the product
- **Extensible text**: component widths must tolerate +30% length (e.g. German; even though not in scope today, leave headroom)
- **RTL**: not required in v1
- Mandatory minimum keys:
  - `chat.placeholder`
  - `chat.empty.welcome` + `chat.empty.suggestion.{1..4}`
  - `chat.proGate.title` + `chat.proGate.cta`
  - `chat.toolError.generic` + `chat.toolError.quotaExceeded`
  - `chat.guardrail.nutritionRedacted`
  - `chat.guardrail.medicalAdvice`
  - `chat.costCap.reached` + `chat.costCap.resetsOn`
  - `chat.confirm.delete.{recipe,meal,plan}`
  - `chat.attach.maxSize` + `chat.attach.unsupportedFormat`
  - All `chat.status.*` from section 5.4

---

## 10. Accessibility (non-negotiable)

- **Full keyboard nav**: TAB to reach the FAB, ENTER to open, ESC to close
- **Focus management**: when opening the drawer, focus goes to the composer; when closing, returns to the FAB
- **Focus trap** inside the drawer while open
- **ARIA**:
  - FAB: `aria-label`, `aria-expanded`, `aria-controls`
  - Drawer: `role="dialog"`, `aria-modal="false"` (it's push-aside, not modal)
  - Messages: `aria-live="polite"` for new statuses; `aria-live="assertive"` for critical errors
- **Touch targets**: minimum 44×44px on mobile
- **Contrast**: WCAG AA minimum (AAA preferred for chat text)
- **Screen reader**: text streaming should announce incrementally without spamming
- **Font size**: respect system setting (rem-based, no hardcoded px)

---

## 11. Edge cases / states design MUST cover

1. **Very long user message** (1000+ chars): the composer grows up to a max, then internal scroll
2. **Very long agent response**: chat scrolls vertically, user can read without jumps
3. **Multiple tools in parallel**: e.g. `generateMealPlan` fires 7 simultaneous calls — statuses should show `({completed}/{total})` aggregated, not 7 separate spinners
4. **Tool fails mid-operation**: status goes from pending → error with a brief message, agent can continue
5. **User closes the drawer while the agent is streaming**: operation continues in the background; on reopen, the full result is visible
6. **User changes pages while the agent is streaming**: same thing — operation continues
7. **Connection lost**: discreet indicator in the chat header ("Offline — retrying…"); composer disabled
8. **Whitespace-only input**: send disabled
9. **Drag of non-image file**: visual rejection with message
10. **Conversation without enough scroll** (1-2 messages): the body should not look hollow; the empty state with suggestions stays visible until there are 3+ exchanges

---

## 12. NOT in v1 (do not design these)

| Out of scope | Reason |
|---|---|
| Voice / audio input | v1.1 |
| Conversation list / history | Locked decision: one conversation per user |
| Separate `/chat` route | Chat is overlay, not destination |
| Recipe / nutrition / meal plan cards inside the chat | Core principle — all display goes in existing UI |
| AI-generated recipe images | Costly, low priority |
| Allergen flagging | Requires structured DB — v1.1 |
| Trial period in the paywall | Requires new Stripe trial logic |
| Embeddings / RAG over user's recipes | Deferred until ~100 recipes/user average |
| "Share conversation" button | No requested use case |
| Multiple agent personalities / avatars | One single voice, consistent |

---

## 13. Related technical sub-issues (reference)

For context on the technical scope (NO separate design required, all goes in the same system):

| Issue | What it covers |
|---|---|
| [DIE-31](https://linear.app/dietai-manager/issue/DIE-31) | `aiChat` entitlement + paywall gating + empty chat shell |
| [DIE-32](https://linear.app/dietai-manager/issue/DIE-32) | Tool registry + `searchRecipes` |
| [DIE-33](https://linear.app/dietai-manager/issue/DIE-33) | Agent runtime + streaming + first conversation |
| [DIE-34](https://linear.app/dietai-manager/issue/DIE-34) | Recipe CRUD + link to `/recipes/{id}` |
| [DIE-35](https://linear.app/dietai-manager/issue/DIE-35) | URL import (YouTube/TikTok/IG/web) |
| [DIE-36](https://linear.app/dietai-manager/issue/DIE-36) | Nutrition guardrail |
| [DIE-37](https://linear.app/dietai-manager/issue/DIE-37) | Meal plan tools + Mastra workflow |
| [DIE-38](https://linear.app/dietai-manager/issue/DIE-38) | Medical refusal + cost cap UX + full i18n |
| [DIE-39](https://linear.app/dietai-manager/issue/DIE-39) | Conversation persistence cross-reload |
| [DIE-41](https://linear.app/dietai-manager/issue/DIE-41) | Multimodal import from image |

---

## 14. Expected design team deliverables

To move this into implementation, we need:

### 14.1. Wireframes (low-fi)

- [ ] FAB on a protected page (desktop + mobile)
- [ ] Drawer open desktop (with `/recipes` visible alongside)
- [ ] Bottom sheet open mobile
- [ ] Empty chat state with suggestions
- [ ] Conversation with: user message + statuses + agent text + link to existing UI
- [ ] Conversation with: inline destructive confirmation
- [ ] Conversation with: image attached (preview in composer + thumbnail in sent message)
- [ ] Cost cap blocked state
- [ ] "Clear conversation" modal

### 14.2. High-fi (Figma mockups)

- All section 7.1 components with states (idle / hover / focus / active / disabled / error)
- Specs for spacing, typography, color tokens (use existing design system)
- Light + dark mode variants
- Desktop + mobile variants

### 14.3. Interactive prototype (Figma or similar)

- Free user → Paywall flow
- Pro user → first conversation → URL import → see recipe in `/recipes` flow
- Pro user → image upload → see recipe in `/recipes` flow
- Pro user → request meal plan → see progress → see plan in `/meal-plans` flow

### 14.4. Full copy in es / en / pl

- All section 9 keys
- Rioplatense tone for `es`
- Coordinate with existing copy in `messages/{en,es,pl}.json` (namespaces `billing.*`, `recipes.*`, `mealPlans.*`) for consistency

### 14.5. Developer-ready handoff

- Component specs with tokens (no hardcoded values)
- Animation states documented (timing, easing)
- Per-component a11y notes
- Edge cases covered visually

---

## 15. References / inspiration (do NOT copy literally)

- **Linear command bar (Cmd+K)**: the "command that triggers an action" mental model is similar
- **Notion AI**: how they integrate AI into existing tooling without replacing it
- **Vercel v0**: response streaming, but **without** the complex-cards approach
- **Anti-references** (we do NOT look like these): ChatGPT (too generic, no actions), Intercom (it's support, not a productive assistant)

---

## 16. Open questions to align with design

These get resolved in the first kickoff meeting with design:

1. Assistant name? (e.g. "DietAI Assistant", "Coco", "Chef AI", or just "Assistant")
2. FAB visual personality — custom brand icon or standard icon?
3. Sound / haptic feedback on mobile when a response arrives? (suggestion: optional, off by default)
4. Onboarding tour the first time a Pro opens the chat? (suggestion: simple tooltip, not a full tour)
5. How to visually signal that the conversation is persistent? (suggestion: timestamp of the last message in the header)
6. "Copy response" button on each agent message? (low utility in this command-bar model — discardable)

---

## 17. Already-locked decisions (do not reopen)

These decisions are **locked** after grilling sessions with stakeholders. If questions come up, check with Cristian before proposing alternatives:

| Decision | Locked at | Why |
|---|---|---|
| Chat is command-bar, NOT display surface | Grill 2026-05-15 | Avoids duplicating UI, leverages revalidation cache |
| One conversation per user | Grill 2026-05-15 | Simplicity — no demand for multi-thread |
| Sticky FAB bottom-right (no header button) | Grill 2026-05-15 | Standard pattern for always-available assistant |
| Push-aside drawer (no overlay) | Grill 2026-05-15 | Lets user see `/recipes` while the recipe appears |
| Image-only multimodal in v1 (audio deferred) | Grill 2026-05-16 | Cost + complexity; image covers 80% of the case |
| Pro-only — Free sees existing paywall | Original PRD | Consistency with `aiMealPlan`, `recipeImport` |
| Monthly cost cap `$5/user` | Original PRD | Operational, separate from paywall |

---

**Technical contact**: Cristian Bernal (cristianxsa15@gmail.com)
**Linear board**: [Dietai Desktop project](https://linear.app/dietai-manager/project/dietai-desktop)
