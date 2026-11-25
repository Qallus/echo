"use client";

import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Frame } from "../kit";

// Weather where you are: the city in your profile, or (if there isn't one)
// your browser's location, asked once. Open-Meteo, free, no key. Cached in
// this browser for 30 minutes.

type Wx = { place: string; temp: number; code: number; day: boolean; hi: number; lo: number; unit: "F" | "C"; at: number };
const KEY = "redial.weather.v1";
const fahrenheit = () => typeof navigator !== "undefined" && /-(US|LR|MM)$/i.test(navigator.language || "en-US");

function describe(code: number): { label: string; kind: "sun" | "partly" | "cloud" | "fog" | "rain" | "snow" | "storm" } {
  if (code === 0) return { label: "Clear", kind: "sun" };
  if (code <= 2) return { label: "Partly cloudy", kind: "partly" };
  if (code === 3) return { label: "Cloudy", kind: "cloud" };
  if (code <= 48) return { label: "Fog", kind: "fog" };
  if (code <= 67 || (code >= 80 && code <= 82)) return { label: code <= 57 ? "Drizzle" : "Rain", kind: "rain" };
  if (code <= 77 || code === 85 || code === 86) return { label: "Snow", kind: "snow" };
  return { label: "Thunderstorms", kind: "storm" };
}

async function forecast(lat: number, lon: number, place: string): Promise<Wx> {
  const unit = fahrenheit() ? "F" : "C";
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=auto${unit === "F" ? "&temperature_unit=fahrenheit" : ""}`;
  const j = await (await fetch(url)).json();
  return { place, temp: Math.round(j.current.temperature_2m), code: j.current.weather_code, day: j.current.is_day === 1,
    hi: Math.round(j.daily.temperature_2m_max[0]), lo: Math.round(j.daily.temperature_2m_min[0]), unit, at: Date.now() };
}

async function geocode(city: string): Promise<{ lat: number; lon: number; name: string } | null> {
  const name = city.split(",")[0].trim();
  const j = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1&language=en&format=json`)).json();
  const r = j.results?.[0];
  return r ? { lat: r.latitude, lon: r.longitude, name: r.admin1 ? `${r.name}, ${r.admin1}` : r.name } : null;
}

function load(): Wx | null {
  try { const w = JSON.parse(localStorage.getItem(KEY) ?? "null") as Wx | null; return w && Date.now() - w.at < 30 * 60_000 ? w : null; } catch { return null; }
}

export function WeatherCard({ location }: { location: string | null }) {
  const [wx, setWx] = useState<Wx | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "ask" | "error">("loading");

  useEffect(() => {
    let off = false;
    const done = (w: Wx) => { if (off) return; try { localStorage.setItem(KEY, JSON.stringify(w)); } catch {} setWx(w); setState("ok"); };
    const run = async () => {
      const cached = load();
      if (cached) { if (!off) { setWx(cached); setState("ok"); } return; }
      try {
        if (location?.trim()) {
          const g = await geocode(location);
          if (g) return done(await forecast(g.lat, g.lon, g.name));
        }
        if (!off) setState("ask");
      } catch { if (!off) setState("error"); }
    };
    void run();
    return () => { off = true; };
  }, [location]);

  const useBrowser = () => {
    setState("loading");
    navigator.geolocation?.getCurrentPosition(
      async (p) => {
        try {
          const w = await forecast(p.coords.latitude, p.coords.longitude, "Your location");
          try { localStorage.setItem(KEY, JSON.stringify(w)); } catch {}
          setWx(w); setState("ok");
        } catch { setState("error"); }
      },
      () => setState("error"), { maximumAge: 30 * 60_000, timeout: 10_000 });
  };

  if (state === "loading") return <Frame><div className="h-16 animate-pulse rounded-lg bg-muted" /></Frame>;
  if (state !== "ok" || !wx) {
    return (
      <Frame bodyClassName="flex flex-col items-start justify-center gap-2">
        <p className="text-sm text-muted-foreground">{state === "error" ? "Couldn't get the weather." : "Add your city in your profile, or use your location."}</p>
        <button type="button" onClick={useBrowser} className="inline-flex items-center gap-1 text-sm font-medium underline"><MapPin className="size-3.5" /> Use my location</button>
      </Frame>
    );
  }
  const d = describe(wx.code);
  return (
    <Frame bodyClassName="flex items-center gap-3">
      <WeatherIcon kind={d.kind} day={wx.day} />
      <div className="min-w-0">
        <p className="text-3xl font-semibold tracking-tight tabular-nums">{wx.temp}°<span className="text-base font-normal text-muted-foreground">{wx.unit}</span></p>
        <p className="truncate text-sm">{d.label} · <span className="text-muted-foreground">H {wx.hi}° L {wx.lo}°</span></p>
        <p className="truncate text-xs text-muted-foreground">{wx.place}</p>
      </div>
    </Frame>
  );
}

// Animated SVG weather icons (CSS keyframes in globals.css: wx-*).
export function WeatherIcon({ kind, day = true, className }: { kind: ReturnType<typeof describe>["kind"]; day?: boolean; className?: string }) {
  const sun = day ? (
    <g className="origin-[24px_20px] animate-[spin_14s_linear_infinite]">
      <circle cx="24" cy="20" r="8" fill="#FBBF24" />
      {Array.from({ length: 8 }, (_, i) => <line key={i} x1="24" y1="6" x2="24" y2="2" stroke="#FBBF24" strokeWidth="2.5" strokeLinecap="round" transform={`rotate(${i * 45} 24 20)`} />)}
    </g>
  ) : <path d="M28 10a10 10 0 1 0 8 14 8 8 0 0 1-8-14z" fill="#C7D2FE" className="animate-[wx-float_4s_ease-in-out_infinite]" />;
  const cloud = (cls = "") => <path className={cls} d="M14 38h22a8 8 0 0 0 0-16 11 11 0 0 0-21-2 7 7 0 0 0-1 18z" fill="currentColor" />;
  return (
    <svg viewBox="0 0 48 52" className={cn("size-14 shrink-0 text-slate-300 dark:text-slate-500", className)} aria-hidden>
      {kind === "sun" && sun}
      {kind === "partly" && <>{sun}{cloud("animate-[wx-drift_6s_ease-in-out_infinite] translate-x-1 translate-y-2")}</>}
      {(kind === "cloud" || kind === "fog") && cloud("animate-[wx-drift_6s_ease-in-out_infinite]")}
      {kind === "fog" && [42, 47].map((y, i) => <line key={y} x1="10" y1={y} x2="38" y2={y} stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="animate-[wx-drift_5s_ease-in-out_infinite]" style={{ animationDelay: `${i * 0.6}s` }} />)}
      {(kind === "rain" || kind === "storm") && <>{cloud()}{[18, 25, 32].map((x, i) => <line key={x} x1={x} y1="41" x2={x - 2} y2="47" stroke="#60A5FA" strokeWidth="2.5" strokeLinecap="round" className="animate-[wx-drop_1s_linear_infinite]" style={{ animationDelay: `${i * 0.3}s` }} />)}</>}
      {kind === "storm" && <path d="M26 36l-5 8h5l-3 7 8-10h-5l3-5z" fill="#FACC15" className="animate-[wx-flash_2.4s_ease-in-out_infinite]" />}
      {kind === "snow" && <>{cloud()}{[17, 25, 33].map((x, i) => <circle key={x} cx={x} cy="44" r="1.8" fill="#BFDBFE" className="animate-[wx-snow_2.4s_linear_infinite]" style={{ animationDelay: `${i * 0.5}s` }} />)}</>}
    </svg>
  );
}
