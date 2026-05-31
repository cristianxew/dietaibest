import type { Entitlements } from "@/lib/entitlements";
import type { PageContext } from "./page-context";

export type Locale = "en" | "es" | "pl";

export interface AgentContext {
  userId: string;
  locale: Locale;
  entitlements: Entitlements;
  conversationId: string;
  /** Where the user is in the app when this turn was sent. */
  page?: PageContext;
}
