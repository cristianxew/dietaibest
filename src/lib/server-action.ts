import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";
import { ZodError, type ZodSchema } from "zod";

import prisma from "@/lib/prisma";
import type { User } from "@/generated/prisma";
import {
  toEntitlementError,
  type EntitlementErrorPayload,
} from "@/lib/entitlement-error";

export interface ActionContext {
  user: User;
}

export type ActionResult<T> =
  | { data: T; error: null }
  | { data: null; error: string | EntitlementErrorPayload };

export interface ActionConfig<TInput, TOutput> {
  /** Optional Zod schema. Runtime parses raw input through it before calling body. */
  input?: ZodSchema<TInput>;
  /**
   * Entitlement assertions. Receives validated input + ctx so parameterized
   * quotas like assertCanCreateMealPlanTemplate(user, duration) are expressible.
   * Throws → runtime maps to ActionResult.
   */
  requires?: (input: TInput, ctx: ActionContext) => Promise<void>;
  /**
   * Cache paths to revalidate after a successful body. Either a static array
   * of paths, or a function of the body result for dynamic paths like
   * `/meal-plans/${id}`. Only called when the body returns successfully.
   */
  revalidates?: string[] | ((result: TOutput) => string[]);
}

export function serverAction<TInput, TOutput>(
  config: ActionConfig<TInput, TOutput>,
  body: (ctx: ActionContext, input: TInput) => Promise<TOutput>
): (rawInput: TInput) => Promise<ActionResult<TOutput>> {
  return async (rawInput: TInput): Promise<ActionResult<TOutput>> => {
    try {
      const session = await getServerSession();
      const email = session?.user?.email;
      if (!email) {
        throw new Error("Unauthorized");
      }
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user) {
        throw new Error("User not found");
      }
      const ctx: ActionContext = { user };
      const input = config.input ? config.input.parse(rawInput) : rawInput;
      if (config.requires) {
        await config.requires(input, ctx);
      }
      const result = await body(ctx, input);
      if (config.revalidates) {
        const paths =
          typeof config.revalidates === "function"
            ? config.revalidates(result)
            : config.revalidates;
        for (const path of paths) {
          revalidatePath(path);
        }
      }
      return { data: result, error: null };
    } catch (error) {
      const entError = toEntitlementError(error);
      if (entError) {
        return { data: null, error: entError };
      }
      if (error instanceof ZodError) {
        const first = error.issues[0]?.message ?? "validation failed";
        return { data: null, error: `Invalid input: ${first}` };
      }
      console.error("[serverAction]", error);
      const message = error instanceof Error ? error.message : "Action failed";
      return { data: null, error: message };
    }
  };
}
