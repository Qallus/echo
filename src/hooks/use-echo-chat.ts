"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_MODEL, type ModelId, type ModelOption } from "@/lib/ai/models";

export type ChatMessage = { role: "user" | "assistant"; content: string; model?: ModelId };
export type ModelStatus = ModelOption & { available: boolean };

// Streams replies from /api/chat. One hook instance = one conversation.
export function useEchoChat({ recordingId }: { recordingId?: string } = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [model, setModel] = useState<ModelId>(DEFAULT_MODEL);
  const [models, setModels] = useState<ModelStatus[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load which models are configured; default to the first available one.
  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((list: ModelStatus[]) => {
        setModels(list);
        setModel((cur) => (list.find((m) => m.id === cur)?.available ? cur : list.find((m) => m.available)?.id ?? cur));
      })
      .catch(() => {});
  }, []);

  const send = useCallback(async (text: string) => {
    const content = text.trim();
    if (!content || streaming) return;
    setError(null);
    const history: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages([...history, { role: "assistant", content: "", model }]);
    setStreaming(true);

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId: model, recordingId, messages: history.map(({ role, content }) => ({ role, content })) }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let reply = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += decoder.decode(value, { stream: true });
        setMessages((m) => [...m.slice(0, -1), { role: "assistant", content: reply, model }]);
      }
      if (!reply) throw new Error("The model returned no text. Check the server logs.");
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setError((e as Error).message);
        setMessages((m) => (m.at(-1)?.role === "assistant" && !m.at(-1)?.content ? m.slice(0, -1) : m));
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }, [messages, model, recordingId, streaming]);

  const stop = useCallback(() => abortRef.current?.abort(), []);
  const reset = useCallback(() => { stop(); setMessages([]); setError(null); }, [stop]);

  return { messages, send, stop, reset, streaming, error, model, setModel, models };
}
