# SOP — Legal pages (Terms, Privacy, Cookies)

How the legal documents are built, and what you must do when the product
changes in a way that affects them.

## Where things live

| Path | Role |
| --- | --- |
| `src/content/legal/config.ts` | **Single source of truth** for entity name, addresses, contact emails, governing law, document versions, and the subprocessor register. |
| `src/content/legal/types.ts` | The block content model (`p`, `ul`, `ol`, `table`, `callout`). |
| `src/content/legal/en/*.ts` | The authoritative English documents. |
| `src/content/legal/index.ts` | Slug + locale resolution, with fallback to English. |
| `src/components/legal/LegalDocumentPage.tsx` | Renderer (header, TOC, sections). |
| `src/components/legal/LegalInline.tsx` | Inline `**bold**`, `[link](href)`, `` `code` `` renderer. |
| `src/components/legal/legal-route.tsx` | Shared metadata + page factory used by all three routes. |
| `src/app/[locale]/(public-pages)/{terms,privacy,cookies}/page.tsx` | Thin route files. |

Legal copy is deliberately **not** in `messages/*.json`: those bundles load on
every route, and the legal corpus is several thousand words per locale.

## Non-negotiable rules

1. **The routes must stay in `PUBLIC_ROUTES` in `src/middleware.ts`.**
   The `authorized` callback defaults unknown routes to `!!token`. If `/terms`
   or `/privacy` fall out of that list, logged-out users clicking the consent
   checkbox on the sign-up form get redirected to `/sign-in` — the exact people
   who need to read them.

2. **Never machine-translate these documents.** A supervisory authority reads
   the notice in the language it is published in. A mistranslated legal basis
   or liability clause is a substantive defect. `pl` and `es` must come from a
   qualified legal translator; until then `getLegalDocument` falls back to
   English and the page renders a visible notice saying so.

3. **Anchor ids are permanent.** External parties and internal links cite
   `#store-credentials`, `#legal-bases`, etc. Change a heading freely; do not
   change an `id` after publication.

## When you must update the Privacy Policy

Any of these changes make the current policy inaccurate — treat them as part of
the feature, not as follow-up work:

- **Adding or removing a third-party service that receives personal data.**
  Update `subprocessors` in `config.ts`. The table in section 8 renders from
  that array, so the page updates itself. An undisclosed subprocessor is one of
  the most commonly enforced GDPR failures.
- **Collecting a new field on `User`, `UserProfile`, or `FamilyMember`.**
  Add it to the section 2 table and, if it is health-related, confirm section 3
  still describes the Art. 9 basis correctly.
- **Changing what is sent to an LLM.** Section 6 names exactly what each
  provider receives.
- **Changing retention or deletion behaviour.** Section 10.
- **Any change to the store-credential flow.** Section 5 is the most sensitive
  disclosure in the document: it states that credentials are decrypted and
  transmitted to Browser Use Cloud. Verify against
  `src/lib/browser-use.ts` (the `secrets` payload carrying `store_email` /
  `store_password`) before editing.

## Versioning and notification

`documentMeta` in `config.ts` holds `version`, `effectiveDate` and
`lastUpdated` per document.

- **Material change** — bump the major version, set a future `effectiveDate`,
  and notify users by email or in-app *before* it takes effect. GDPR Art. 12
  requires active notification; silently editing the page is not sufficient.
  Where the change alters the basis for processing health data, consent must be
  collected again.
- **Clarification** — bump the minor version and update `lastUpdated`.

## Cookies

There are currently **no analytics or tracking cookies**, which is why there is
no consent banner. If you add any non-essential cookie or storage:

1. Add a consent banner that blocks the cookie until consent is given.
2. Add the cookie to section 2 or a new section 3 of the Cookie Policy.
3. Add the consent legal basis to the section 7 table in the Privacy Policy.

Do not add analytics first and document it later.

## Local preview

The worktree needs its own `node_modules` and a `NEXTAUTH_SECRET`:

```bash
bun install && bunx prisma generate
```

Then start the dev server and visit `/terms`, `/privacy`, `/cookies`. Check a
non-English locale (`/pl/privacy`) to confirm the fallback notice renders.
