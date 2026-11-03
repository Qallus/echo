"use client";

import { RotateCcw, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatError, Composer, MessageList } from "@/components/chat/chat-parts";
import { useEchoChat } from "@/hooks/use-echo-chat";
import { cn } from "@/lib/utils";

const SUGGESTIONS = ["Draft a follow-up email", "Turn action items into tasks", "What decisions were made?"];

// Chat grounded in one recording's transcript and summary.
export function AskPanel({ recordingId, onClose, className }: { recordingId: string; onClose: () => void; className?: string }) {
  const chat = useEchoChat({ recordingId });

  return (
    <aside className={cn("flex h-full w-96 shrink-0 flex-col border-l bg-background pt-[env(safe-area-inset-top)] lg:pt-0", className)}>
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-medium"><Sparkles className="size-4" /> Ask Echo</span>
        <div className="flex">
          {chat.messages.length > 0 && <Button variant="ghost" size="icon-sm" onClick={chat.reset} aria-label="New chat"><RotateCcw /></Button>}
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close"><X /></Button>
        </div>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {!chat.messages.length && (
          <div className="space-y-2 text-sm">
            <p className="text-muted-foreground">Ask anything about this recording.</p>
            {SUGGESTIONS.map((s) => (
              <button key={s} onClick={() => chat.send(s)} className="block w-full rounded-md border px-3 py-2 text-left hover:bg-muted">{s}</button>
            ))}
          </div>
        )}
        <MessageList messages={chat.messages} streaming={chat.streaming} models={chat.models} />
        <ChatError error={chat.error} />
      </div>

      <div className="border-t p-3">
        <Composer
          onSend={chat.send} onStop={chat.stop} streaming={chat.streaming} placeholder="Ask about this recording…"
          model={chat.model} onModelChange={chat.setModel} models={chat.models}
        />
      </div>
    </aside>
  );
}
