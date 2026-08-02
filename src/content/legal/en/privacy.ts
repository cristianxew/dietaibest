import type { LegalDocument } from "../types";
import {
  documentMeta,
  legalContact,
  legalEntity,
  subprocessors,
} from "../config";

const controllerName = `${legalEntity.name} ("${legalEntity.tradingName}", "we", "us")`;

export const privacyPolicyEn: LegalDocument = {
  title: "Privacy Policy",
  summary:
    "How Dietai collects, uses and protects your personal data — including the health information at the core of the service.",
  version: documentMeta.privacy.version,
  effectiveDate: documentMeta.privacy.effectiveDate,
  lastUpdated: documentMeta.privacy.lastUpdated,
  intro: [
    {
      kind: "p",
      text: `This policy explains what personal data ${controllerName} collects when you use Dietai, why we collect it, who we share it with, and the rights you have over it. It is written to meet Articles 13 and 14 of the General Data Protection Regulation (GDPR).`,
    },
    {
      kind: "callout",
      tone: "info",
      title: "The short version",
      text: "To build meal plans we need health information about you — your height, weight, date of birth, allergies and dietary goals. That is **special category data** under GDPR, and we only process it with your explicit consent. We do not sell your data. You can export or delete everything at any time.",
    },
  ],
  sections: [
    {
      id: "controller",
      heading: "1. Who is responsible for your data",
      blocks: [
        {
          kind: "p",
          text: `The data controller is ${legalEntity.name}, ${legalEntity.address.join(", ")}, ${legalEntity.country}, registered under ${legalEntity.registration}.`,
        },
        {
          kind: "p",
          text: `For any question about this policy or to exercise your rights, contact us at [${legalContact.privacy}](mailto:${legalContact.privacy}). Our Data Protection Officer can be reached at [${legalContact.dpo}](mailto:${legalContact.dpo}).`,
        },
      ],
    },
    {
      id: "data-we-collect",
      heading: "2. What data we collect",
      blocks: [
        {
          kind: "p",
          text: "We collect only what the service needs to function. The table below lists every category of personal data we hold and where it comes from.",
        },
        {
          kind: "table",
          headers: ["Category", "What it includes", "Source"],
          rows: [
            [
              "Account data",
              "Email address, password (stored only as a salted hash), display name, account creation date.",
              "You, at sign-up",
            ],
            [
              "Health and body data",
              "Date of birth, gender, height, weight, activity level, daily calorie target and macronutrient targets (protein, carbohydrate, fat).",
              "You, during onboarding",
            ],
            [
              "Allergy and dietary data",
              "Declared allergies, dietary type (e.g. vegetarian, keto), dietary goal and cuisine preferences.",
              "You, during onboarding",
            ],
            [
              "Household data",
              "For each family member you add: name, date of birth, relationship to you, gender, and optionally height, weight and dietary needs.",
              "You, when adding a household member",
            ],
            [
              "Recipe and meal plan data",
              "Recipes you create, import or save, your favourites, meal plan templates and schedules, and images you upload.",
              "You, in normal use",
            ],
            [
              "AI conversation data",
              "The messages you send to the in-app assistant, the assistant's replies, and any images you attach to them.",
              "You, when using the assistant",
            ],
            [
              "Shopping data",
              "Selected store, delivery or pickup preference, postal code, substitution and price preferences, and generated shopping lists.",
              "You, in shopping settings",
            ],
            [
              "Grocery store credentials",
              "If — and only if — you choose to enable automated ordering: the email address and password for your grocery retailer account. See section 5.",
              "You, explicitly and optionally",
            ],
            [
              "Billing data",
              "Subscription plan, status, renewal date, trial usage, and the customer and subscription identifiers issued by Stripe. **We never receive or store your card number.**",
              "Stripe, when you subscribe",
            ],
            [
              "Technical data",
              "IP address, browser user-agent, request timestamps and paths, recorded in server logs for security and diagnostics.",
              "Automatically",
            ],
          ],
        },
      ],
    },
    {
      id: "health-data",
      heading: "3. Health data and your explicit consent",
      blocks: [
        {
          kind: "p",
          text: "Your allergies, body measurements, date of birth and dietary goals are **special category personal data** under Article 9 GDPR, which prohibits processing such data unless a specific exception applies.",
        },
        {
          kind: "p",
          text: "We rely on Article 9(2)(a) — your **explicit consent** — given separately from your acceptance of the Terms of Service. Dietai cannot generate a meal plan or a calorie target without this data, so declining means the core features will not work. You may withdraw consent at any time from your profile settings; withdrawal does not affect processing carried out before you withdrew.",
        },
        {
          kind: "callout",
          tone: "warning",
          title: "Dietai does not provide medical advice",
          text: "Nutritional targets and meal plans generated by Dietai are informational only. They are not a diagnosis, treatment, or a substitute for advice from a qualified healthcare professional. **Never rely on Dietai's allergen handling to keep you safe from a serious allergy or intolerance — always verify ingredients yourself.** If you have a medical condition, are pregnant, or are managing a clinical diet, consult a doctor or registered dietitian before acting on anything Dietai suggests.",
        },
      ],
    },
    {
      id: "household-and-children",
      heading: "4. Household members and children",
      blocks: [
        {
          kind: "p",
          text: "Dietai lets you add family members so meal plans can account for the whole household. When you do this you are giving us personal data — including health data — about **someone other than yourself**, and often about a child.",
        },
        {
          kind: "p",
          text: "By adding a household member you confirm that you have the authority to share their information with us, and that you have informed them of this policy (or, where the member is a child, that you hold parental responsibility for them).",
        },
        {
          kind: "p",
          text: "Dietai is not directed at children and we do not permit anyone under 16 to create their own account. Data about a child added as a household member is used only to calculate that household's nutritional needs, is never used to build a profile about the child, and is deleted together with your account.",
        },
      ],
    },
    {
      id: "store-credentials",
      heading: "5. Grocery store credentials and automated ordering",
      blocks: [
        {
          kind: "p",
          text: "This section describes the most sensitive processing Dietai performs. Please read it before enabling automated ordering.",
        },
        {
          kind: "p",
          text: "If you opt in to automated shopping, you may save the sign-in credentials for a supported grocery retailer. Those credentials are encrypted at rest using AES-256-GCM with a key held separately from the database, and each record stores its own initialisation vector and authentication tag.",
        },
        {
          kind: "p",
          text: "**When you start an automated order, your store email address and password are decrypted and transmitted to Browser Use Cloud**, a third-party service that runs a remote browser which signs in to the retailer as you and fills your basket. This is the only way automated ordering can work, and it means your retailer password is processed outside our infrastructure for the duration of that session.",
        },
        {
          kind: "callout",
          tone: "warning",
          title: "You can use Dietai fully without this",
          text: "Saving store credentials is entirely optional. Shopping lists, meal plans and every other feature work without it. If you would rather not have a retailer password leave our systems, do not save credentials — you can still generate a list and order manually. You may delete stored credentials at any time in shopping settings, which removes them immediately and permanently.",
        },
        {
          kind: "p",
          text: "We recommend using a password unique to that retailer, and never reusing your Dietai password or your email password.",
        },
      ],
    },
    {
      id: "ai-processing",
      heading: "6. How we use AI, and what it sees",
      blocks: [
        {
          kind: "p",
          text: "Dietai uses third-party large language models for three distinct purposes. They receive different data, so we describe each separately:",
        },
        {
          kind: "ul",
          items: [
            "**Nutrition analysis.** Ingredient text from your recipes is sent to Google's Gemini models to match each ingredient to a USDA food entry and estimate portion size. Only the ingredient text is sent — not your name, email or health profile.",
            "**The in-app assistant.** Your messages, any attached images, and relevant parts of your dietary profile are sent to Anthropic to generate a reply.",
            "**Recipe import.** When you import a recipe from a link, the URL is sent to Supadata to extract its content.",
          ],
        },
        {
          kind: "p",
          text: "These providers act as our processors: they are contractually bound to use the data only to return a result to us. Contractual terms are not a technical guarantee, so please do not paste sensitive personal information — of your own or anyone else's — into the assistant.",
        },
        {
          kind: "p",
          text: "**Automated decision-making.** Dietai calculates calorie and macronutrient targets automatically from the profile data you provide. These calculations produce a suggestion, not a decision with legal or similarly significant effects under Article 22 GDPR: nothing is withheld from you on the basis of them, you can override every value manually, and no human review is required for you to do so.",
        },
      ],
    },
    {
      id: "legal-bases",
      heading: "7. Why we are allowed to process your data",
      blocks: [
        {
          kind: "p",
          text: "Article 6 GDPR requires a lawful basis for every purpose. Ours are:",
        },
        {
          kind: "table",
          headers: ["Purpose", "Data used", "Lawful basis"],
          rows: [
            [
              "Creating and running your account",
              "Account data",
              "Art. 6(1)(b) — performance of our contract with you",
            ],
            [
              "Generating meal plans and nutrition targets",
              "Health, allergy and dietary data",
              "Art. 6(1)(b) contract **and** Art. 9(2)(a) explicit consent",
            ],
            [
              "Household meal planning",
              "Family member data",
              "Art. 6(1)(b) contract **and** Art. 9(2)(a) explicit consent",
            ],
            [
              "Answering your questions in the assistant",
              "Conversation data, dietary profile",
              "Art. 6(1)(b) — performance of our contract with you",
            ],
            [
              "Automated grocery ordering",
              "Shopping data, store credentials",
              "Art. 6(1)(a) — your separate, opt-in consent",
            ],
            [
              "Taking payment and managing subscriptions",
              "Billing data",
              "Art. 6(1)(b) contract and Art. 6(1)(c) legal obligation (tax and accounting records)",
            ],
            [
              "Keeping the service secure and diagnosing faults",
              "Technical data",
              "Art. 6(1)(f) — our legitimate interest in a secure, working service",
            ],
            [
              "Non-essential cookies and analytics",
              "Technical data",
              "Art. 6(1)(a) — your consent, given in the cookie banner",
            ],
          ],
        },
      ],
    },
    {
      id: "sharing",
      heading: "8. Who we share your data with",
      blocks: [
        {
          kind: "p",
          text: "**We do not sell your personal data, and we do not share it for advertising.** We share it only with the processors below, each of which is bound by a data processing agreement and may use the data solely to provide their service to us.",
        },
        {
          kind: "table",
          headers: ["Provider", "What they do", "What they receive", "Location"],
          rows: subprocessors.map((s) => [
            `[${s.name}](${s.privacyUrl})`,
            s.purpose,
            s.dataShared,
            s.location,
          ]),
        },
        {
          kind: "p",
          text: "We also query USDA FoodData Central for nutrient reference data. Those requests carry a generic food term only and contain no personal data.",
        },
        {
          kind: "p",
          text: "Beyond this, we disclose personal data only where we are legally compelled to — for example in response to a valid court order — or to establish or defend a legal claim. If Dietai is ever involved in a merger or acquisition, we will notify you before your data becomes subject to a different privacy policy.",
        },
      ],
    },
    {
      id: "transfers",
      heading: "9. International transfers",
      blocks: [
        {
          kind: "p",
          text: "Some of our processors operate outside the European Economic Area, principally in the United States. Where personal data is transferred outside the EEA we rely on the European Commission's Standard Contractual Clauses, supplemented where necessary by additional technical measures, as permitted by Chapter V GDPR.",
        },
        {
          kind: "p",
          text: `You can request a copy of the safeguards applying to a specific transfer by writing to [${legalContact.privacy}](mailto:${legalContact.privacy}).`,
        },
      ],
    },
    {
      id: "retention",
      heading: "10. How long we keep your data",
      blocks: [
        {
          kind: "p",
          text: "We keep personal data only as long as the purpose requires:",
        },
        {
          kind: "table",
          headers: ["Data", "Retention period"],
          rows: [
            [
              "Account, profile, health and household data",
              "For as long as your account is open. Deleted within 30 days of you deleting your account.",
            ],
            [
              "Recipes, meal plans and uploaded images",
              "For as long as your account is open, then deleted with it.",
            ],
            [
              "AI conversations",
              "Until you clear the conversation or delete your account. Cleared conversations are archived and then removed on our scheduled cleanup.",
            ],
            [
              "Grocery store credentials",
              "Until you remove them or delete your account — whichever is first. Removal is immediate.",
            ],
            [
              "Billing and invoice records",
              "Retained for the period required by tax and accounting law in our country of establishment, typically 5–7 years, even after account deletion.",
            ],
            [
              "Server and security logs",
              "TODO_CONFIRM_LOG_RETENTION_PERIOD",
            ],
          ],
        },
        {
          kind: "p",
          text: "Anonymised and cached reference data — for example the mapping from an ingredient name to a USDA food entry — is not personal data and may be kept indefinitely to improve the service.",
        },
      ],
    },
    {
      id: "your-rights",
      heading: "11. Your rights",
      blocks: [
        {
          kind: "p",
          text: "Under GDPR you have the following rights over your personal data. They are free to exercise, and we will respond within one month.",
        },
        {
          kind: "ul",
          items: [
            "**Access** (Art. 15) — obtain a copy of the personal data we hold about you.",
            "**Rectification** (Art. 16) — correct data that is inaccurate or incomplete.",
            "**Erasure** (Art. 17) — have your data deleted, subject to records we must keep by law.",
            "**Restriction** (Art. 18) — require us to pause processing while a dispute is resolved.",
            "**Portability** (Art. 20) — receive your data in a structured, machine-readable format, or have it sent directly to another provider.",
            "**Objection** (Art. 21) — object to processing carried out on the basis of our legitimate interests.",
            "**Withdraw consent** (Art. 7(3)) — withdraw any consent you have given, at any time, without affecting processing already carried out.",
            "**Not be subject to automated decisions** (Art. 22) — as explained in section 6, we do not make decisions of this kind about you.",
          ],
        },
        {
          kind: "p",
          text: `To exercise any of these rights, write to [${legalContact.privacy}](mailto:${legalContact.privacy}). We may ask you to confirm your identity before we act, so that we do not disclose your data to someone else.`,
        },
        {
          kind: "p",
          text: `If you believe we have handled your data unlawfully you may lodge a complaint with your local data protection authority. Ours is [${legalEntity.supervisoryAuthority.name}](${legalEntity.supervisoryAuthority.url}). We would appreciate the chance to resolve the matter first.`,
        },
      ],
    },
    {
      id: "security",
      heading: "12. How we protect your data",
      blocks: [
        {
          kind: "ul",
          items: [
            "All traffic between your device and Dietai is encrypted in transit using TLS.",
            "Passwords are stored only as salted hashes and are never recoverable in plain text.",
            "Grocery store credentials are encrypted at rest with AES-256-GCM, using a key held outside the database.",
            "Access to production systems is restricted to personnel who need it to operate the service.",
            "Security headers are applied to every response to limit clickjacking and content-type attacks.",
          ],
        },
        {
          kind: "p",
          text: "No system is perfectly secure. If a breach occurs that is likely to result in a high risk to your rights and freedoms, we will notify you and the supervisory authority as required by Articles 33 and 34 GDPR.",
        },
      ],
    },
    {
      id: "cookies",
      heading: "13. Cookies",
      blocks: [
        {
          kind: "p",
          text: "We use cookies that are strictly necessary to keep you signed in and to remember your language. Non-essential cookies are set only with your consent. Full detail is in our [Cookie Policy](/cookies).",
        },
      ],
    },
    {
      id: "changes",
      heading: "14. Changes to this policy",
      blocks: [
        {
          kind: "p",
          text: `This is version ${documentMeta.privacy.version}, effective ${documentMeta.privacy.effectiveDate}. If we make a change that materially affects how we use your data, we will notify you by email or in the app before it takes effect, and — where the change requires it — ask for your consent again. Minor clarifications are published here with an updated revision date.`,
        },
      ],
    },
    {
      id: "contact",
      heading: "15. Contact us",
      blocks: [
        {
          kind: "p",
          text: `Privacy questions and data-subject requests: [${legalContact.privacy}](mailto:${legalContact.privacy}). Anything else: [${legalContact.support}](mailto:${legalContact.support}).`,
        },
        {
          kind: "p",
          text: `${legalEntity.name}, ${legalEntity.address.join(", ")}, ${legalEntity.country}.`,
        },
      ],
    },
  ],
};
