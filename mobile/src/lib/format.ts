// "+14805550142" -> "(480) 555-0142"; other numbers as they are.
export function phone(n: string | null | undefined) {
  if (!n) return "";
  const m = n.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : n;
}

// "Just now", "5m", "3h", "Yesterday", "Mar 4".
export function ago(iso: string) {
  const d = new Date(iso);
  const s = (Date.now() - d.getTime()) / 1000;
  if (s < 60) return "Just now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 172800) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function duration(sec: number) {
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return h ? `${h}h ${m}m` : m ? `${m}m ${s}s` : `${s}s`;
}

export function clock(sec: number) {
  const m = Math.floor(sec / 60), s = String(Math.floor(sec % 60)).padStart(2, "0");
  return `${m}:${s}`;
}
