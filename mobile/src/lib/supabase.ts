// The member's Supabase session: the same account as the website. Only the
// public URL and publishable key are in the app; RLS protects the data.
import { AppState, Platform } from "react-native";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_KEY, SUPABASE_URL } from "./config";
import { store } from "./storage";

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { storage: store, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});

// Refresh the token only while the app is in the foreground.
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
