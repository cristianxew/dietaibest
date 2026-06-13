"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import type { LinkType } from "./ToolResultLink";
import type { ChatMessageProps, MessageContent } from "./ChatMessage";
import type { StatusState } from "./ChatStatus";
import type { RecipePreview } from "./RecipePreviewCard";
import { computeFollowUps, type Capability } from "@/lib/chat/capabilities";

/**
 * AgentEvent shape — must match src/lib/chat/events.ts. Duplicated here to
 * keep the client component free of server-only imports.
 */
type AgentEvent =
  | { type: "text.delta"; text: string }
  | { type: "tool.invoked"; toolName: string; callId: string; statusKey: string }
  | {
      type: "tool.completed";
      toolName: string;
      callId: string;
      link?: { type: LinkType; href: string; label: string };
    }
  | {
      type: "tool.progress";
      callId: string;
      toolName: string;
      statusKey: string;
      payload?: {
        slot?: { n: number; m: number };
        failedSlot?: { day: number; meal: string };
      };
    }
  | {
      type: "tool.failed";
      toolName: string;
      callId: string;
      reason: "generic" | "quota" | "notFound" | "unauthorized";
    }
  | {
      type: "confirm.request";
      callId: string;
      toolName: string;
      message: string;
      payload: unknown;
      /** Gated tool's status key — used to restore the pending status on the
       *  reused bubble after the user accepts. Optional for older streams. */
      statusKey?: string;
    }
  | { type: "guardrail.redacted"; reason: "nutrition" }
  | { type: "cost.cap"; resetsOn: string }
  | { type: "finish" }
  | { type: "error"; message: string };

interface UseChatStreamProps {
  locale: string;
  translate: {
    status: (key: string, params?: Record<string, string | number>) => string;
    confirmDelete: (name: string) => string;
    confirmGenerateImage: (name: string) => string;
    generateImageYes: () => string;
    generateImageNo: () => string;
    generateImageSkipped: () => string;
    error: (reason: "generic" | "quota" | "notFound" | "unauthorized") => string;
    guardrailRedacted: () => string;
    success: () => string;
    deleted: () => string;
    cancelled: () => string;
    costCapReached: (resetsOn: string) => string;
  };
}

/** DIE-41 — single image attachment that the chat composer uploaded and is
 * about to attach to the next user message. */
export interface PendingAttachment {
  eventId: string;
  kind: "image";
  /** Local blob URL for in-session rendering. Won't survive page reload. */
  previewUrl: string;
  /** Original file name for the user-message bubble. */
  name: string;
}

interface UseChatStreamResult {
  messages: ChatMessageProps[];
  isStreaming: boolean;
  send: (text: string, attachment?: PendingAttachment) => Promise<void>;
  resolveConfirm: (
    callId: string,
    toolName: string,
    accepted: boolean,
    payload: unknown
  ) => Promise<void>;
  clear: () => Promise<void>;
  hydrate: () => Promise<void>;
  retry: () => Promise<void>;
  canRetry: boolean;
  /** Delete the last turn server-side + locally. Returns the user text of that
   *  turn (for "edit & resend" the caller refills the composer with it). */
  deleteLastTurn: () => Promise<string | null>;
  switchSession: (sessionId: string) => Promise<void>;
  createSession: () => Promise<void>;
  /** Deterministic follow-up suggestions for the just-finished turn. */
  followUps: Capability[];
}

let messageIdCounter = 0;
const nextId = () => `m-${++messageIdCounter}-${Date.now()}`;

/**
 * Tools whose successful completion should auto-navigate the browser to the
 * created recipe. Whitelisted by tool name on purpose: editRecipe, getRecipe
 * and generateRecipeImage also emit `link.type === "recipe"` but must NOT
 * navigate — and generateRecipeImage runs in the same turn right after a
 * create, so filtering by link type alone would be wrong.
 */
const AUTO_NAV_TOOLS = new Set([
  "createRecipe",
  "importRecipeFromUrl",
  "importRecipeFromImage",
]);

/** Short "10:23 AM"-style label for live messages. */
const timeLabel = (locale: string): string => {
  try {
    return new Date().toLocaleTimeString(locale, {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return new Date().toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  }
};

function statusKeyToI18n(key: string): string {
  // "recipe.creating" → "chat.status.recipe.creating"
  return `chat.status.${key}`;
}

// DIE-41 — strip [attachment kind=... eventId=...] markers from persisted
// user-message text before rendering. The markers are injected by the chat
// route for the LLM's benefit; users should never see them in the UI.
const ATTACHMENT_MARKER_RE = /\s*\[attachment[^\]]+\]\s*/g;

function stripAttachmentMarkers(text: string): string {
  return text.replace(ATTACHMENT_MARKER_RE, " ").trim();
}

type RawMessage = {
  role?: string;
  kind?: string;
  id: string;
  text?: string;
  toolName?: string;
  ok?: boolean;
  link?: { type: LinkType; href: string; label: string };
};

function hydrateMessages(
  msgs: RawMessage[],
  translate: UseChatStreamProps["translate"]
): ChatMessageProps[] {
  const hydrated: ChatMessageProps[] = [];
  for (const m of msgs) {
    const kind = (m as { kind?: string }).kind ?? m.role;
    if (kind === "user") {
      hydrated.push({
        id: m.id,
        role: "user",
        content: { text: stripAttachmentMarkers(m.text ?? "") },
      });
    } else if (kind === "assistant") {
      hydrated.push({ id: m.id, role: "agent", content: { text: m.text ?? "" } });
    } else if (kind === "tool") {
      const content: MessageContent = {
        status: {
          state: (m.ok ? "success" : "error") as StatusState,
          message: m.ok ? translate.success() : translate.error("generic"),
        },
        ...(m.link && { link: { type: m.link.type, href: m.link.href, label: m.link.label } }),
      };
      hydrated.push({ id: m.id, role: "agent", content });
    }
  }
  return hydrated;
}

export function useChatStream({ locale, translate }: UseChatStreamProps): UseChatStreamResult {
  const [messages, setMessages] = useState<ChatMessageProps[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  // Tool names completed during the in-flight turn; mapped through the
  // capability catalog on `finish` to surface follow-up chips.
  const completedToolsThisTurnRef = useRef<string[]>([]);
  const [followUps, setFollowUps] = useState<Capability[]>([]);
  const callIdToMessageIdRef = useRef<Map<string, string>>(new Map());
  const streamingTextIdRef = useRef<string | null>(null);
  // handleEvent is a stable callback with no deps — read locale and translate
  // through refs so a locale switch mid-session doesn't pin stale strings.
  const localeRef = useRef(locale);
  localeRef.current = locale;
  const translateRef = useRef(translate);
  translateRef.current = translate;

  // Auto-navigation after recipe create/import. handleEvent captures the
  // recipe href on tool.completed and consumes it on `finish` — both read
  // the router through a ref since handleEvent has no deps.
  const router = useRouter();
  const routerRef = useRef(router);
  routerRef.current = router;
  const pendingNavHrefRef = useRef<string | null>(null);

  // Current page path, sent with each message so the agent knows where the
  // user is. Read through a ref so `send` doesn't rebuild on navigation.
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  // For retry
  const lastUserInputRef = useRef<{ text: string; attachment?: PendingAttachment } | null>(null);
  const messagesBeforeLastSendRef = useRef<number>(0);
  const [hasLastInput, setHasLastInput] = useState(false);

  const appendMessage = useCallback((msg: ChatMessageProps) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const updateMessage = useCallback(
    (id: string, updater: (prev: ChatMessageProps) => ChatMessageProps) => {
      setMessages((prev) => prev.map((m) => (m.id === id ? updater(m) : m)));
    },
    []
  );

  const consumeStream = useCallback(
    async (response: Response) => {
      const reader = response.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const raw = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          if (!raw.startsWith("data: ")) continue;
          const jsonStr = raw.slice("data: ".length);
          let event: AgentEvent;
          try {
            event = JSON.parse(jsonStr);
          } catch {
            continue;
          }
          handleEvent(event);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const handleEvent = useCallback((event: AgentEvent) => {
    switch (event.type) {
      case "text.delta": {
        if (!streamingTextIdRef.current) {
          const id = nextId();
          streamingTextIdRef.current = id;
          appendMessage({
            id,
            role: "agent",
            timestamp: timeLabel(localeRef.current),
            content: { text: event.text },
          });
        } else {
          updateMessage(streamingTextIdRef.current, (prev) => ({
            ...prev,
            content: { ...prev.content, text: (prev.content.text ?? "") + event.text },
          }));
        }
        break;
      }
      case "tool.invoked": {
        streamingTextIdRef.current = null;
        const id = nextId();
        callIdToMessageIdRef.current.set(event.callId, id);
        appendMessage({
          id,
          role: "agent",
          content: {
            status: {
              state: "pending",
              message: translateRef.current.status(statusKeyToI18n(event.statusKey)),
            },
          },
        });
        break;
      }
      case "tool.completed": {
        completedToolsThisTurnRef.current.push(event.toolName);
        const id = callIdToMessageIdRef.current.get(event.callId);
        if (!id) break;
        const link = event.link;
        updateMessage(id, (prev) => ({
          ...prev,
          content: {
            ...prev.content,
            status: {
              state: "success",
              message: translateRef.current.success(),
            },
            link: link ? { type: link.type, href: link.href, label: link.label } : prev.content.link,
          },
        }));
        callIdToMessageIdRef.current.delete(event.callId);
        if (AUTO_NAV_TOOLS.has(event.toolName) && link?.href) {
          pendingNavHrefRef.current = link.href;
        }
        break;
      }
      case "tool.progress": {
        const id = callIdToMessageIdRef.current.get(event.callId);
        if (!id) break;
        // Build interpolation params from optional payload
        const params: Record<string, string | number> = {};
        if (event.payload?.slot) {
          params.n = event.payload.slot.n;
          params.m = event.payload.slot.m;
        }
        if (event.payload?.failedSlot) {
          params.day = event.payload.failedSlot.day;
          params.meal = event.payload.failedSlot.meal;
        }
        updateMessage(id, (prev) => ({
          ...prev,
          content: {
            ...prev.content,
            status: {
              state: "pending",
              message: translateRef.current.status(
                statusKeyToI18n(event.statusKey),
                Object.keys(params).length > 0 ? params : undefined
              ),
            },
          },
        }));
        break;
      }
      case "tool.failed": {
        const id = callIdToMessageIdRef.current.get(event.callId);
        const errorText = translateRef.current.error(event.reason);
        if (id) {
          updateMessage(id, (prev) => ({
            ...prev,
            content: {
              ...prev.content,
              status: {
                state: "error",
                message: errorText,
              },
            },
          }));
          callIdToMessageIdRef.current.delete(event.callId);
        } else {
          appendMessage({
            id: nextId(),
            role: "agent",
            error: true,
            timestamp: timeLabel(localeRef.current),
            content: { text: errorText },
          });
        }
        break;
      }
      case "confirm.request": {
        streamingTextIdRef.current = null;

        // Recipe import preview: render the rich read-only card. Reuse the
        // tool.invoked bubble for this callId so the resume turn's
        // tool.completed updates the same message (and auto-nav fires).
        if (event.toolName === "importRecipeFromUrl") {
          const payload = event.payload as { recipe?: RecipePreview } | null;
          const recipe = payload?.recipe;
          if (recipe) {
            const existingId = callIdToMessageIdRef.current.get(event.callId);
            const targetId = existingId ?? nextId();
            const previewContent = {
              recipePreview: {
                recipe,
                onSave: async () => {
                  updateMessage(targetId, (prev) => ({
                    ...prev,
                    content: {
                      status: {
                        state: "pending" as StatusState,
                        message: translateRef.current.status(statusKeyToI18n("import.saving")),
                      },
                    },
                  }));
                  await resolveConfirm(event.callId, event.toolName, true, event.payload);
                },
                onCancel: async () => {
                  updateMessage(targetId, (prev) => ({
                    ...prev,
                    content: {
                      status: {
                        state: "success" as StatusState,
                        message: translateRef.current.cancelled(),
                      },
                    },
                  }));
                  await resolveConfirm(event.callId, event.toolName, false, event.payload);
                },
              },
            };
            if (existingId) {
              updateMessage(targetId, (prev) => ({ ...prev, content: previewContent }));
            } else {
              callIdToMessageIdRef.current.set(event.callId, targetId);
              appendMessage({ id: targetId, role: "agent", content: previewContent });
            }
            break;
          }
        }

        // Reuse the tool.invoked bubble for this callId. Without this, the
        // pending spinner ("Generando imagen culinaria…") keeps spinning next
        // to the confirmation prompt the whole time the user is deciding —
        // and forever if they decline.
        const existingId = callIdToMessageIdRef.current.get(event.callId);
        const id = existingId ?? nextId();
        const isGenerateImage = event.toolName === "generateRecipeImage";
        const confirmContent: MessageContent = {
          text: isGenerateImage
            ? translateRef.current.confirmGenerateImage(event.message)
            : translateRef.current.confirmDelete(event.message),
          confirm: {
            confirmText: isGenerateImage ? translateRef.current.generateImageYes() : undefined,
            cancelText: isGenerateImage ? translateRef.current.generateImageNo() : undefined,
            variant: isGenerateImage ? "primary" : "destructive",
            onConfirm: async () => {
              // Now the work actually starts — show the in-progress status on
              // the same bubble; the resume turn's tool.progress / completed /
              // failed events update it through the callId mapping.
              updateMessage(id, (prev) => ({
                ...prev,
                content: {
                  status: {
                    state: "pending",
                    message: translateRef.current.status(
                      statusKeyToI18n(event.statusKey ?? "tool.invoked")
                    ),
                  },
                },
              }));
              await resolveConfirm(event.callId, event.toolName, true, event.payload);
            },
            onCancel: async () => {
              // Declined: no further events will arrive for this callId.
              callIdToMessageIdRef.current.delete(event.callId);
              updateMessage(id, (prev) => ({
                ...prev,
                content: {
                  status: {
                    state: "success",
                    message: isGenerateImage
                      ? translateRef.current.generateImageSkipped()
                      : translateRef.current.cancelled(),
                  },
                },
              }));
              await resolveConfirm(event.callId, event.toolName, false, event.payload);
            },
          },
        };
        if (existingId) {
          updateMessage(id, (prev) => ({ ...prev, content: confirmContent }));
        } else {
          callIdToMessageIdRef.current.set(event.callId, id);
          appendMessage({ id, role: "agent", content: confirmContent });
        }
        break;
      }
      case "guardrail.redacted": {
        appendMessage({
          id: nextId(),
          role: "agent",
          content: {
            status: { state: "error", message: translateRef.current.guardrailRedacted() },
          },
        });
        break;
      }
      case "cost.cap": {
        streamingTextIdRef.current = null;
        appendMessage({
          id: nextId(),
          role: "agent",
          content: { text: translateRef.current.costCapReached(event.resetsOn) },
        });
        break;
      }
      case "finish": {
        streamingTextIdRef.current = null;
        setFollowUps(computeFollowUps(completedToolsThisTurnRef.current));
        completedToolsThisTurnRef.current = [];
        const href = pendingNavHrefRef.current;
        pendingNavHrefRef.current = null;
        if (href) routerRef.current.push(href);
        break;
      }
      case "error": {
        streamingTextIdRef.current = null;
        // event.message carries raw provider/internal detail ("overloaded_error",
        // "Cancelled") — keep it out of the UI, surface a translated error.
        console.warn("[chat] stream error:", event.message);
        appendMessage({
          id: nextId(),
          role: "agent",
          error: true,
          timestamp: timeLabel(localeRef.current),
          content: { text: translateRef.current.error("generic") },
        });
        break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = useCallback(
    async (text: string, attachment?: PendingAttachment) => {
      pendingNavHrefRef.current = null;
      completedToolsThisTurnRef.current = [];
      setFollowUps([]);
      messagesBeforeLastSendRef.current = messages.length;
      lastUserInputRef.current = { text, attachment };
      setHasLastInput(true);
      const userMsgId = nextId();
      const deleteAttachmentBlob = attachment
        ? async () => {
            try {
              await fetch(`/api/chat/attachment/${attachment.eventId}`, {
                method: "DELETE",
              });
            } catch {
              /* swallow — UI removes preview optimistically below */
            }
            updateMessage(userMsgId, (prev) => ({
              ...prev,
              content: { ...prev.content, attachment: undefined },
            }));
          }
        : undefined;
      const userMsg: ChatMessageProps = {
        id: userMsgId,
        role: "user",
        timestamp: timeLabel(locale),
        content: {
          text,
          ...(attachment && {
            attachment: {
              url: attachment.previewUrl,
              name: attachment.name,
              onDelete: deleteAttachmentBlob,
            },
          }),
        },
      };
      appendMessage(userMsg);
      setIsStreaming(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            locale,
            pagePath: pathnameRef.current,
            ...(attachment && {
              attachments: [{ eventId: attachment.eventId, kind: attachment.kind }],
            }),
          }),
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          // Server validation strings are developer-facing English (Zod,
          // "Unauthorized", …) — log them, but show the user a translated error.
          if (payload?.error) console.warn("[chat] send rejected:", payload.error);
          updateMessage(userMsgId, (prev) => ({ ...prev, failed: true }));
          appendMessage({
            id: nextId(),
            role: "agent",
            error: true,
            timestamp: timeLabel(locale),
            content: { text: translate.error("generic") },
          });
          return;
        }
        await consumeStream(res);
      } catch {
        updateMessage(userMsgId, (prev) => ({ ...prev, failed: true }));
        appendMessage({
          id: nextId(),
          role: "agent",
          error: true,
          timestamp: timeLabel(locale),
          content: { text: translate.error("generic") },
        });
      } finally {
        setIsStreaming(false);
        streamingTextIdRef.current = null;
      }
    },
    [appendMessage, consumeStream, locale, messages, translate, updateMessage]
  );

  const resolveConfirm = useCallback(
    async (callId: string, toolName: string, accepted: boolean, payload: unknown) => {
      pendingNavHrefRef.current = null;
      completedToolsThisTurnRef.current = [];
      setFollowUps([]);
      setIsStreaming(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            locale,
            resolve: { callId, toolName, accepted, payload },
          }),
        });
        if (res.ok) {
          await consumeStream(res);
        } else {
          // Without feedback the confirm click silently vanishes and the
          // pending tool-call is left dangling in the conversation.
          const payload = await res.json().catch(() => ({}));
          if (payload?.error) console.warn("[chat] resolve rejected:", payload.error);
          appendMessage({
            id: nextId(),
            role: "agent",
            error: true,
            timestamp: timeLabel(locale),
            content: { text: translate.error("generic") },
          });
        }
      } catch {
        appendMessage({
          id: nextId(),
          role: "agent",
          content: { text: translate.error("generic") },
        });
      } finally {
        setIsStreaming(false);
      }
    },
    [appendMessage, consumeStream, locale, translate]
  );

  const clear = useCallback(async () => {
    // Mid-stream this would archive the conversation the runtime is still
    // writing to, while the live stream keeps painting into the emptied view.
    if (isStreaming) return;
    setMessages([]);
    setFollowUps([]);
    callIdToMessageIdRef.current.clear();
    streamingTextIdRef.current = null;
    lastUserInputRef.current = null;
    setHasLastInput(false);
    await fetch("/api/chat/conversation", { method: "DELETE" });
  }, [isStreaming]);

  const hydrate = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/conversation");
      if (!res.ok) return;
      const payload = (await res.json()) as { messages: RawMessage[] };
      setMessages(hydrateMessages(payload.messages, translate));
    } catch {
      /* swallow — empty state is fine */
    }
  }, [translate]);

  const retry = useCallback(async () => {
    if (!lastUserInputRef.current || isStreaming) return;
    const input = lastUserInputRef.current;
    const targetLength = messagesBeforeLastSendRef.current;

    // Delete last turn from DB
    const res = await fetch("/api/chat/conversation/last-turn", { method: "DELETE" });
    if (!res.ok) return;

    // Update ref BEFORE send so send uses the correct snapshot
    messagesBeforeLastSendRef.current = targetLength;
    setMessages((prev) => prev.slice(0, targetLength));
    callIdToMessageIdRef.current.clear();
    streamingTextIdRef.current = null;

    // Re-send
    await send(input.text, input.attachment);
  }, [isStreaming, send]);

  const deleteLastTurn = useCallback(async (): Promise<string | null> => {
    if (!lastUserInputRef.current || isStreaming) return null;
    const text = lastUserInputRef.current.text;
    const targetLength = messagesBeforeLastSendRef.current;

    const res = await fetch("/api/chat/conversation/last-turn", { method: "DELETE" });
    if (!res.ok) return null;

    setMessages((prev) => prev.slice(0, targetLength));
    setFollowUps([]);
    callIdToMessageIdRef.current.clear();
    streamingTextIdRef.current = null;
    lastUserInputRef.current = null;
    setHasLastInput(false);
    return text;
  }, [isStreaming]);

  const switchSession = useCallback(async (sessionId: string) => {
    // Mid-stream this re-activates another conversation server-side while the
    // runtime is still persisting into the current one, and the live stream
    // would keep painting into the newly loaded thread.
    if (isStreaming) return;
    // Clear local state
    setMessages([]);
    setFollowUps([]);
    callIdToMessageIdRef.current.clear();
    streamingTextIdRef.current = null;
    lastUserInputRef.current = null;
    setHasLastInput(false);

    // Activate session on server + get its messages in one round-trip
    const res = await fetch(`/api/chat/sessions/${sessionId}`, { method: "PUT" });
    if (!res.ok) return;
    const payload = await res.json() as { ok: boolean; messages: RawMessage[] };
    setMessages(hydrateMessages(payload.messages, translate));
  }, [isStreaming, translate]);

  const createSession = useCallback(async () => {
    // Same hazard as switchSession: archiving the active conversation while a
    // turn is streaming into it strands the turn in the archived session.
    if (isStreaming) return;
    setMessages([]);
    setFollowUps([]);
    callIdToMessageIdRef.current.clear();
    streamingTextIdRef.current = null;
    lastUserInputRef.current = null;
    setHasLastInput(false);
    await fetch("/api/chat/sessions", { method: "POST" });
  }, [isStreaming]);

  // Hydrate on first mount.
  useEffect(() => {
    hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    messages,
    isStreaming,
    send,
    resolveConfirm,
    clear,
    hydrate,
    retry,
    canRetry: hasLastInput && !isStreaming,
    deleteLastTurn,
    switchSession,
    createSession,
    followUps,
  };
}
