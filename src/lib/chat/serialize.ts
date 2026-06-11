import type { ConversationTurnItem } from "./llm-provider";

/**
 * Public-safe summary of the conversation, sent to the client on GET.
 * Strips system internals; collapses streamed assistant text deltas into one
 * message per logical turn (so the UI doesn't render 200 single-character
 * bubbles when re-hydrating).
 */
export type ClientMessage =
  | {
      kind: "user";
      id: string;
      text: string;
    }
  | {
      kind: "assistant";
      id: string;
      text: string;
    }
  | {
      kind: "tool";
      id: string;
      toolName: string;
      ok: boolean;
      link?: { type: "recipe" | "mealplan" | "shoppinglist"; href: string; label: string };
    };

export function summarizeForClient(items: ConversationTurnItem[]): ClientMessage[] {
  const out: ClientMessage[] = [];
  let i = 0;
  let nextId = 1;

  while (i < items.length) {
    const item = items[i];

    if (item.kind === "text" && item.role === "user") {
      out.push({ kind: "user", id: `u-${nextId++}`, text: item.text });
      i++;
      continue;
    }

    if (item.kind === "text" && item.role === "assistant") {
      let combined = item.text;
      let j = i + 1;
      while (j < items.length) {
        const n = items[j];
        if (n.kind === "text" && n.role === "assistant") {
          combined += n.text;
          j++;
        } else break;
      }
      if (combined.trim()) {
        out.push({ kind: "assistant", id: `a-${nextId++}`, text: combined });
      }
      i = j;
      continue;
    }

    if (item.kind === "tool-result") {
      const ok =
        typeof item.result === "object" &&
        item.result !== null &&
        "ok" in item.result &&
        (item.result as { ok: boolean }).ok === true;
      const link = ok ? extractLink(item.result) : undefined;
      out.push({
        kind: "tool",
        id: `t-${nextId++}`,
        toolName: item.toolName,
        ok,
        link,
      });
      i++;
      continue;
    }

    i++;
  }

  return out;
}

/**
 * Reads the `link` the runtime persists on successful tool-results
 * (runtime.ts `runOneTool`). Shape-validated because the column is JSONB —
 * older rows have no link and we never want a malformed one in the client.
 */
function extractLink(
  result: unknown
): Extract<ClientMessage, { kind: "tool" }>["link"] {
  if (typeof result !== "object" || result === null) return undefined;
  const candidate = (result as { link?: unknown }).link;
  if (typeof candidate !== "object" || candidate === null) return undefined;
  const { type, href, label } = candidate as {
    type?: unknown;
    href?: unknown;
    label?: unknown;
  };
  if (
    (type === "recipe" || type === "mealplan" || type === "shoppinglist") &&
    typeof href === "string" &&
    typeof label === "string"
  ) {
    return { type, href, label };
  }
  return undefined;
}
