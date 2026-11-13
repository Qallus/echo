import { MessagesSquare } from "lucide-react";

// Desktop: nothing open yet.
export default function MessagesHome() {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
      <MessagesSquare className="size-7" />
      <p>Pick a conversation.</p>
      <p className="max-w-xs text-xs">Contact details stay hidden; calls, bookings and payments run through Redial.</p>
    </div>
  );
}
