// Loads something from the API, with loading, error and pull-to-refresh state.
// `key` names what's loaded (e.g. the line id); a new key loads again.
import { useCallback, useEffect, useState } from "react";

export function useLoad<T>(load: () => Promise<T>, key: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let live = true;
    load().then(
      (d) => { if (live) { setData(d); setError(null); } },
      (e) => { if (live) setError(e instanceof Error ? e.message : String(e)); },
    ).finally(() => { if (live) { setLoading(false); setRefreshing(false); } });
    return () => { live = false; };
    // Reloads when `key` changes or reload() is called, not on every new `load` function.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick]);

  const reload = useCallback((pulled = false) => { if (pulled) setRefreshing(true); setTick((t) => t + 1); }, []);
  return { data, setData, error, loading, refreshing, reload };
}
