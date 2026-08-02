import type { LegalDocument } from "../types";
import { documentMeta, legalContact } from "../config";

export const cookiePolicyEn: LegalDocument = {
  title: "Cookie Policy",
  summary:
    "Every cookie and browser storage item Dietai uses, why it exists, and how long it lasts.",
  version: documentMeta.cookies.version,
  effectiveDate: documentMeta.cookies.effectiveDate,
  lastUpdated: documentMeta.cookies.lastUpdated,
  intro: [
    {
      kind: "p",
      text: "This policy covers cookies and equivalent browser storage — such as `localStorage` — which Article 5(3) of the ePrivacy Directive treats the same way.",
    },
    {
      kind: "callout",
      tone: "info",
      title: "We do not track you",
      text: "Dietai sets **no advertising, analytics or third-party tracking cookies**. Everything listed below is strictly necessary to run the service or to remember a preference you chose yourself. That is why you are not asked to accept a cookie banner.",
    },
  ],
  sections: [
    {
      id: "essential",
      heading: "1. Strictly necessary cookies",
      blocks: [
        {
          kind: "p",
          text: "These are required for the service to work. They cannot be switched off, and consent is not required for them under Article 5(3) ePrivacy.",
        },
        {
          kind: "table",
          headers: ["Name", "Purpose", "Duration"],
          rows: [
            [
              "`next-auth.session-token`",
              "Keeps you signed in and identifies your session. Without it you would be logged out on every page load.",
              "Session, or until you sign out",
            ],
            [
              "`next-auth.csrf-token`",
              "Protects sign-in and account forms against cross-site request forgery.",
              "Session",
            ],
            [
              "`next-auth.callback-url`",
              "Returns you to the page you were on after signing in.",
              "Session",
            ],
          ],
        },
      ],
    },
    {
      id: "functional",
      heading: "2. Preference cookies and storage",
      blocks: [
        {
          kind: "p",
          text: "These remember choices you made. They store no identifier that could be used to track you across sites.",
        },
        {
          kind: "table",
          headers: ["Name", "Type", "Purpose", "Duration"],
          rows: [
            [
              "`NEXT_LOCALE`",
              "Cookie",
              "Remembers whether you chose English, Polish or Spanish.",
              "1 year",
            ],
            [
              "`sidebar:state`",
              "Cookie",
              "Remembers whether you collapsed the navigation sidebar.",
              "7 days",
            ],
            [
              "`sidebar-collapsed`",
              "localStorage",
              "Mirrors the sidebar preference so the layout does not flicker on load.",
              "Until you clear site data",
            ],
            [
              "Onboarding and prompt dismissals",
              "localStorage",
              "Remembers that you dismissed a one-off prompt so we do not show it again.",
              "Until you clear site data",
            ],
            [
              "Onboarding draft",
              "localStorage",
              "Saves your progress through onboarding so you can close the tab and resume.",
              "Until onboarding completes",
            ],
            [
              "Recent recipe searches",
              "localStorage",
              "Shows your recent searches in the recipe search box. Never leaves your device.",
              "Until you clear site data",
            ],
          ],
        },
      ],
    },
    {
      id: "third-party",
      heading: "3. Third-party cookies",
      blocks: [
        {
          kind: "p",
          text: "Dietai loads no third-party trackers. Two exceptions are worth naming:",
        },
        {
          kind: "ul",
          items: [
            "**Stripe** may set cookies on its own hosted checkout and billing pages to process your payment and prevent fraud. Those pages are governed by [Stripe's privacy policy](https://stripe.com/privacy).",
            "**Google** may set cookies if you choose to sign in with your Google account, as part of Google's own authentication flow.",
          ],
        },
      ],
    },
    {
      id: "managing",
      heading: "4. Managing cookies",
      blocks: [
        {
          kind: "p",
          text: "You can delete or block cookies in your browser settings. Be aware that blocking the strictly necessary cookies above will prevent you from signing in, because there would be nothing to keep your session alive.",
        },
        {
          kind: "p",
          text: "Clearing site data will also remove the preference storage listed in section 2, resetting your language and layout choices.",
        },
      ],
    },
    {
      id: "changes",
      heading: "5. Changes",
      blocks: [
        {
          kind: "p",
          text: `This is version ${documentMeta.cookies.version}, effective ${documentMeta.cookies.effectiveDate}. **If we ever introduce analytics or any non-essential cookie, we will add a consent banner and obtain your consent before it is set** — we will not quietly amend this page instead.`,
        },
        {
          kind: "p",
          text: `Questions: [${legalContact.privacy}](mailto:${legalContact.privacy}).`,
        },
      ],
    },
  ],
};
