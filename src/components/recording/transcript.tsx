"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, ChevronDown, RotateCcw, UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { setSpeaker } from "@/lib/actions";
import { formatClock } from "@/lib/format";
import { initials, resolveSpeakers, type ResolvedSpeaker, type SpeakerInfo, type SpeakerMap } from "@/lib/speakers";
import type { PersonCard, Segment } from "@/lib/types";
import { cn } from "@/lib/utils";

// Transcript grouped by turn: each run of paragraphs from one person sits
// under one header with their name, email and avatar.
export function Transcript({ recordingId, segments, speakers, owner, people }: {
  recordingId: string; segments: Segment[]; speakers: SpeakerMap; owner: SpeakerInfo | null; people: PersonCard[];
}) {
  // Fill in the owner's email from the workspace roster.
  const ownerInfo = useMemo(() => {
    if (!owner) return null;
    const m = people.find((p) => p.id === owner.userId);
    return { ...owner, email: m?.email ?? owner.email ?? null };
  }, [owner, people]);
  const resolved = useMemo(() => resolveSpeakers(segments, speakers, ownerInfo), [segments, speakers, ownerInfo]);
  const turns: { speaker: string; items: Segment[] }[] = [];
  for (const s of segments) {
    const last = turns.at(-1);
    if (last && last.speaker === s.speaker) last.items.push(s);
    else turns.push({ speaker: s.speaker, items: [s] });
  }
  return (
    <div className="space-y-6">
      {turns.map((t, i) => (
        <div key={i} className="grid grid-cols-[56px_1fr] gap-3">
          <span className="pt-2 text-xs text-muted-foreground tabular-nums">{formatClock(t.items[0].startSec)}</span>
          <div className="space-y-2">
            <SpeakerChip recordingId={recordingId} who={resolved.get(t.speaker)!} people={people} />
            {t.items.map((s, j) => (
              <p key={j} className="text-sm leading-relaxed text-foreground/90" title={j ? formatClock(s.startSec) : undefined}>{s.text}</p>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function SpeakerChip({ recordingId, who, people }: { recordingId: string; who: ResolvedSpeaker; people: PersonCard[] }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const save = (info: SpeakerInfo | null) => start(async () => {
    const r = await setSpeaker(recordingId, who.label, info);
    setError(r.error);
    if (!r.error) { setOpen(false); setName(""); }
  });
  const known = Boolean(who.userId || who.email || who.name !== who.label);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={
        <button type="button" className="group flex max-w-full items-center gap-2 rounded-lg py-1 pr-2 pl-1 text-left hover:bg-muted" aria-label={`${who.name}: change who this is`} />
      }>
        <Avatar size="sm" className="size-7">
          {who.avatarUrl && <AvatarImage src={who.avatarUrl} alt="" />}
          <AvatarFallback className="text-[10px]">{known ? initials(who.name) : <UserRound className="size-3.5" />}</AvatarFallback>
        </Avatar>
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-sm font-medium">{who.name}</span>
          {who.email && <span className="block truncate text-xs text-muted-foreground">{who.email}</span>}
        </span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground opacity-60 group-hover:opacity-100" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 space-y-3">
        <div>
          <p className="text-sm font-medium">Who is {who.label === "Speaker" ? "speaking" : who.label}?</p>
          <p className="text-xs text-muted-foreground">{who.assumed ? "We guessed this is the person who recorded it. " : ""}Changes every paragraph from this voice.</p>
        </div>
        {people.length > 0 && (
          <ul className="max-h-48 space-y-0.5 overflow-y-auto">
            {people.map((p) => {
              const picked = who.userId === p.id;
              return (
                <li key={p.id}>
                  <button type="button" disabled={pending} onClick={() => save({ name: p.fullName || p.email, email: p.email, avatarUrl: p.avatarUrl, userId: p.id })}
                    className={cn("flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted", picked && "bg-accent")}>
                    <Avatar size="sm">{p.avatarUrl && <AvatarImage src={p.avatarUrl} alt="" />}<AvatarFallback className="text-[10px]">{initials(p.fullName || p.email)}</AvatarFallback></Avatar>
                    <span className="min-w-0 flex-1"><span className="block truncate">{p.fullName || p.email}</span>{p.fullName && <span className="block truncate text-xs text-muted-foreground">{p.email}</span>}</span>
                    {picked && <Check className="size-4" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (name.trim()) save({ name: name.trim() }); }}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Someone else: type a name" aria-label="Speaker name" />
          <Button type="submit" size="sm" disabled={pending || !name.trim()}>Save</Button>
        </form>
        {!who.assumed && who.name !== who.label && (
          <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => save(null)}><RotateCcw /> Back to “{who.label}”</Button>
        )}
        {error && <p className="text-xs text-destructive">{error}</p>}
      </PopoverContent>
    </Popover>
  );
}
