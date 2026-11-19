"use client";

import { useSyncExternalStore } from "react";

// The AI voice someone picks most, remembered in this browser and shared by
// Recording Studio and Call Tree ("gemini:Despina", "xai:eve", "openai:onyx").

const KEY = "redial.default-voice";
const EVENT = "redial-default-voice";

const read = () => { try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; } };
const subscribe = (fn: () => void) => {
  window.addEventListener(EVENT, fn);
  window.addEventListener("storage", fn);
  return () => { window.removeEventListener(EVENT, fn); window.removeEventListener("storage", fn); };
};

export function setDefaultVoice(provider: string, voice: string) {
  try { localStorage.setItem(KEY, `${provider}:${voice}`); } catch {}
  window.dispatchEvent(new Event(EVENT));
}

export function useDefaultVoice(): { provider: string; voice: string } | null {
  const raw = useSyncExternalStore(subscribe, read, () => "");
  const [provider, voice] = raw.split(":");
  return provider && voice ? { provider, voice } : null;
}
