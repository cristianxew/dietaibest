import { randomUUID } from "node:crypto";
import type {
  ConversationTurnItem,
  LlmProvider,
  LlmStreamRequest,
  ProviderStreamEvent,
} from "./llm-provider";

/**
 * Mock LLM provider — pattern-matches the user's latest message against
 * known intents and emits a plausible tool-call + post-tool acknowledgement.
 *
 * Used in development and tests so the full chat pipeline runs end-to-end
 * without an Anthropic API key. The real adapter (e.g. @ai-sdk/anthropic) will
 * implement the same `LlmProvider` interface — swap-in is a one-line change in
 * the route handler.
 */

type Intent =
  | { kind: "create-recipe"; title: string; description?: string }
  | { kind: "search-recipes"; query: string }
  | { kind: "get-nutrition"; ingredients: string[]; servings: number }
  | { kind: "delete-recipe"; query: string }
  | { kind: "medical"; topic: string }
  | { kind: "text" };

const MEDICAL_KEYWORDS =
  /\b(diabetes|allerg|insulin|kidney|liver|pregnan|embaraz|alergi|ri(?:ñ|n)ón|h(i|í)gado|insulin|celia[ck]|gluten[\- ]?free.*advise|cuanto.*az(ú|u)car|how much sugar)\b/i;

function detectIntent(latestUser: string): Intent {
  const text = latestUser.trim();
  const lower = text.toLowerCase();

  const medical = lower.match(MEDICAL_KEYWORDS);
  if (medical) return { kind: "medical", topic: medical[0] };

  // delete: "delete recipe X" / "borra la receta X"
  if (/\b(delete|remove|borr[aá]|elimin[aá]|usu[ńn])\b.*\b(recipe|receta|przepis)\b/i.test(lower)) {
    const after = lower.split(/recipe|receta|przepis/i)[1] ?? "";
    return { kind: "delete-recipe", query: after.trim().replace(/^["']|["']$/g, "") };
  }

  // search: "find" / "search" / "what recipes" / "buscame recetas"
  if (/\b(find|search|show|list|busc(a|á)|encuentr|znajd|poka(ż|z))\b.*\b(recipe|receta|przepis)\b/i.test(lower)) {
    const after = lower.split(/recipe|receta|przepis/i)[1] ?? "";
    return { kind: "search-recipes", query: after.trim() || "" };
  }

  // nutrition: "macros" / "nutrition" / "calories" / "cuántas calorías"
  if (/\b(macros?|nutrition|kcal|cal(o|ó)r(i|í)as|how many calor|cu(á|a)nta(s)? cal)\b/i.test(lower)) {
    const ingredients = extractIngredientList(text);
    if (ingredients.length > 0) {
      return { kind: "get-nutrition", ingredients, servings: 1 };
    }
  }

  // create: "create a recipe" / "I want X" / "quiero un X" / "cocinar"
  if (
    /\b(create|make|cook|i want|i'?d like|quiero|me gustar(í|i)a|cocin|armame|hazme|chc[eę])\b/i.test(lower) ||
    /\brecipe for\b/i.test(lower)
  ) {
    return { kind: "create-recipe", title: extractTitle(text), description: text };
  }

  return { kind: "text" };
}

function extractTitle(text: string): string {
  const m = text.match(/(?:recipe\s+for\s+|recipe:\s*|receta\s+de\s+|cocinar\s+|cook\s+)(.{3,80})/i);
  if (m) return cleanTitle(m[1]);
  return cleanTitle(text.slice(0, 60));
}

function cleanTitle(s: string): string {
  return s.replace(/[.,!?].*$/, "").trim().replace(/\s+/g, " ");
}

function extractIngredientList(text: string): string[] {
  // Naive: split by newlines or commas after a "with"/"con" trigger word.
  const m = text.match(/(?:with|including|con|z|y los siguientes)\s*[:\-]?\s*(.+)$/i);
  if (!m) return [];
  return m[1]
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1)
    .slice(0, 12);
}

function latestUserText(messages: ConversationTurnItem[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.kind === "text" && m.role === "user") return m.text;
  }
  return "";
}

function latestToolResult(
  messages: ConversationTurnItem[],
  toolName: string
): { callId: string; result: unknown } | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.kind === "tool-result" && m.toolName === toolName) {
      return { callId: m.callId, result: m.result };
    }
  }
  return null;
}

async function* streamText(text: string, chunkSize = 12): AsyncIterable<ProviderStreamEvent> {
  for (let i = 0; i < text.length; i += chunkSize) {
    yield { kind: "text-delta", text: text.slice(i, i + chunkSize) };
    // Yield to the event loop so the consumer sees progressive deltas.
    await new Promise((r) => setTimeout(r, 8));
  }
}

function makeMockRecipe(title: string, description?: string) {
  return {
    title: title || "Untitled recipe",
    description: description?.slice(0, 200),
    servings: 2,
    ingredients: [
      { name: "olive oil", amount: 2, unit: "tbsp" },
      { name: "garlic", amount: 2, unit: "clove" },
      { name: "onion", amount: 1, unit: "piece" },
      { name: "tomato", amount: 4, unit: "piece" },
      { name: "salt", amount: 1, unit: "tsp" },
    ],
    instructions: [
      "Heat the olive oil in a large pan over medium heat.",
      "Add the chopped onion and garlic and cook until soft, about 4 minutes.",
      "Add the tomatoes and season with salt. Simmer for 12 minutes.",
      "Adjust seasoning to taste and serve.",
    ],
  };
}

export class MockLlmProvider implements LlmProvider {
  async *stream(request: LlmStreamRequest): AsyncIterable<ProviderStreamEvent> {
    const { messages, tools } = request;
    const toolNames = new Set(tools.map((t) => t.name));
    const intent = detectIntent(latestUserText(messages));

    // Check whether the previous turn item is a tool result we've been waiting
    // for — if so, this is a post-tool turn; emit an acknowledgement.
    const last = messages[messages.length - 1];
    if (last?.kind === "tool-result") {
      const r = last.result as { ok?: boolean } | null;
      const ack = r?.ok
        ? "Done. You can open it from the link above."
        : "I couldn't complete that. Try again in a minute.";
      yield* streamText(ack);
      yield { kind: "finish" };
      return;
    }

    if (intent.kind === "medical") {
      yield* streamText(
        `I can't give you medical advice. For matters about ${intent.topic}, consult with a healthcare professional. I'm here for cooking, recipes, and meal plans whenever you want.`
      );
      yield { kind: "finish" };
      return;
    }

    if (intent.kind === "create-recipe" && toolNames.has("createRecipe")) {
      yield* streamText(`On it — building a recipe for ${intent.title}…`);
      yield {
        kind: "tool-call",
        callId: randomUUID(),
        toolName: "createRecipe",
        input: makeMockRecipe(intent.title, intent.description),
      };
      return;
    }

    if (intent.kind === "search-recipes" && toolNames.has("searchRecipes")) {
      yield {
        kind: "tool-call",
        callId: randomUUID(),
        toolName: "searchRecipes",
        input: { query: intent.query || undefined, limit: 8 },
      };
      return;
    }

    if (intent.kind === "delete-recipe" && toolNames.has("deleteRecipe")) {
      // For the mock, we need an id. If we already have a searchRecipes result
      // in the conversation, pick the first match; otherwise, ask the user.
      const search = latestToolResult(messages, "searchRecipes");
      const id =
        search &&
        typeof search.result === "object" &&
        search.result !== null &&
        "data" in search.result
          ? (search.result as { data: { recipes: Array<{ id: string }> } }).data
              .recipes[0]?.id
          : undefined;
      if (id) {
        yield {
          kind: "tool-call",
          callId: randomUUID(),
          toolName: "deleteRecipe",
          input: { id },
        };
        return;
      }
      // No id — fall through to searchRecipes first.
      if (toolNames.has("searchRecipes")) {
        yield {
          kind: "tool-call",
          callId: randomUUID(),
          toolName: "searchRecipes",
          input: { query: intent.query || undefined, limit: 5 },
        };
        return;
      }
    }

    if (intent.kind === "get-nutrition" && toolNames.has("getNutrition")) {
      yield {
        kind: "tool-call",
        callId: randomUUID(),
        toolName: "getNutrition",
        input: { ingredients: intent.ingredients, servings: intent.servings },
      };
      return;
    }

    // Default — friendly default response.
    yield* streamText(
      "I can create recipes, search your library, edit or delete recipes, and calculate macros from USDA data. What would you like to do?"
    );
    yield { kind: "finish" };
  }
}
