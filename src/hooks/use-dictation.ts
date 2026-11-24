"use client";

import { useRef, useState, useSyncExternalStore } from "react";

// Speak instead of type, with the browser's own speech recognition (Chrome,
// Edge, Safari and Android; not Firefox). `supported` is false where the
// browser can't do it, so the microphone button can stay hidden there.
// onText gets the words heard so far (they update while you talk).

type Recognition = {
  lang: string; interimResults: boolean; continuous: boolean; start(): void; stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null; onerror: (() => void) | null;
};
const speechCtor = () => {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};
const noop = () => () => {};

export function useDictation(onText: (heard: string) => void) {
  const supported = useSyncExternalStore(noop, () => Boolean(speechCtor()), () => false);
  const [listening, setListening] = useState(false);
  const rec = useRef<Recognition | null>(null);

  const toggle = () => {
    const Ctor = speechCtor();
    if (!Ctor) return;
    if (listening) { rec.current?.stop(); return; }
    const r = new Ctor();
    r.lang = navigator.language || "en-US";
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => onText(Array.from(e.results).map((x) => x[0].transcript).join(" "));
    r.onend = () => setListening(false);
    r.onerror = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  };
  const stop = () => rec.current?.stop();

  return { supported, listening, toggle, stop };
}
