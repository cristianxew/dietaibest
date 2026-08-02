import type { LegalDocument } from "../types";
import {
  documentMeta,
  governingLaw,
  legalContact,
  legalEntity,
} from "../config";

export const termsOfServiceEn: LegalDocument = {
  title: "Terms of Service",
  summary:
    "The agreement between you and Dietai — what the service does, what it costs, and where its limits are.",
  version: documentMeta.terms.version,
  effectiveDate: documentMeta.terms.effectiveDate,
  lastUpdated: documentMeta.terms.lastUpdated,
  intro: [
    {
      kind: "p",
      text: `These Terms form a binding agreement between you and ${legalEntity.name} ("${legalEntity.tradingName}", "we", "us"), ${legalEntity.address.join(", ")}, ${legalEntity.country}. By creating an account you accept them. If you do not accept them, please do not use Dietai.`,
    },
    {
      kind: "callout",
      tone: "warning",
      title: "Read section 3 before you rely on Dietai for anything health-related",
      text: "Dietai is a meal-planning tool, not a medical service. It does not give medical or dietetic advice, and its allergen handling must never be treated as a safety guarantee.",
    },
  ],
  sections: [
    {
      id: "service",
      heading: "1. What Dietai does",
      blocks: [
        {
          kind: "p",
          text: "Dietai helps you plan meals. It generates nutritional targets from the profile you provide, builds meal plans and shopping lists, estimates the nutrition of recipes using USDA FoodData Central reference data, answers questions through an AI assistant, and — if you choose to enable it — places grocery orders on your behalf.",
        },
        {
          kind: "p",
          text: "We may add, change or withdraw features over time. Where a change materially reduces what you have paid for, we will tell you in advance and you may cancel and receive a pro-rata refund for the unused part of your term.",
        },
      ],
    },
    {
      id: "eligibility",
      heading: "2. Who may use Dietai",
      blocks: [
        {
          kind: "p",
          text: "You must be at least 16 years old to create an account. You may add household members of any age to your plan, but only you may operate the account.",
        },
        {
          kind: "p",
          text: "You are responsible for keeping your password confidential and for everything done through your account. Tell us promptly at " +
            `[${legalContact.support}](mailto:${legalContact.support}) if you believe someone else has gained access to it.`,
        },
      ],
    },
    {
      id: "not-medical-advice",
      heading: "3. Dietai is not medical advice",
      blocks: [
        {
          kind: "callout",
          tone: "warning",
          title: "Important health limitations",
          text: "**Dietai does not provide medical, dietetic or clinical advice, and no doctor-patient or dietitian-client relationship is created by using it.** Calorie targets, macronutrient splits and meal plans are automated estimates generated from the information you enter. They may be unsuitable for you.",
        },
        {
          kind: "p",
          text: "You must consult a qualified healthcare professional before relying on Dietai if you are pregnant or breastfeeding, are under medical supervision, have diabetes, an eating disorder, kidney or liver disease, or any condition affected by diet, or are planning a diet for a child.",
        },
        {
          kind: "p",
          text: "**On allergies specifically:** Dietai records the allergies you declare and tries to account for them, but ingredient matching is automated and imperfect, imported recipes may be incomplete or wrong, and manufacturers change formulations. **Always read the actual product labels yourself.** Do not use Dietai as the sole safeguard against an allergen that could harm you.",
        },
        {
          kind: "p",
          text: "Nutrition figures are estimates. Where an ingredient cannot be matched to a USDA entry, values may be estimated by an AI model or omitted entirely; the app flags these cases, and you should treat flagged values as indicative only.",
        },
      ],
    },
    {
      id: "ai-output",
      heading: "4. AI-generated content",
      blocks: [
        {
          kind: "p",
          text: "Parts of Dietai are powered by large language models. AI output can be plausible and still wrong. We do not warrant that any AI-generated recipe, nutritional figure, substitution or answer is accurate, complete or suitable for you, and you should apply your own judgement before acting on it.",
        },
        {
          kind: "p",
          text: "Do not enter sensitive personal information about yourself or others into the assistant beyond what the service needs.",
        },
      ],
    },
    {
      id: "subscriptions",
      heading: "5. Subscriptions, trials and payment",
      blocks: [
        {
          kind: "p",
          text: "Dietai offers a free tier and paid plans. Prices and what each plan includes are shown at the point of purchase and form part of these Terms.",
        },
        {
          kind: "ul",
          items: [
            "**Payment** is handled by Stripe. We never see or store your full card details.",
            "**Free trials** are limited to one per account. If you do not cancel before the trial ends, the subscription converts to a paid term and the first payment is taken automatically.",
            "**Renewal** is automatic at the end of each billing period, at the then-current price, until you cancel.",
            "**Price changes** will be notified to you at least 30 days in advance and take effect at your next renewal. You may cancel before then.",
            "**Failed payments** may result in suspension of paid features. We will attempt to contact you first.",
          ],
        },
        {
          kind: "p",
          text: "You can cancel at any time from your subscription settings. Cancellation stops the next renewal; your paid features remain available until the end of the period you have already paid for.",
        },
      ],
    },
    {
      id: "withdrawal",
      heading: "6. Your right of withdrawal (EU/EEA consumers)",
      blocks: [
        {
          kind: "p",
          text: "If you are a consumer in the EU or EEA, Directive 2011/83/EU gives you **14 days** from the conclusion of the contract to withdraw from it without giving a reason and without penalty.",
        },
        {
          kind: "p",
          text: "Dietai is digital content supplied immediately. By starting to use a paid plan within the 14-day period, you expressly request that we begin performance immediately and acknowledge that **you thereby lose your right of withdrawal** once the service has been fully performed. Where performance has begun but is not complete, you may still withdraw and we will charge you only a proportionate amount for what was supplied.",
        },
        {
          kind: "p",
          text: `To withdraw, send an unambiguous statement to [${legalContact.support}](mailto:${legalContact.support}) within the 14-day period. We will refund you within 14 days of receiving it, using the same payment method.`,
        },
        {
          kind: "p",
          text: "Outside this statutory right, payments are non-refundable except where required by law or offered at our discretion.",
        },
      ],
    },
    {
      id: "your-content",
      heading: "7. Your content",
      blocks: [
        {
          kind: "p",
          text: "Recipes, images, notes and meal plans you create or upload remain yours. You grant us a non-exclusive, worldwide, royalty-free licence to store, reproduce and process them **solely to operate the service for you** — for example to analyse a recipe's nutrition or render it in your plan. This licence ends when you delete the content or your account, except for backup copies that expire on their normal cycle.",
        },
        {
          kind: "p",
          text: "If you publish or share a recipe through a share link, you grant us the additional right to display it to anyone holding that link, for as long as the link is active.",
        },
        {
          kind: "p",
          text: "You are responsible for what you upload. Do not upload content you have no right to share — including recipe text or photographs copied from a copyrighted source such as a cookbook or another website.",
        },
      ],
    },
    {
      id: "shopping-automation",
      heading: "8. Automated grocery ordering",
      blocks: [
        {
          kind: "p",
          text: "This optional feature acts on your behalf at a third-party retailer. Please understand what you are authorising.",
        },
        {
          kind: "ul",
          items: [
            "By saving store credentials and starting an automated order you **authorise us to act as your agent** — signing in to your retailer account and adding items to your basket as if you had done it yourself.",
            "Your store email address and password are transmitted to our automation provider for the duration of the session so that sign-in can occur. This is described in section 5 of the [Privacy Policy](/privacy), which you should read before enabling the feature.",
            "**Any order placed is a contract between you and the retailer, not with us.** Their terms, prices, delivery, substitutions, returns and refunds apply.",
            "Automation is imperfect. It may select the wrong product, an unintended quantity, an unwanted substitution, or fail part-way. **Review your basket at the retailer before confirming any purchase.**",
            "You remain responsible for payment of any order placed through your account.",
            "You may revoke this authorisation at any time by deleting your stored credentials.",
          ],
        },
        {
          kind: "p",
          text: "Using this feature may breach your retailer's own terms of service, which sometimes prohibit automated access. You are responsible for checking that, and we are not liable if a retailer restricts or closes your account as a result.",
        },
      ],
    },
    {
      id: "acceptable-use",
      heading: "9. Acceptable use",
      blocks: [
        { kind: "p", text: "You agree not to:" },
        {
          kind: "ul",
          items: [
            "Use Dietai for any unlawful purpose, or to promote self-harm, disordered eating or dangerously restrictive diets.",
            "Attempt to access another user's account or data.",
            "Reverse engineer, scrape, or place automated load on the service beyond normal use.",
            "Resell, sublicense or white-label the service without our written agreement.",
            "Upload malware, or content that is unlawful, infringing or abusive.",
            "Attempt to manipulate the AI assistant into producing harmful output or into revealing another user's information.",
          ],
        },
        {
          kind: "p",
          text: "We may suspend or close an account that breaches this section. Where the breach is not serious we will warn you first and give you a chance to put it right.",
        },
      ],
    },
    {
      id: "availability",
      heading: "10. Availability",
      blocks: [
        {
          kind: "p",
          text: "We aim to keep Dietai available but do not guarantee uninterrupted service. Maintenance, third-party outages and factors outside our control may cause interruptions. We do not offer a service level agreement on consumer plans.",
        },
      ],
    },
    {
      id: "termination",
      heading: "11. Ending the agreement",
      blocks: [
        {
          kind: "p",
          text: "You may close your account at any time from your settings. We may terminate or suspend your account on reasonable notice, or immediately where you have seriously breached these Terms or where we are legally required to.",
        },
        {
          kind: "p",
          text: "If we terminate without cause, we will refund the unused portion of any prepaid term. On termination your data is deleted as described in the Privacy Policy — export anything you want to keep first.",
        },
      ],
    },
    {
      id: "liability",
      heading: "12. Liability",
      blocks: [
        {
          kind: "p",
          text: "**Nothing in these Terms limits our liability for death or personal injury caused by our negligence, for fraud, or for anything else that cannot lawfully be limited.** If you are a consumer, your mandatory statutory rights are unaffected by this section.",
        },
        {
          kind: "p",
          text: "Subject to that, we are not liable for indirect or consequential loss, loss of profit or data, and our total liability arising from the service in any 12-month period is limited to the amount you paid us in that period.",
        },
        {
          kind: "p",
          text: "The service is otherwise provided on an \"as is\" basis to the extent permitted by law. We do not warrant that nutritional data is accurate or that meal plans are suitable for your individual health circumstances — that is what section 3 is for.",
        },
      ],
    },
    {
      id: "governing-law",
      heading: "13. Governing law and disputes",
      blocks: [
        {
          kind: "p",
          text: `These Terms are governed by the law of ${governingLaw.jurisdiction}, and disputes fall to the courts of ${governingLaw.courts}.`,
        },
        {
          kind: "p",
          text: "If you are a consumer, this choice does not deprive you of the protection of the mandatory law of your own country of residence, and you may also bring proceedings in the courts there.",
        },
        {
          kind: "p",
          text: "EU consumers may also use the European Commission's Online Dispute Resolution platform at [ec.europa.eu/consumers/odr](https://ec.europa.eu/consumers/odr).",
        },
      ],
    },
    {
      id: "changes",
      heading: "14. Changes to these Terms",
      blocks: [
        {
          kind: "p",
          text: `This is version ${documentMeta.terms.version}, effective ${documentMeta.terms.effectiveDate}. We will give you at least 30 days' notice by email or in the app before any material change takes effect. Continuing to use Dietai after that date means you accept the new version; if you do not, you may cancel and we will refund the unused part of your term.`,
        },
      ],
    },
    {
      id: "general",
      heading: "15. General",
      blocks: [
        {
          kind: "p",
          text: "If any provision of these Terms is found unenforceable, the rest remain in force. Our failure to enforce a provision is not a waiver of it. You may not transfer your rights under these Terms without our consent; we may transfer ours to a successor of our business, on notice to you.",
        },
        {
          kind: "p",
          text: `Questions about these Terms: [${legalContact.support}](mailto:${legalContact.support}).`,
        },
      ],
    },
  ],
};
