"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { LinkType } from "./ToolResultLink";
import type { ChatMessageProps, MessageContent } from "./ChatMessage";
import type { StatusState } from "./ChatStatus";

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
}

let messageIdCounter = 0;
const nextId = () => `m-${++messageIdCounter}-${Date.now()}`;

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

export function useChatStream({ locale, translate }: UseChatStreamProps): UseChatStreamResult {
  const [messages, setMessages] = useState<ChatMessageProps[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const callIdToMessageIdRef = useRef<Map<string, string>>(new Map());
  const streamingTextIdRef = useRef<string | null>(null);

  const appendMessage = useCallback((msg: ChatMessageProps) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const updateMessage = useCallback(
    (id: string, updater: (prev: ChatMessageProps) => ChatMessageProps) => {
      setMessages((prev) => prev.map((m) => (m.id === id ? updater(m) : m)));
    },
    []
  );

  const removeMessage = useCallback((id: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

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
              message: translate.status(statusKeyToI18n(event.statusKey)),
            },
          },
        });
        break;
      }
      case "tool.completed": {
        const id = callIdToMessageIdRef.current.get(event.callId);
        if (!id) break;
        const link = event.link;
        updateMessage(id, (prev) => ({
          ...prev,
          content: {
            ...prev.content,
            status: {
              state: "success",
              message: translate.success(),
            },
            link: link ? { type: link.type, href: link.href, label: link.label } : prev.content.link,
          },
        }));
        callIdToMessageIdRef.current.delete(event.callId);
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
              message: translate.status(
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
        const errorText = translate.error(event.reason);
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
            content: { text: errorText },
          });
        }
        break;
      }
      case "confirm.request": {
        streamingTextIdRef.current = null;
        const id = nextId();
        appendMessage({
          id,
          role: "agent",
          content: {
            text: translate.confirmDelete(event.message),
            confirm: {
              onConfirm: async () => {
                removeMessage(id);
                await resolveConfirm(event.callId, event.toolName, true, event.payload);
              },
              onCancel: () => {
                updateMessage(id, (prev) => ({
                  ...prev,
                  content: {
                    text: prev.content.text,
                    status: { state: "success", message: translate.cancelled() },
                  },
                }));
              },
            },
          },
        });
        break;
      }
      case "guardrail.redacted": {
        appendMessage({
          id: nextId(),
          role: "agent",
          content: {
            status: { state: "error", message: translate.guardrailRedacted() },
          },
        });
        break;
      }
      case "cost.cap": {
        streamingTextIdRef.current = null;
        appendMessage({
          id: nextId(),
          role: "agent",
          content: { text: translate.costCapReached(event.resetsOn) },
        });
        break;
      }
      case "finish": {
        streamingTextIdRef.current = null;
        break;
      }
      case "error": {
        streamingTextIdRef.current = null;
        appendMessage({
          id: nextId(),
          role: "agent",
          content: { text: event.message },
        });
        break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = useCallback(
    async (text: string, attachment?: PendingAttachment) => {
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
            ...(attachment && {
              attachments: [{ eventId: attachment.eventId, kind: attachment.kind }],
            }),
          }),
        });
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}));
          appendMessage({
            id: nextId(),
            role: "agent",
            content: {
              text: typeof payload.error === "string" ? payload.error : translate.error("generic"),
            },
          });
          return;
        }
        await consumeStream(res);
      } catch {
        appendMessage({
          id: nextId(),
          role: "agent",
          content: { text: translate.error("generic") },
        });
      } finally {
        setIsStreaming(false);
        streamingTextIdRef.current = null;
      }
    },
    [appendMessage, consumeStream, locale, translate]
  );

  const resolveConfirm = useCallback(
    async (callId: string, toolName: string, accepted: boolean, payload: unknown) => {
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
        if (res.ok) await consumeStream(res);
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
    setMessages([]);
    callIdToMessageIdRef.current.clear();
    streamingTextIdRef.current = null;
    await fetch("/api/chat/conversation", { method: "DELETE" });
  }, []);

  const hydrate = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/conversation");
      if (!res.ok) return;
      const payload = (await res.json()) as {
        messages: Array<{
          kind: "user" | "assistant" | "tool";
          id: string;
          text?: string;
          toolName?: string;
          ok?: boolean;
        }>;
      };
      const hydrated: ChatMessageProps[] = [];
      for (const m of payload.messages) {
        if (m.kind === "user") {
          hydrated.push({
            id: m.id,
            role: "user",
            content: { text: stripAttachmentMarkers(m.text ?? "") },
          });
        } else if (m.kind === "assistant") {
          hydrated.push({ id: m.id, role: "agent", content: { text: m.text ?? "" } });
        } else if (m.kind === "tool") {
          const content: MessageContent = {
            status: {
              state: (m.ok ? "success" : "error") as StatusState,
              message: m.ok ? translate.success() : translate.error("generic"),
            },
          };
          hydrated.push({ id: m.id, role: "agent", content });
        }
      }
      setMessages(hydrated);
    } catch {
      /* swallow — empty state is fine */
    }
  }, [translate]);

  // Hydrate on first mount.
  useEffect(() => {
    hydrate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { messages, isStreaming, send, resolveConfirm, clear, hydrate };
}
