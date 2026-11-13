"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Pick } from "@/components/ui/pick";
import { Textarea } from "@/components/ui/textarea";
import { startLiveAgentThread } from "@/lib/live-agents/message-actions";

export type Hiring = { signedIn: boolean; workspaces: { id: string; name: string }[] };

// "Message <name>": signed-in businesses write the first message here and
// land in the conversation; everyone else creates an account first.
export function MessageButton({ agent, hiring, children, size = "default", variant = "default", className }: {
  agent: { id: string; name: string; handle: string }; hiring: Hiring; children: React.ReactNode;
  size?: "default" | "sm" | "lg"; variant?: "default" | "outline" | "secondary" | "ghost"; className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [ws, setWs] = useState(hiring.workspaces[0]?.id ?? "");
  const [body, setBody] = useState(`Hi ${agent.name}, we're looking for help answering our phones. `);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  if (!hiring.signedIn) {
    const next = encodeURIComponent(`/live-agents/${agent.handle}`);
    return <Button size={size} variant={variant} className={className} nativeButton={false} render={<Link href={`/signup?type=business&next=${next}`} />}>{children}</Button>;
  }

  const send = () => start(async () => {
    setError(undefined);
    const r = await startLiveAgentThread(agent.id, ws, body);
    if (r.error) return setError(r.error);
    router.push(`/messages/${r.ok}`);
  });

  return (
    <>
      <Button type="button" size={size} variant={variant} className={className} onClick={() => setOpen(true)}>{children}</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent title={`Message ${agent.name}`} description="Ask about your calls, hours and how they work. Phone numbers, emails and links are hidden; everything stays on Redial." className="max-w-lg">
          <div className="space-y-3">
            {hiring.workspaces.length > 1 && <Pick label="Messaging for" value={ws} onChange={setWs} options={hiring.workspaces.map((w) => ({ value: w.id, label: `For ${w.name}` }))} />}
            {hiring.workspaces.length === 0 && <p className="text-sm text-destructive">You need to be an owner or admin of a workspace to hire Live Agents.</p>}
            <Textarea rows={5} value={body} maxLength={4000} onChange={(e) => setBody(e.target.value)} />
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button disabled={pending || !ws || body.trim().length < 2} onClick={send}>{pending ? "Sending…" : "Send message"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
