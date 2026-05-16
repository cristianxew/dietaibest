import type { EntitlementErrorPayload } from "@/lib/entitlement-error";

export type ToolResultLinkPayload = {
  type: "recipe" | "mealplan" | "shoppinglist";
  href: string;
  label: string;
};

export type ToolStatusKey =
  | "tool.invoked"
  | "recipe.searching"
  | "recipe.creating"
  | "recipe.editing"
  | "recipe.deleting"
  | "recipe.analyzing"
  | "recipe.saving"
  | "recipe.loading"
  | "import.fetching"
  | "import.extracting"
  | "import.analyzing"
  | "import.saving"
  | "import.fallback"
  | "media.uploading"
  | "media.extracting"
  | "mealplan.skeleton"
  | "mealplan.fanout"
  | "mealplan.persisting"
  | "mealplan.searching"
  | "mealplan.loading"
  | "mealplan.addingMeal"
  | "mealplan.movingMeal"
  | "mealplan.updatingServings"
  | "mealplan.removingMeal"
  | "mealplan.generating"
  | "mealplan.planning"
  | "mealplan.slot"
  | "mealplan.slotFailed"
  | "mealplan.saving";

export type ToolProgressPayload = {
  slot?: { n: number; m: number };
  failedSlot?: { day: number; meal: string };
};

export type AgentEvent =
  | { type: "text.delta"; text: string }
  | {
      type: "tool.invoked";
      toolName: string;
      callId: string;
      statusKey: ToolStatusKey;
    }
  | {
      type: "tool.completed";
      toolName: string;
      callId: string;
      link?: ToolResultLinkPayload;
    }
  | {
      type: "tool.progress";
      callId: string;
      toolName: string;
      statusKey: ToolStatusKey;
      payload?: ToolProgressPayload;
    }
  | {
      type: "tool.failed";
      toolName: string;
      callId: string;
      reason: "generic" | "quota" | "notFound" | "unauthorized";
      entitlement?: EntitlementErrorPayload;
    }
  | {
      type: "confirm.request";
      callId: string;
      toolName: string;
      message: string;
      payload: unknown;
    }
  | { type: "guardrail.redacted"; reason: "nutrition" | "medical" }
  | { type: "cost.cap"; resetsOn: string }
  | { type: "finish"; usage?: { inputTokens: number; outputTokens: number } }
  | { type: "error"; message: string };
