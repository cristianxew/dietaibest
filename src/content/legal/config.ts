/**
 * Single source of truth for the identity and contact details cited across
 * every legal document.
 *
 * ─────────────────────────────────────────────────────────────────────────
 *  ACTION REQUIRED — every value marked TODO must be replaced with real,
 *  verifiable details before these pages go live.
 *
 *  Under GDPR Art. 13(1)(a) a privacy notice must identify the controller.
 *  A notice naming a legal entity that does not exist is not a technicality:
 *  it makes the notice unusable as a lawful basis for processing, and the
 *  footer's current "DietAI Inc." claim is unverified.
 * ─────────────────────────────────────────────────────────────────────────
 */

export const legalEntity = {
  /** Registered legal name, e.g. "Dietai sp. z o.o." */
  name: "TODO_LEGAL_ENTITY_NAME",
  /** Trading name shown in prose. */
  tradingName: "Dietai",
  /** Company register + number, e.g. "KRS 0000123456, NIP 1234567890". */
  registration: "TODO_COMPANY_REGISTRATION_NUMBER",
  /** Full registered address, one line per element. */
  address: ["TODO_STREET_ADDRESS", "TODO_POSTAL_CODE TODO_CITY"],
  /** ISO 3166 country of establishment — determines the lead supervisory authority. */
  country: "TODO_COUNTRY",
  /** Supervisory authority for the country above. Poland: "Prezes Urzędu Ochrony Danych Osobowych (UODO)". */
  supervisoryAuthority: {
    name: "TODO_SUPERVISORY_AUTHORITY_NAME",
    url: "TODO_SUPERVISORY_AUTHORITY_URL",
  },
} as const;

export const legalContact = {
  /** General support / contractual notices. */
  support: "TODO_SUPPORT_EMAIL",
  /** Privacy and data-subject requests. GDPR Art. 13 requires a working channel. */
  privacy: "TODO_PRIVACY_EMAIL",
  /**
   * Data Protection Officer. A DPO is mandatory under GDPR Art. 37(1)(c) where
   * core activities involve large-scale processing of Art. 9 special-category
   * data — which health, allergy and body-metric data is. Confirm whether the
   * threshold is met; if it is not, delete this and the DPO paragraph.
   */
  dpo: "TODO_DPO_EMAIL_OR_REMOVE",
} as const;

export const productUrls = {
  /** Canonical origin, no trailing slash. Used for absolute links in metadata. */
  origin: "TODO_PRODUCTION_ORIGIN",
  terms: "/terms",
  privacy: "/privacy",
  cookies: "/cookies",
} as const;

/**
 * Governing law and forum for the Terms.
 *
 * Note: under Regulation (EU) 1215/2012 and the Rome I Regulation a choice of
 * law cannot deprive a consumer of the mandatory protections of their own
 * country of residence. The clause below therefore states the choice *and*
 * preserves those rights, rather than pretending to override them.
 */
export const governingLaw = {
  jurisdiction: "TODO_GOVERNING_LAW_COUNTRY",
  courts: "TODO_COMPETENT_COURTS",
} as const;

/** Versioning — bump and update dates on every substantive edit. */
export const documentMeta = {
  terms: { version: "1.0", effectiveDate: "TODO_YYYY-MM-DD", lastUpdated: "TODO_YYYY-MM-DD" },
  privacy: { version: "1.0", effectiveDate: "TODO_YYYY-MM-DD", lastUpdated: "TODO_YYYY-MM-DD" },
  cookies: { version: "1.0", effectiveDate: "TODO_YYYY-MM-DD", lastUpdated: "TODO_YYYY-MM-DD" },
} as const;

export interface Subprocessor {
  name: string;
  purpose: string;
  /** What personal data actually reaches them — be specific, not "usage data". */
  dataShared: string;
  /** Where processing happens; drives the Chapter V transfer analysis. */
  location: string;
  /** Art. 46 safeguard relied on for any transfer outside the EEA. */
  transferMechanism: string;
  privacyUrl: string;
}

/**
 * Subprocessor register.
 *
 * Every entry below was derived from the running code, not from guesswork:
 * `ANTHROPIC_API_KEY`, `GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_SUPABASE_URL`,
 * `STRIPE_SECRET_KEY`, `BROWSER_USE_API_KEY`, `SUPADATA_API_KEY` and
 * `FDC_API_KEY` are all read at runtime. Keep this list in sync — an
 * undisclosed subprocessor is one of the most commonly enforced GDPR failures.
 */
export const subprocessors: Subprocessor[] = [
  {
    name: "Browser Use Cloud",
    purpose:
      "Runs the remote browser agent that places grocery orders on your behalf when you use shopping automation.",
    dataShared:
      "Your shopping list, delivery preferences and postal code, and — only if you have saved store credentials — the email address and password for the selected grocery retailer, injected into the agent session so it can sign in as you.",
    location: "TODO_CONFIRM_REGION",
    transferMechanism: "TODO_CONFIRM_SCC_OR_DPA",
    privacyUrl: "https://browser-use.com/privacy",
  },
  {
    name: "Anthropic, PBC",
    purpose: "Powers the in-app AI assistant conversations.",
    dataShared:
      "The content of your chat messages, any images you attach, and the dietary profile context supplied to answer them.",
    location: "United States",
    transferMechanism: "Standard Contractual Clauses",
    privacyUrl: "https://www.anthropic.com/legal/privacy",
  },
  {
    name: "Google (Gemini / Vertex AI, Google Sign-In)",
    purpose:
      "Resolves ingredient names to USDA food entries and estimates portions; also provides optional Google sign-in.",
    dataShared:
      "Ingredient text from your recipes, and — where you use Google sign-in — your name, email address and account identifier.",
    location: "TODO_CONFIRM_REGION",
    transferMechanism: "Standard Contractual Clauses",
    privacyUrl: "https://policies.google.com/privacy",
  },
  {
    name: "Stripe, Inc.",
    purpose: "Processes subscription payments and manages billing.",
    dataShared:
      "Your email address, billing details and subscription status. Card numbers are collected by Stripe directly and are never stored on our systems.",
    location: "United States / Ireland",
    transferMechanism: "Standard Contractual Clauses",
    privacyUrl: "https://stripe.com/privacy",
  },
  {
    name: "Supabase",
    purpose: "Stores images you upload, such as recipe photos.",
    dataShared: "Uploaded image files and the account identifier they belong to.",
    location: "TODO_CONFIRM_REGION",
    transferMechanism: "TODO_CONFIRM_SCC_OR_DPA",
    privacyUrl: "https://supabase.com/privacy",
  },
  {
    name: "Supadata",
    purpose: "Extracts recipe content from URLs and videos you choose to import.",
    dataShared: "The URL you submit for import.",
    location: "TODO_CONFIRM_REGION",
    transferMechanism: "TODO_CONFIRM_SCC_OR_DPA",
    privacyUrl: "TODO_SUPADATA_PRIVACY_URL",
  },
  {
    name: "TODO_HOSTING_PROVIDER",
    purpose: "Hosts the application servers and the primary database.",
    dataShared: "All account data stored by the service.",
    location: "TODO_CONFIRM_REGION",
    transferMechanism: "TODO_CONFIRM_SCC_OR_DPA",
    privacyUrl: "TODO_HOSTING_PRIVACY_URL",
  },
];

/**
 * USDA FoodData Central is queried for nutrient reference data. It is listed
 * separately because the request carries a generic food term only — no account
 * identifier and no personal data — so it is not a processor of personal data.
 */
export const nonPersonalDataServices = [
  {
    name: "USDA FoodData Central",
    note: "Queried with generic food terms only (e.g. \"salmon\"). No personal data is transmitted.",
  },
] as const;
