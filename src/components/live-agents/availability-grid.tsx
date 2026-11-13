import { WEEKDAYS, type LiveAgent } from "@/lib/live-agents/types";

// A week of availability: one row per day with the hours as a bar on a
// 6 am to midnight scale.
const START = 6, END = 24;
const toH = (t: string) => { const [h, m] = t.split(":").map(Number); return h + (m || 0) / 60; };
const fmt = (t: string) => {
  const h = toH(t), hh = Math.floor(h) % 24, mm = Math.round((h % 1) * 60);
  if (hh === 23 && mm === 59) return "midnight";
  const ap = hh >= 12 ? "pm" : "am", h12 = hh % 12 || 12;
  return mm ? `${h12}:${String(mm).padStart(2, "0")} ${ap}` : `${h12} ${ap}`;
};

export function AvailabilityGrid({ availability }: { availability: LiveAgent["availability"] }) {
  return (
    <div className="space-y-1.5">
      {WEEKDAYS.map(({ key, short }) => {
        const w = availability[key];
        const from = w ? Math.max(START, toH(w[0])) : 0, to = w ? Math.min(END, toH(w[1])) : 0;
        return (
          <div key={key} className="grid grid-cols-[2.5rem_minmax(0,1fr)_8.5rem] items-center gap-3 text-sm">
            <span className="text-muted-foreground">{short}</span>
            <div className="relative h-2.5 rounded-full bg-muted">
              {w && <span className="absolute inset-y-0 rounded-full bg-emerald-500" style={{ left: `${((from - START) / (END - START)) * 100}%`, width: `${((to - from) / (END - START)) * 100}%` }} />}
            </div>
            <span className="text-right text-xs text-muted-foreground">{w ? `${fmt(w[0])}–${fmt(w[1])}` : "Off"}</span>
          </div>
        );
      })}
      <div className="grid grid-cols-[2.5rem_minmax(0,1fr)_8.5rem] gap-3 text-[11px] text-muted-foreground">
        <span />
        <div className="flex justify-between"><span>6 am</span><span>noon</span><span>6 pm</span><span>12</span></div>
      </div>
    </div>
  );
}
