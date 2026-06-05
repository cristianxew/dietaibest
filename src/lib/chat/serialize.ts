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
      const link =
        ok &&
        typeof item.result === "object" &&
        item.result !== null &&
        "data" in item.result &&
        typeof (item.result as { data?: unknown }).data === "object"
          ? // The link travels separately in AgentEvent; from persisted state
            // we only know there was a successful tool, not its link. The
            // current UI is fine with this since the link affordance is shown
            // live during the streaming turn.
            undefined
          : undefined;
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
