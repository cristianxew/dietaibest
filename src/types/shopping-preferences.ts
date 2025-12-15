import { z } from "zod";

// ============================================================================
// Supported Stores Enum
// ============================================================================

export const supportedStoreEnum = z.enum(["auchan", "frisco", "carrefour"]);

export type SupportedStore = z.infer<typeof supportedStoreEnum>;

export const SUPPORTED_STORE_LIST: SupportedStore[] = [
  "auchan",
  "frisco",
  "carrefour",
];

// ============================================================================
// Delivery Preference Enum
// ============================================================================

export const deliveryPreferenceEnum = z.enum(["delivery", "pickup"]);

export type DeliveryPreference = z.infer<typeof deliveryPreferenceEnum>;

// ============================================================================
// Store Information
// ============================================================================

export interface StoreInfo {
  id: SupportedStore;
  name: string;
  /** Domain patterns for the store */
  domains: string[];
  /** Initial URL for the store */
  startUrl: string;
  /** Country code (ISO 3166-1 alpha-2) */
  country: string;
  /** Whether the store supports substitution suggestions */
  supportsSubstitutions: boolean;
  /** Automation support level */
  automationSupport: "full" | "partial";
}

// ============================================================================
// Shopping Preferences
// ============================================================================

export interface ShoppingPreferences {
  id: string;
  userId: string;
  selectedStore: SupportedStore | null;
  deliveryPreference: DeliveryPreference;
  zipCode: string | null;
  preferOrganic: boolean;
  preferStoreBrand: boolean;
  allowSubstitutions: boolean;
  maxPricePerItem: number | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Validation Schemas
// ============================================================================

// Schema for form validation - matches ShoppingPreferencesFormValues exactly
export const shoppingPreferencesFormSchema = z.object({
  selectedStore: supportedStoreEnum.nullable(),
  deliveryPreference: deliveryPreferenceEnum,
  zipCode: z.string().nullable(),
  preferOrganic: z.boolean(),
  preferStoreBrand: z.boolean(),
  allowSubstitutions: z.boolean(),
  maxPricePerItem: z.number().positive().nullable(),
});

// Form values type for react-hook-form
export type ShoppingPreferencesFormValues = z.infer<typeof shoppingPreferencesFormSchema>;

// Schema for server action validation (more lenient for API input)
export const shoppingPreferencesSchema = z.object({
  selectedStore: supportedStoreEnum.nullable().optional(),
  deliveryPreference: deliveryPreferenceEnum.optional().default("delivery"),
  zipCode: z.string().nullable().optional(),
  preferOrganic: z.boolean().optional().default(false),
  preferStoreBrand: z.boolean().optional().default(false),
  allowSubstitutions: z.boolean().optional().default(true),
  maxPricePerItem: z.number().positive().nullable().optional(),
});

export type ShoppingPreferencesInput = z.infer<typeof shoppingPreferencesSchema>;

// ============================================================================
// Form State
// ============================================================================

export interface ShoppingPreferencesFormState {
  selectedStore: SupportedStore | null;
  deliveryPreference: DeliveryPreference;
  zipCode: string;
  preferOrganic: boolean;
  preferStoreBrand: boolean;
  allowSubstitutions: boolean;
  maxPricePerItem: string; // String for form input, converted to number on submit
}

export const defaultShoppingPreferencesFormState: ShoppingPreferencesFormState = {
  selectedStore: null,
  deliveryPreference: "delivery",
  zipCode: "",
  preferOrganic: false,
  preferStoreBrand: false,
  allowSubstitutions: true,
  maxPricePerItem: "",
};
