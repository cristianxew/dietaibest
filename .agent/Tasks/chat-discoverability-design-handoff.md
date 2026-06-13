# Handoff Spec: Chat Capability Discoverability (4 surfaces)

> **Direction of this handoff:** engineering → design. The feature is **shipped and functional** on `feat/chat-discoverability` (commit `0800312`) with engineering-default styling that reuses existing patterns. This doc gives the UX/design team the complete picture — every surface, state, token, and constraint — so the visual/interaction design can be refined without breaking behavior. Open design questions are flagged at the end.

## Overview

The AI chat has 16 tools but users only discovered ~4 of them. We added a **capability catalog** (`src/lib/chat/capabilities.ts`) — a single source of truth (id, icon, contexts, priority, prompts) — feeding four discovery surfaces:

| # | Surface | Where | Component |
|---|---------|-------|-----------|
| 1 | Context-aware empty state | Chat drawer, no messages | `src/components/chat/EmptyChat.tsx` |
| 2 | Follow-up chips ("Try next") | Chat drawer, after a tool turn completes | `src/components/chat/SuggestionChips.tsx` |
| 3 | "Ask DietAI" entry points | Recipe detail, recipes empty state, dashboard | `AskDietAIButton.tsx`, `AssistantCapabilityCard.tsx` |
| 4 | Capability menu ("What I can do") | Chat drawer header (Sparkles icon), always accessible | `src/components/chat/CapabilityMenu.tsx` |

**Key behavioral rule (do not change without engineering):** every suggestion **pre-fills the composer; it never auto-sends.** The user always confirms by pressing send. Entry points outside the chat dispatch the `dietai:open-chat` event; auth + paywall gating happens centrally in `ChatContainer` — free users see everything, clicking opens the Pro paywall modal.

**Content is catalog + i18n driven.** Labels/prompts come from `chat.capabilities.<id>.{label,prompt,entityPrompt}` in `messages/{en,es,pl}.json`. Icons are lucide icons declared in the catalog. Designers adding/removing/reordering suggestions = catalog entry + i18n keys, not markup.

## Layout

### Chat shell (existing, unchanged — for context)
| Breakpoint | Behavior |
|------------|----------|
| Desktop (≥ md) | Right sidebar, fixed **420px** wide, full height, `border-l border-border`, `shadow-xl`; page content shifts with `md:mr-[420px]`. Slide-in `translate-x`, 300ms ease-in-out. |
| Mobile (< md) | Bottom sheet, **90vh**, `rounded-t-3xl`, top shadow `0 -10px 40px rgba(0,0,0,0.1)`; backdrop `bg-black/40 backdrop-blur-sm`. Slide-up `translate-y`, 300ms. |
| FAB | `h-14 w-14`, `bottom-6`; `right-6` closed → `right-[444px]` open (desktop), 200ms `cubic-bezier(0.16,1,0.3,1)`. |

### Surface layouts
- **EmptyChat**: vertically centered column, logo block 64×64 `rounded-lg bg-muted`, title (`font-display text-2xl font-semibold`), subtitle (`text-sm`, max-width `32ch`), then a stack of up to **5** suggestion buttons, column `gap-2`, max-width **360px**.
- **SuggestionChips**: horizontal wrap row at the bottom of the message list: "Try next" label (`text-xs text-muted-foreground`) + up to **3** pill chips, `gap-2`.
- **CapabilityMenu**: full-drawer overlay (`absolute inset-0 z-[5]`), header row (back arrow + title), scrollable grouped list. Same pattern as the existing History panel.
- **Recipe detail row**: wrap row under the Time Stats Bar: uppercase micro-label "ASK DIETAI" (`text-[10px] font-bold tracking-wider`) + 3 pills.
- **Recipes empty state**: below the existing "start by adding" copy: micro-label "OR LET DIETAI DO IT" (`text-xs font-bold uppercase tracking-wider`, `mt-6 mb-3`) + 2 centered pills.
- **Dashboard card**: standard `Card` in the left column (under Weekly Progress): `CardTitle` "Your assistant can help" (`text-lg font-display font-semibold`), subtitle `text-sm text-muted-foreground mb-3`, wrap row of 3 pills.

## Design Tokens Used

All colors are semantic tokens (light values shown; dark theme remaps automatically — never hardcode hex):

| Token | Light value | Usage |
|-------|-------------|-------|
| `primary` | #E07A5F | Capability icons, hover borders |
| `card` | #FFFFFF | Suggestion/pill backgrounds |
| `border` | #E8E4DD | Default pill/button borders (1.5px) |
| `muted` | #F5F3EF | Hover backgrounds, logo block |
| `muted-foreground` | #A8A092 | "Try next" label, micro-labels, group headings, subtitles |
| `foreground` | #1C1A17 | Button/chip text |
| `background` | #FAF9F7 | Drawer/menu background |

Type and spacing in play: `text-xs` (chips/pills, 12px), `text-sm` (empty-state buttons, 14px, `font-medium`), `text-[10px]` (recipe-row micro-label), `font-display` for headings; pills `px-3 py-1.5 rounded-full`, empty-state buttons `px-4 py-3 rounded-md`, menu rows `px-4 py-2.5`.

## Components

| Component | Variant | Props | Notes |
|-----------|---------|-------|-------|
| `EmptyChat` suggestion button | rounded-md, left-aligned, icon 18px | `onSuggestionClick(prompt)` | Max 5; content from `selectCapabilitiesForPath(pathname)` |
| `SuggestionChips` pill | rounded-full, icon 14px | `capabilities`, `onPick(prompt)` | Max 3; rendered only when `!isStreaming && followUps.length > 0` |
| `AskDietAIButton` pill | identical styling to chip | `prompt`, `children`, `className` | Sparkles icon 14px fixed; reusable anywhere |
| `CapabilityMenu` row | full-width list row, icon 16px | `visible`, `onClose`, `onSelect(prompt)` | Groups: Recipes / Meal plans / Nutrition / Import |
| `ChatHeader` Sparkles button | icon 18px, `p-1` | `onToggleCapabilities` | Sits left of History/New-chat/Close |
| `AssistantCapabilityCard` | standard dashboard `Card` | none (self-contained) | Shows 3 of the 6 dashboard-context capabilities, rotated daily (UTC day-of-year) |

### Context → suggestion mapping (current ranking)
| Page area | EmptyChat shows (in order) |
|-----------|---------------------------|
| Recipe detail/edit | Analyze nutrition, Generate a recipe photo, Add a recipe to my plan, + Create recipe, Import from link |
| Meal plans | Ask for a 7-day plan, Add a recipe to my plan, Rearrange my meal plan, Find recipes, + Create recipe |
| Recipes list / new | Create recipe, Import from link, Upload a photo, + 7-day plan, Analyze nutrition |
| Dashboard | Create recipe, Import from link, 7-day plan, Find recipes, + Upload a photo |
| Anywhere else | Create recipe, Import from link, Upload a photo, 7-day plan, Analyze nutrition |

### Follow-up mapping (deterministic)
| Completed tool | Chips shown |
|----------------|-------------|
| Recipe created / imported (URL or photo) | Analyze nutrition, Generate a recipe photo, Add to my plan |
| Nutrition analyzed | Add a recipe to my plan, Ask for a 7-day plan |
| Meal plan generated | Rearrange my meal plan |
| Meal added to a day | Ask for a 7-day plan, Analyze nutrition |
| Read-only tools (search/get) and text-only turns | none (intentional) |

## States and Interactions

| Element | State | Behavior |
|---------|-------|----------|
| EmptyChat button | Default | `bg-card`, `border-[1.5px] border-border`, icon `text-primary` |
| EmptyChat button | Hover | `translate-x-1` (slides 4px right), `border-primary`, `bg-muted`; 150ms `cubic-bezier(0.16,1,0.3,1)` |
| EmptyChat button | Click | Pre-fills composer with prompt (entity-aware variant on recipe pages), focuses composer |
| Pill (chip / AskDietAI) | Hover | `border-primary`, `bg-muted` (`transition-colors`, no movement) |
| Pill | Click | Pre-fills composer; outside chat, also opens drawer (paywall for free users) |
| Follow-up chips row | Appears | On stream `finish` when the turn completed mapped tools |
| Follow-up chips row | Disappears | On next send, retry, edit/delete last turn, session switch, new chat |
| Follow-up chips row | While streaming | Hidden |
| Capability menu | Open/close | Slide from left, 200ms `cubic-bezier(0.16,1,0.3,1)`; `aria-hidden` when closed |
| Capability menu row | Click | Pre-fills composer, closes menu |
| Composer after prefill | — | Disabled while a turn streams; prompt text remains editable before send |
| Any entry point (free user) | Click | Existing Pro paywall modal opens instead of chat (`PRO_ONLY / aiChat`) |

## Responsive Behavior

| Breakpoint | Changes |
|------------|---------|
| Desktop (≥ md) | Drawer = 420px sidebar; chips/pills wrap inside 420px − 32px padding. Dashboard card in left column (lg:col-span-6 xl:col-span-5). |
| Mobile (< md) | Drawer = 90vh bottom sheet; all chat surfaces inherit. Recipe-detail pill row wraps to 2 lines with Spanish/Polish labels. Dashboard card full-width in single column. |

No surface defines its own breakpoints — everything flexes via `flex-wrap` within its container.

## Content Specifications

- **All copy lives in i18n** under `chat.*` in `messages/{en,es,pl}.json`. A parity test fails CI if a key is missing in any language. Spanish is **Spain Spanish (tuteo)** — no voseo in new copy.
- **Longest current strings** (size pills for these, not for English): es "Crear una receta describiéndola" (31 ch), pl "Przeanalizuj wartości odżywcze" (30 ch). No truncation is applied today — pills grow and wrap.
- **Entity-aware prompts**: on a recipe page, prompts read "…this recipe" ("Analyze the nutrition of this recipe"); elsewhere the generic variant is used ("How many calories and macros are in: "). Automatic — driven by URL.
- **Prompts ending in ": "** (e.g. "Import this recipe: ") intentionally leave the cursor ready for the user to paste a URL.
- **Empty states**: EmptyChat itself is the chat's empty state. Dashboard card renders nothing if the catalog returns no entries (defensive; can't happen today). Recipes empty-state pills are **suppressed when filters are active** (filter miss ≠ empty library).
- **Loading**: none of these surfaces have loading states — the catalog is static client data. Chips appear only after the turn fully finishes.
- **Error**: no error states needed; surfaces are presentational. Chat-level errors are handled by existing message bubbles.

## Edge Cases

- **Free user**: sees every surface; any click → paywall modal (existing component, unchanged).
- **Photo import flag off** (`FEATURE_MULTIMODAL_IMPORT`): the "Upload a photo of a recipe" capability still shows (status quo from the old empty state) but the agent has no tool to fulfill it. Known gap; long-term fix is exposing the flag via entitlements. Design can decide whether to visually de-emphasize.
- **Same chip clicked twice after editing the composer**: won't re-fill (pre-existing `initialValue` quirk in `ChatComposer`). Known engineering debt, out of scope for design.
- **Auto-navigation**: after creating/importing a recipe the app navigates to it; chips survive (drawer is layout-mounted) and entity-aware prompts then resolve against the new recipe page. This is why post-create chips say "this recipe".
- **Long conversations**: chips render at the bottom of the scroll container; the list auto-scrolls to bottom on new messages, so chips are visible when they appear.
- **RTL**: not supported by the app today (en/es/pl only).

## Animation / Motion

| Element | Trigger | Animation | Duration | Easing |
|---------|---------|-----------|----------|--------|
| EmptyChat button | Hover | translate-x 4px + border/bg color | 150ms | `cubic-bezier(0.16,1,0.3,1)` |
| Pills (all) | Hover | border/bg color only | default (`transition-colors`) | default |
| Capability menu | Toggle | slide-in from left (−100% → 0) | 200ms | `cubic-bezier(0.16,1,0.3,1)` |
| Chips row | Appear | none today — pops in on `finish` | — | — |
| Drawer / FAB | Open/close | existing slide + FAB shift | 300ms / 200ms | ease-in-out / `cubic-bezier(0.16,1,0.3,1)` |

The house easing is `cubic-bezier(0.16,1,0.3,1)` ("ease-out-expo-ish") — keep new motion consistent with it.

## Accessibility Notes

- **Sparkles header button**: `aria-label` + `title` = `chat.capabilityMenu.open` ("Show what the assistant can do").
- **Capability menu**: `aria-hidden={!visible}` when closed; back button labeled with `chat.history.back`. Focus is NOT currently trapped or moved on open — same behavior as the existing History panel. If design adds focus management, do it for both panels.
- **Message list**: `aria-live="polite"` — chips appearing inside it are announced after stream completion.
- **All suggestions are real `<button>` elements** — keyboard activation (Enter/Space) works natively; visible focus relies on browser default ring. No custom `:focus-visible` styling exists yet — worth adding in the design pass.
- **Icons are decorative** (text labels always present); no extra ARIA needed on them.
- **Touch targets**: pills are ~30px tall (`py-1.5` + 12px text) — **below the 44px minimum**. Flagged for the design pass; fine to increase padding, nothing depends on exact sizes.

## Open Design Questions (input wanted)

1. **Pill prominence**: chips, AskDietAI buttons and follow-ups all share one quiet pill style. Should entry points outside the chat be more inviting (filled? brand-colored?) given they're also the free-user upsell surface?
2. **Chips entrance**: they pop in with no motion. A subtle fade/slide-up would match the house style — spec it and we'll add it.
3. **Dashboard card visual weight**: it currently matches sibling cards. Marketing-wise it could carry more personality (illustration, gradient) — your call.
4. **Capability menu grouping/ordering**: groups are Recipes / Meal plans / Nutrition / Import with hand-tuned order. Re-rank freely — it's data, not markup.
5. **Touch targets + focus rings**: see accessibility notes — both need a deliberate design decision.
6. **"Try next" label**: plain text today. Keep, restyle, or drop?

## Reference

- Branch: `feat/chat-discoverability`, commit `0800312`. Run locally: `bun run dev` → `/en/dashboard`, `/en/recipes/<id>`, chat FAB.
- Catalog (content source): `src/lib/chat/capabilities.ts` · Copy: `messages/en.json` → `chat.capabilities.*`, `chat.capabilityMenu.*`, `chat.followUps.*`, `chat.entry.*`
- Tests lock behavior (not visuals): `tests/unit/chat/*.test.tsx` — restyle freely; changing copy, counts (5/3), suppression rules, or prefill behavior will fail tests by design.
