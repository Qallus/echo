// Who's signed in, and whether they've finished setup on this phone. The
// root layout uses these to decide which screens are reachable.
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { store } from "./storage";
import { supabase } from "./supabase";

type SessionState = {
  loading: boolean; session: Session | null; setupDone: boolean;
  finishSetup: () => void; signOut: () => Promise<void>;
};

const Ctx = createContext<SessionState | null>(null);
const setupKey = (userId: string) => `redial.setup-done.${userId}`;

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [setupDone, setSetupDone] = useState(false);

  useEffect(() => {
    const apply = (s: Session | null) => {
      setSession(s);
      setSetupDone(!!s && store.getItem(setupKey(s.user.id)) === "1");
    };
    supabase.auth.getSession().then(({ data }) => { apply(data.session); setLoading(false); });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => apply(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const finishSetup = useCallback(() => {
    if (!session) return;
    store.setItem(setupKey(session.user.id), "1");
    setSetupDone(true);
  }, [session]);

  const signOut = useCallback(async () => { await supabase.auth.signOut(); }, []);

  return <Ctx.Provider value={{ loading, session, setupDone, finishSetup, signOut }}>{children}</Ctx.Provider>;
}

export function useSession() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useSession outside SessionProvider");
  return s;
}
