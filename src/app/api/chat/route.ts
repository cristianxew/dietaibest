import { NextRequest } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";

import { prisma } from "@/lib/prisma";
import {
  assertCanUseAiChat,
  getEntitlements,
} from "@/lib/entitlements";
import { toEntitlementError } from "@/lib/entitlement-error";
import type { AgentContext, Locale } from "@/lib/chat/context";
import { getRuntime } from "@/lib/chat/runtime-instance";
import { resolveActiveConversation } from "@/lib/chat/conversation-prisma";
import {
  CHAT_COST_CAP_USD,
  decideCostCap,
  getMonthlyAiCostUsd,
  isCostCapEnforced,
  nextMonthResetDate,
} from "@/lib/chat/cost-cap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const localeSchema = z.enum(["en", "es", "pl"]);

const requestSchema = z.object({
  message: z.string().max(8000).optional(),
  locale: localeSchema.default("en"),
  resolve: z
    .object({
      callId: z.string().min(1),
      toolName: z.string().min(1),
      accepted: z.boolean(),
      payload: z.unknown(),
    })
    .optional(),
});

function sseEncode(event: unknown): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      plan: true,
      subscriptionStatus: true,
    },
  });
  if (!user) {
    return new Response(JSON.stringify({ error: "User not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    await assertCanUseAiChat(user);
  } catch (err) {
    const payload = toEntitlementError(err);
    if (payload) {
      return new Response(JSON.stringify({ error: payload }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }
    throw err;
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      JSON.stringify({ error: parsed.error.issues[0]?.message ?? "Bad request" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }
  const { message, locale, resolve } = parsed.data;

  if (!message && !resolve) {
    return new Response(JSON.stringify({ error: "Empty message" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const active = await resolveActiveConversation(prisma, user.id);

  const ctx: AgentContext = {
    userId: user.id,
    locale: locale as Locale,
    entitlements: getEntitlements(user),
    conversationId: active.id,
  };

  const runtime = getRuntime();
  const encoder = new TextEncoder();
  const abort = new AbortController();
  req.signal.addEventListener("abort", () => abort.abort());

  // DIE-38 cost cap. Derived per-user-per-month from Message.inputTokens /
  // outputTokens. Shadow mode (flag off) only logs; enforcement (flag on)
  // returns an SSE stream carrying a single cost.cap event so the client
  // renders chat.costCap.reached without invoking the runtime / LLM.
  const monthlyCostUsd = await getMonthlyAiCostUsd(prisma, user.id);
  const capDecision = decideCostCap(
    monthlyCostUsd,
    CHAT_COST_CAP_USD,
    isCostCapEnforced()
  );
  if (capDecision.reached) {
    console.info(
      `[chat:cost-cap] user=${user.id} monthlyCostUsd=${monthlyCostUsd.toFixed(4)} capUsd=${CHAT_COST_CAP_USD} enforced=${isCostCapEnforced()} block=${capDecision.shouldBlock}`
    );
  }
  if (capDecision.shouldBlock) {
    const resetsOn = nextMonthResetDate().toISOString();
    const capStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode(sseEncode({ type: "cost.cap", resetsOn }))
        );
        controller.enqueue(encoder.encode(sseEncode({ type: "finish" })));
        controller.close();
      },
    });
    return new Response(capStream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  }

  const pendingResolve = resolve
    ? {
        callId: resolve.callId,
        toolName: resolve.toolName,
        accepted: resolve.accepted,
        payload: resolve.payload,
      }
    : undefined;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of runtime.run(
          { ctx, userMessage: message, pendingResolve },
          abort.signal
        )) {
          controller.enqueue(encoder.encode(sseEncode(event)));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Stream failed";
        controller.enqueue(
          encoder.encode(sseEncode({ type: "error", message }))
        );
      } finally {
        controller.close();
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
