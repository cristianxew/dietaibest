import type { Entitlements } from "@/lib/entitlements";

export type Locale = "en" | "es" | "pl";

export interface AgentContext {
  userId: string;
  locale: Locale;
  entitlements: Entitlements;
  conversationId: string;
}
