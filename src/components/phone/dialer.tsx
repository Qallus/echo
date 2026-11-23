"use client";

import { useRef, useState } from "react";
import { Delete, Grid3x3, Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import { cn } from "@/lib/utils";

// The phone dialer shared by Communications, the user's Phone (/calls) and
// the floating admin phone: a phone-style keypad with letters, and the
// in-call screen. Hold 0 for +, hold backspace to clear; keys give a short
// buzz on phones that support it.

const KEYS: { key: string; sub: string }[] = [
  { key: "1", sub: "" }, { key: "2", sub: "ABC" }, { key: "3", sub: "DEF" },
  { key: "4", sub: "GHI" }, { key: "5", sub: "JKL" }, { key: "6", sub: "MNO" },
  { key: "7", sub: "PQRS" }, { key: "8", sub: "TUV" }, { key: "9", sub: "WXYZ" },
  { key: "*", sub: "" }, { key: "0", sub: "+" }, { key: "#", sub: "" },
];

export const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const buzz = () => { try { navigator.vibrate?.(8); } catch {} };

// Keeps what a person can dial: digits, * # and a leading +.
export const cleanDial = (v: string) => v.replace(/[^\d*#+]/g, "").replace(/(?!^)\+/g, "").slice(0, 20);

// (480) 555-0100 as you type; anything else (international, codes) as typed.
export function formatDial(v: string) {
  if (/[*#]/.test(v) || v.startsWith("+") && !v.startsWith("+1")) return v;
  const lead = v.startsWith("+1") ? "+1 " : v.startsWith("1") && v.length > 1 ? "1 " : "";
  const d = v.replace(/^\+?1(?=\d)/, "");
  if (d.length <= 3) return lead + d;
  if (d.length <= 6) return `${lead}(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `${lead}(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 10)}${d.slice(10)}`;
}

// A press that does something else when held (0 -> +, backspace -> clear).
function useHold(onTap: () => void, onHold?: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const held = useRef(false);
  const start = () => {
    held.current = false;
    if (!onHold) return;
    timer.current = setTimeout(() => { held.current = true; buzz(); onHold(); }, 450);
  };
  const end = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  return {
    onPointerDown: start, onPointerUp: end, onPointerLeave: end, onPointerCancel: end,
    onClick: () => { if (!held.current) { buzz(); onTap(); } held.current = false; },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  };
}

function Key({ k, onPress, onHold, size }: { k: { key: string; sub: string }; onPress: (k: string) => void; onHold?: () => void; size: "lg" | "sm" }) {
  const hold = useHold(() => onPress(k.key), onHold);
  return (
    <button type="button" {...hold} aria-label={k.key === "0" ? "0, hold for plus" : k.key}
      className={cn("flex touch-manipulation flex-col items-center justify-center rounded-full bg-muted/70 transition select-none hover:bg-muted active:scale-95 active:bg-muted-foreground/20",
        size === "lg" ? "size-[4.25rem] sm:size-16" : "size-12")}>
      <span className={cn("leading-none font-medium tabular-nums", size === "lg" ? "text-[1.7rem]" : "text-lg")}>{k.key}</span>
      {k.sub && <span className={cn("mt-0.5 leading-none font-semibold tracking-[0.15em] text-muted-foreground", size === "lg" ? "text-[9px]" : "text-[8px]")}>{k.sub}</span>}
    </button>
  );
}

export function Keys({ onPress, onPlus, size = "lg" }: { onPress: (k: string) => void; onPlus?: () => void; size?: "lg" | "sm" }) {
  return (
    <div className={cn("mx-auto grid w-fit grid-cols-3", size === "lg" ? "gap-x-6 gap-y-3 sm:gap-x-5" : "gap-2")}>
      {KEYS.map((k) => <Key key={k.key} k={k} size={size} onPress={onPress} onHold={k.key === "0" && onPlus ? onPlus : undefined} />)}
    </div>
  );
}

// The dial pad: number display (type or paste too), keys, and the call row.
export function DialPad({ value, onChange, onCall, canCall, above, below, placeholder = "Enter a number" }: {
  value: string; onChange: (v: string) => void; onCall: () => void; canCall: boolean;
  /** Chips over the number (line, recording). */
  above?: React.ReactNode;
  /** Under the number (contact suggestions). */
  below?: React.ReactNode;
  placeholder?: string;
}) {
  const back = useHold(() => onChange(value.slice(0, -1)), () => onChange(""));
  return (
    <form className="flex flex-col items-center gap-3" onSubmit={(e) => { e.preventDefault(); if (canCall) onCall(); }}>
      {above && <div className="flex w-full flex-wrap items-center justify-center gap-2">{above}</div>}
      <input value={formatDial(value)} onChange={(e) => onChange(cleanDial(e.target.value))} placeholder={placeholder} inputMode="tel" autoComplete="tel"
        aria-label="Number to call"
        className="h-12 w-full min-w-0 bg-transparent text-center text-3xl font-light tracking-wide tabular-nums outline-none placeholder:text-xl placeholder:text-muted-foreground/60" />
      {below}
      <Keys onPress={(k) => onChange(cleanDial(value + k))} onPlus={() => onChange(cleanDial(value + "+"))} />
      <div className="mx-auto grid w-fit grid-cols-3 items-center gap-x-6 sm:gap-x-5">
        <span />
        <button type="submit" disabled={!canCall} aria-label="Call"
          className="flex size-[4.25rem] touch-manipulation items-center justify-center rounded-full bg-emerald-600 text-white shadow-md transition hover:bg-emerald-700 active:scale-95 disabled:opacity-40 sm:size-16">
          <Phone className="size-7 fill-current" />
        </button>
        <button type="button" {...back} aria-label="Delete digit (hold to clear)" disabled={!value}
          className={cn("flex size-[4.25rem] touch-manipulation items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted active:scale-95 sm:size-16", !value && "invisible")}>
          <Delete className="size-6" />
        </button>
      </div>
    </form>
  );
}

// On a call: who, how long, and the controls. `compact` for the floating phone.
export function InCallControls({ label, status, seconds, muted, onMute, onDigit, onHangUp, note, compact = false }: {
  label: React.ReactNode; status: "connecting" | "live"; seconds: number; muted: boolean;
  onMute: () => void; onDigit: (d: string) => void; onHangUp: () => void; note?: React.ReactNode; compact?: boolean;
}) {
  const [keypad, setKeypad] = useState(false);
  const round = compact ? "size-12" : "size-16";
  const control = "flex flex-col items-center gap-1.5 text-xs text-muted-foreground";
  const circle = (on: boolean) => cn("flex items-center justify-center rounded-full transition active:scale-95", round, on ? "bg-foreground text-background" : "bg-muted hover:bg-muted-foreground/20 text-foreground");
  return (
    <div className={cn("flex flex-col items-center text-center", compact ? "gap-3" : "gap-5 py-2")}>
      <div className="min-w-0 max-w-full">
        <p className={cn("truncate font-semibold", compact ? "text-lg" : "text-2xl")}>{label}</p>
        <p className="text-sm text-muted-foreground tabular-nums">{status === "live" ? clock(seconds) : "Calling…"}</p>
      </div>
      {keypad && <Keys size={compact ? "sm" : "lg"} onPress={(d) => onDigit(d)} />}
      <div className={cn("grid grid-cols-2", compact ? "gap-6" : "gap-10")}>
        <button type="button" className={control} onClick={onMute} aria-label={muted ? "Unmute" : "Mute"}>
          <span className={circle(muted)}>{muted ? <MicOff className="size-5" /> : <Mic className="size-5" />}</span>{muted ? "Muted" : "Mute"}
        </button>
        <button type="button" className={control} onClick={() => setKeypad(!keypad)} aria-label={keypad ? "Hide keypad" : "Keypad"}>
          <span className={circle(keypad)}><Grid3x3 className="size-5" /></span>{keypad ? "Hide" : "Keypad"}
        </button>
      </div>
      <button type="button" onClick={onHangUp} aria-label="Hang up"
        className={cn("flex items-center justify-center rounded-full bg-red-600 text-white shadow-md transition hover:bg-red-700 active:scale-95", compact ? "size-14" : "size-[4.25rem]")}>
        <PhoneOff className="size-7" />
      </button>
      {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
    </div>
  );
}
