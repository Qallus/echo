// "2026-11-05" + "14:30" in a time zone -> the UTC instant.
export function zonedToUtc(date: string, time: string, tz: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const guess = new Date(`${date}T${time}:00Z`);
  if (Number.isNaN(guess.getTime())) return null;
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(guess).map((p) => [p.type, p.value]));
    const asLocal = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
    return new Date(guess.getTime() - (asLocal - guess.getTime()));
  } catch {
    return guess;
  }
}

// The date ("YYYY-MM-DD") and time ("HH:MM") of an instant in a time zone.
export function utcToZoned(iso: string, tz: string) {
  const d = new Date(iso);
  return { date: d.toLocaleDateString("en-CA", { timeZone: tz }), time: d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: tz }) };
}
