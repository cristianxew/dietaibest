import type { z, ZodTypeAny } from "zod";
import type { FeatureKey } from "@/lib/entitlements";
import type { AgentContext } from "../context";
import type { ToolProgressPayload, ToolResultLinkPayload, ToolStatusKey } from "../events";

export type ToolEmit = (event: {
  statusKey: ToolStatusKey;
  payload?: ToolProgressPayload;
}) => void;

export type ToolResult<TData = unknown> =
  | { ok: true; data: TData; link?: ToolResultLinkPayload }
  | {
      ok: false;
      reason: "generic" | "quota" | "notFound" | "unauthorized";
      message: string;
    };

export type ConfirmDescriptor = {
  message: string;
  payload: unknown;
};

export interface Tool<TSchema extends ZodTypeAny = ZodTypeAny, TData = unknown> {
  name: string;
  description: string;
  inputSchema: TSchema;
  statusKey: ToolStatusKey;
  /**
   * If set, the agent must request user confirmation before calling execute.
   * Returns the i18n-resolved message and payload to send back unchanged.
   */
  requiresConfirmation?: (
    input: z.infer<TSchema>,
    ctx: AgentContext
  ) => Promise<ConfirmDescriptor | null>;
  /**
   * Pro-only feature key. When set, the tool is filtered out at turn entry
   * for users without that entitlement. Dispatcher also re-checks defensively.
   */
  requiresFeature?: FeatureKey;
  execute: (input: z.infer<TSchema>, ctx: AgentContext, emit?: ToolEmit) => Promise<ToolResult<TData>>;
}

/**
 * Existential erasure of Tool — the registry stores heterogeneous tools as a
 * collection; TypeScript variance rules prevent inferring a single
 * Tool<TSchema, TData> shape across an array literal, so the registry erases
 * the type parameters at the boundary. Internal call sites parse the input
 * through Zod which restores runtime-checked types.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyTool = Tool<any, any>;

/**
 * Thrown from a tool's `requiresConfirmation` to fail the preview phase cleanly.
 * The runtime catches it at the confirmation gate and emits `tool.failed` with
 * this reason — without this, a throw there would error the whole turn.
 */
export class ToolFailure extends Error {
  readonly reason: "generic" | "quota" | "notFound" | "unauthorized";
  constructor(
    reason: ToolFailure["reason"],
    message: string
  ) {
    super(message);
    this.name = "ToolFailure";
    this.reason = reason;
  }
}
