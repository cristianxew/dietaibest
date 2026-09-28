/**
 * Formats a Stripe unit amount (minor units, e.g. cents) as a localized
 * currency string. Whole amounts drop the decimals (`$9`, `9 €`); fractional
 * amounts always show two (`$9.99`, `4,50 zł`). `null` (metered or custom
 * prices have no unit amount) renders as an em dash.
 *
 * Pure — safe to use from server and client code.
 */
export function formatPrice(
  unitAmount: number | null,
  currency: string,
  locale: string
): string {
  if (unitAmount == null) return "—";
  const amount = unitAmount / 100;
  const fractionDigits = Number.isInteger(amount) ? 0 : 2;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount);
}
