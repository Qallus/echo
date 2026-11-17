"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatError, Composer, MessageList } from "@/components/chat/chat-parts";
import { useEchoChat } from "@/hooks/use-echo-chat";

const SUGGESTIONS = ["What did I commit to this week?", "Summarize my calls from the last 3 days", "Which recordings mention MJG?"];

// Library-wide chat: the "What's on your mind?" page.
export function AskHome({ initial }: { initial?: string }) {
  const chat = useEchoChat();
  const router = useRouter();
  // A question typed in the top-bar search (/ask?q=…) is sent once.
  const asked = useRef(false);
  useEffect(() => {
    if (!initial || asked.current) return;
    asked.current = true;
    chat.send(initial);
    router.replace("/ask");
  }, [initial, chat, router]);
  const empty = !chat.messages.length;

  const composer = (
    <Composer
      onSend={chat.send} onStop={chat.stop} streaming={chat.streaming} rows={empty ? 3 : 2}
      placeholder="Ask Echo about your recordings, notes, or anything else"
      model={chat.model} onModelChange={chat.setModel} models={chat.models}
    />
  );

  if (empty) {
    return (
      <div className="mx-auto flex min-h-[80svh] w-full max-w-4xl flex-col justify-center gap-6 px-4 sm:px-6 lg:px-8">
        <h1 className="text-center text-3xl font-semibold tracking-tight">What&apos;s on your mind?</h1>
        {composer}
        <div className="flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((s) => (
            <button key={s} onClick={() => chat.send(s)} className="rounded-full border px-3 py-1.5 text-sm hover:bg-muted">{s}</button>
          ))}
        </div>
        <ChatError error={chat.error} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-[calc(100svh-3rem)] w-full max-w-5xl flex-col px-4 sm:px-6 lg:px-8 md:h-svh">
      <div className="flex justify-end py-3">
        <Button variant="ghost" size="sm" onClick={chat.reset}><RotateCcw /> New chat</Button>
      </div>
      <div className="flex-1 overflow-y-auto pb-6">
        <MessageList messages={chat.messages} streaming={chat.streaming} models={chat.models} />
        <div className="mt-4"><ChatError error={chat.error} /></div>
      </div>
      <div className="pb-6">{composer}</div>
    </div>
  );
}
