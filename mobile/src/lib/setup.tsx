// Shared by the setup screens: the member's account and their own Redial
// line (if they have one yet), and saving the line's settings.
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { get, post } from "./api";
import type { Me, MyLine } from "./types";

type LineSettings = Pick<MyLine, "label" | "forward_to" | "mode" | "paused" | "allow_connect" | "assistant_name" | "voice" | "greeting" | "about" | "max_seconds">;

type SetupState = {
  me: Me | null; line: MyLine | null; error: string | null; reload: () => void;
  save: (patch: Partial<LineSettings>) => Promise<string | null>;
};

const Ctx = createContext<SetupState | null>(null);

export function SetupProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => {
    get<Me>("me").then((m) => { setMe(m); setError(null); }).catch((e) => setError(e.message));
  }, []);
  useEffect(reload, [reload]);
  const line = me?.lines.find((l) => l.access.owner) ?? null;

  // rules.save takes every setting, so start from the line's current ones.
  const save = useCallback(async (patch: Partial<LineSettings>) => {
    if (!line) return "You don't have a Redial number yet.";
    const settings = {
      label: line.label, forward_to: line.forward_to ?? "", mode: line.mode, paused: line.paused, allow_connect: line.allow_connect,
      assistant_name: line.assistant_name, voice: line.voice, greeting: line.greeting ?? "", about: line.about ?? "", max_seconds: line.max_seconds,
      ...patch,
    };
    try {
      await post("rules.save", { lineId: line.id, settings: { ...settings, forward_to: settings.forward_to ?? "", greeting: settings.greeting ?? "", about: settings.about ?? "" } });
      setMe((m) => m && { ...m, lines: m.lines.map((l) => (l.id === line.id ? { ...l, ...patch } : l)) });
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : String(e);
    }
  }, [line]);

  return <Ctx.Provider value={{ me, line, error, reload, save }}>{children}</Ctx.Provider>;
}

export function useSetup() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSetup outside SetupProvider");
  return s;
}
