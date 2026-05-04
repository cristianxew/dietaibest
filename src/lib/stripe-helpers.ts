export type BillingInterval = "monthly" | "yearly";
export type SupportedCurrency = "usd" | "eur" | "pln";
export type StripeCheckoutLocale = "en" | "es" | "pl" | "auto";

export function currencyForLocale(locale: string): SupportedCurrency {
  switch (locale) {
    case "pl":
      return "pln";
    case "es":
      return "eur";
    case "en":
    default:
      return "usd";
  }
}

export function proPriceLookupKey(
  interval: BillingInterval,
  currency: SupportedCurrency
): string {
  return `pro_${interval}_${currency}`;
}

export function stripeLocaleForNextLocale(locale: string): StripeCheckoutLocale {
  switch (locale) {
    case "en":
    case "es":
    case "pl":
      return locale;
    default:
      return "auto";
  }
}
