"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { Copy, Heart, Moon, Share2, Sun, UserPlus, X } from "lucide-react";
import { CardPreview, hexAlpha, type CardAction } from "@/components/cards/card-preview";
import { cardName, toVCard, type CardLink, type PublicCard, type Slide } from "@/lib/cards/types";
import { shareInfo, track } from "../actions";

// Public card: optional splash, the card, Copy / Share / Save / Like, and the
// lead form. Counts one view per visit; ?src=qr or ?src=nfc records how the
// visitor arrived.
export function PublicCardView({ card, url }: { card: PublicCard; url: string }) {
  const opener = card.design.sections.find((s) => s.section_type === "opener" && s.is_visible);
  const [splash, setSplash] = useState(Boolean(opener));
  const [light, setLight] = useState(false);
  const [leadOpen, setLeadOpen] = useState(false);
  const [liked, setLiked] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const shown = light ? { ...card, background_color: "#f8f8f6", text_color: "#18181b" } : card;
  const t = useCallback((kind: string, detail?: string) => void track(card.slug, kind, detail), [card.slug]);

  useEffect(() => {
    const src = new URLSearchParams(window.location.search).get("src");
    const key = `card-view:${card.slug}`;
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, "1"); } catch { /* private mode */ }
    t(src === "qr" || src === "nfc" ? src : "view", document.referrer ? new URL(document.referrer).hostname : undefined);
  }, [card.slug, t]);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 1800); };
  function action(a: CardAction) {
    const sms = card.sms_phone || card.primary_phone;
    const go = (href: string, label: string, blank = false) => { t("click", label); if (blank) window.open(href, "_blank", "noopener"); else window.location.href = href; };
    if (a === "call" && card.primary_phone) go(`tel:${card.primary_phone.replace(/[^\d+]/g, "")}`, "Call");
    if (a === "sms" && sms) go(`sms:${sms.replace(/[^\d+]/g, "")}`, "Text");
    if (a === "email" && card.primary_email) go(`mailto:${card.primary_email}`, "Email");
    if (a === "map") go(card.maps_url || `https://maps.google.com/?q=${encodeURIComponent(card.address ?? "")}`, "Map", true);
    if (a === "website" && card.website_url) go(card.website_url, "Website", true);
    if (a === "video" && card.intro_video_url) go(card.intro_video_url, "Intro video", true);
    if (a === "lead") setLeadOpen(true);
  }
  function link(l: CardLink) { t("click", l.label); window.open(l.url, l.open_in_new_tab ? "_blank" : "_self", "noopener"); }
  async function copy() { await navigator.clipboard.writeText(url).catch(() => {}); t("copy"); flash("Link copied"); }
  async function share() {
    t("share");
    if (navigator.share) await navigator.share({ title: cardName(card), url }).catch(() => {});
    else await copy();
  }
  function save() {
    t("save");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([toVCard(card, url)], { type: "text/vcard;charset=utf-8" }));
    a.download = `${cardName(card).replace(/[^\w ]+/g, "").trim() || "contact"}.vcf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  return (
    <main className="min-h-dvh w-full px-4 py-8" style={{ background: shown.background_color }}>
      {splash && opener && <Splash content={opener.content} card={card} onDone={() => setSplash(false)} />}
      <div className="mx-auto max-w-sm">
        {card.theme_mode === "both" && (
          <div className="mb-3 flex justify-end">
            <button type="button" onClick={() => setLight((v) => !v)} aria-label="Switch light or dark" className="grid size-8 place-items-center rounded-full" style={{ background: "rgba(127,127,127,0.15)", color: shown.text_color }}>
              {light ? <Moon className="size-4" /> : <Sun className="size-4" />}
            </button>
          </div>
        )}
        <CardPreview card={shown} publicUrl={url} onAction={action} onLink={link} />
        <div className="mt-5 flex items-center justify-center gap-2">
          {([["Copy", Copy, copy], ["Share", Share2, share], ["Save", UserPlus, save], ["Like", Heart, () => { if (!liked) { setLiked(true); t("like"); } }]] as const).map(([label, Icon, fn]) => (
            <button key={label} type="button" onClick={() => void fn()} className="flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-[11px] font-medium" style={{ background: "rgba(127,127,127,0.15)", color: card.accent_color }}>
              <Icon className={label === "Like" && liked ? "size-4 fill-current" : "size-4"} />{label}
            </button>
          ))}
        </div>
      </div>
      {toast && <div role="status" className="fixed inset-x-0 bottom-6 mx-auto w-fit rounded-full bg-black/80 px-4 py-2 text-sm text-white">{toast}</div>}
      {leadOpen && <LeadModal card={shown} onClose={() => setLeadOpen(false)} />}
    </main>
  );
}

const youtubeId = (u: string) => /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/.exec(u)?.[1] ?? null;
const vimeoId = (u: string) => /vimeo\.com\/(?:video\/)?(\d+)/.exec(u)?.[1] ?? null;

function SplashVideo({ content, onEnd }: { content: Record<string, unknown>; onEnd: () => void }) {
  const src = String(content.video_url ?? "");
  const start = Number(content.video_start || 0), end = Number(content.video_end || 0);
  const startMuted = content.video_muted !== false;
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(startMuted);
  const [needsTap, setNeedsTap] = useState(false);
  const finished = useRef(false);
  const finish = useCallback(() => { if (!finished.current) { finished.current = true; onEnd(); } }, [onEnd]);
  const yt = youtubeId(src), vm = vimeoId(src);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.play().catch(() => {
      if (!v.muted) { v.muted = true; setMuted(true); v.play().catch(() => setNeedsTap(true)); } else setNeedsTap(true);
    });
  }, [src]);

  if (yt) {
    const p = new URLSearchParams({ autoplay: "1", controls: "0", playsinline: "1", rel: "0", modestbranding: "1", mute: startMuted ? "1" : "0" });
    if (start) p.set("start", String(start));
    if (end) p.set("end", String(end));
    return <iframe title="Intro video" className="aspect-video w-full max-w-2xl rounded-xl border-0" src={`https://www.youtube.com/embed/${yt}?${p}`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />;
  }
  if (vm) return <iframe title="Intro video" className="aspect-video w-full max-w-2xl rounded-xl border-0" src={`https://player.vimeo.com/video/${vm}?autoplay=1&controls=0&muted=${startMuted ? 1 : 0}${start ? `#t=${start}s` : ""}`} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />;
  if (!src) return null;
  return (
    <div className="relative w-full max-w-2xl">
      <video ref={ref} src={src} className="w-full rounded-xl" autoPlay playsInline muted={muted}
        onLoadedMetadata={() => { if (ref.current && start) ref.current.currentTime = start; }}
        onTimeUpdate={() => { if (ref.current && end && ref.current.currentTime >= end) { ref.current.pause(); finish(); } }}
        onEnded={finish} onError={finish} />
      {needsTap && <button type="button" onClick={(e) => { e.stopPropagation(); setNeedsTap(false); ref.current?.play().catch(() => setNeedsTap(true)); }} className="absolute inset-0 grid place-items-center rounded-xl bg-black/40 text-sm font-semibold text-white">Tap to play</button>}
      {!startMuted && muted && !needsTap && <button type="button" onClick={(e) => { e.stopPropagation(); if (ref.current) ref.current.muted = false; setMuted(false); }} className="absolute right-3 bottom-3 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white">Tap for sound</button>}
    </div>
  );
}

function SplashSlides({ slides }: { slides: Slide[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (slides.length < 2) return;
    const timer = setInterval(() => setI((p) => (p + 1) % slides.length), 3500);
    return () => clearInterval(timer);
  }, [slides.length]);
  if (!slides.length) return null;
  return (
    <div className="relative w-full max-w-2xl overflow-hidden rounded-xl">
      <img src={slides[i].image_url} alt={slides[i].caption || ""} className="h-72 w-full object-cover" /> {/* eslint-disable-line @next/next/no-img-element */}
      {slides[i].caption && <div className="absolute inset-x-0 bottom-0 bg-black/50 px-4 py-2 text-sm text-white">{slides[i].caption}</div>}
    </div>
  );
}

function Splash({ content, card, onDone }: { content: Record<string, unknown>; card: PublicCard; onDone: () => void }) {
  const mode = String(content.mode ?? "standard");
  const transition = String(content.transition ?? "fade");
  const duration = Number(content.duration_seconds || 0);
  const video = String(content.video_url ?? "");
  const slides = (Array.isArray(content.slides) ? content.slides : []) as Slide[];
  const selfTimed = mode === "video" && Boolean(video) && !youtubeId(video) && !vimeoId(video);
  const showButton = content.show_button !== false;
  const [shown, setShown] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const close = useCallback(() => { setLeaving(true); window.setTimeout(onDone, 450); }, [onDone]);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true));
    const timer = duration > 0 && !selfTimed ? setTimeout(close, duration * 1000) : undefined;
    return () => { cancelAnimationFrame(raf); if (timer) clearTimeout(timer); };
  }, [duration, close, selfTimed]);

  const active = shown && !leaving;
  const motion: React.CSSProperties = transition === "none" ? {}
    : transition === "zoom" ? { opacity: active ? 1 : 0, transform: active ? "scale(1)" : leaving ? "scale(1.05)" : "scale(0.95)" }
      : transition === "slide-up" ? { transform: active ? "translateY(0)" : leaving ? "translateY(-100%)" : "translateY(100%)" }
        : transition === "slide-down" ? { transform: active ? "translateY(0)" : leaving ? "translateY(100%)" : "translateY(-100%)" }
          : { opacity: active ? 1 : 0 };
  const btn = { background: "rgba(127,127,127,0.18)", color: card.accent_color };
  const primary = String(content.primary_label || "View card");
  const secondary = String(content.secondary_label || (card.primary_phone ? "Call me" : ""));
  const logo = String(content.logo_url ?? "");

  return (
    <div className="fixed inset-0 z-40 flex flex-col items-center justify-center px-6 text-center transition-all duration-[450ms] ease-out"
      style={{ background: card.background_color, color: card.text_color, ...motion }} onClick={mode !== "standard" && !showButton ? close : undefined}>
      {mode === "video" ? <><SplashVideo content={content} onEnd={close} />{(showButton || !video) && <button type="button" onClick={close} className="mt-6 rounded-full px-6 py-2.5 text-sm font-semibold" style={btn}>{primary}</button>}</>
        : mode === "slideshow" ? <><SplashSlides slides={slides} />{(showButton || !slides.length) && <button type="button" onClick={close} className="mt-6 rounded-full px-6 py-2.5 text-sm font-semibold" style={btn}>{primary}</button>}</>
          : (
            <>
              {logo && <img src={logo} alt="" className="mb-5 size-20 rounded-full object-cover" style={{ border: `2px solid ${card.accent_color}` }} />} {/* eslint-disable-line @next/next/no-img-element */}
              <div className="text-[11px] font-semibold tracking-[0.25em] uppercase" style={{ opacity: 0.6 }}>{String(content.eyebrow || "Digital card")}</div>
              <h1 className="mt-3 text-5xl font-bold">{String(content.title || "Welcome")}</h1>
              <p className="mt-2 text-sm" style={{ opacity: 0.7 }}>{String(content.subtitle || "Tap to view my digital business card.")}</p>
              <div className="mt-6 flex gap-3">
                <button type="button" onClick={close} className="rounded-full px-6 py-2.5 text-sm font-semibold" style={btn}>{primary}</button>
                {secondary && card.primary_phone && <a href={`tel:${card.primary_phone.replace(/[^\d+]/g, "")}`} className="rounded-full px-6 py-2.5 text-sm font-semibold" style={btn}>{secondary}</a>}
              </div>
            </>
          )}
    </div>
  );
}

function LeadModal({ card, onClose }: { card: PublicCard; onClose: () => void }) {
  const form = card.design.lead_form_settings;
  const fields = form.fields.filter((f) => f.enabled);
  const [values, setValues] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const field = { background: hexAlpha(card.text_color, 0.08), color: card.text_color, border: `1px solid ${hexAlpha(card.text_color, 0.18)}` };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={form.title}>
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl p-5" style={{ background: card.background_color, color: card.text_color, border: "1px solid rgba(127,127,127,0.25)" }}>
        <button type="button" onClick={onClose} aria-label="Close" className="absolute top-3 right-3 opacity-60 hover:opacity-100"><X className="size-4" /></button>
        {done ? (
          <div className="py-8 text-center">
            <div className="text-lg font-semibold">Thank you!</div>
            <p className="mt-1 text-sm" style={{ opacity: 0.7 }}>Your info was sent. {cardName(card).split(" ")[0]} will follow up shortly.</p>
            <button type="button" onClick={onClose} className="mt-5 rounded-full px-6 py-2 text-sm font-semibold" style={{ background: card.accent_color, color: card.background_color }}>Close</button>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); setError(""); start(async () => { const r = await shareInfo({ slug: card.slug, ...values }); if (r.error) setError(r.error); else setDone(true); }); }}>
            <div className="text-lg font-semibold">{form.title || "Send me your info"}</div>
            {form.description && <p className="mt-1 text-sm" style={{ opacity: 0.7 }}>{form.description}</p>}
            <div className="mt-4 space-y-2.5">
              {fields.map((f) => f.key === "message"
                ? <textarea key={f.key} aria-label={f.label} placeholder={f.label + (f.required ? " *" : "")} required={f.required} rows={3} value={values[f.key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} className="w-full resize-none rounded-lg px-3 py-2 text-sm outline-none" style={field} />
                : <input key={f.key} aria-label={f.label} placeholder={f.label + (f.required ? " *" : "")} required={f.required} type={f.key === "email" ? "email" : f.key === "phone" ? "tel" : "text"} autoComplete={f.key === "name" ? "name" : f.key === "company" ? "organization" : f.key === "phone" ? "tel" : f.key} value={values[f.key] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))} className="h-10 w-full rounded-lg px-3 text-sm outline-none" style={field} />)}
              <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={values.website ?? ""} onChange={(e) => setValues((v) => ({ ...v, website: e.target.value }))} />
            </div>
            {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
            <button type="submit" disabled={pending} className="mt-4 w-full rounded-full py-2.5 text-sm font-semibold disabled:opacity-50" style={{ background: card.accent_color, color: card.background_color }}>
              {pending ? "Sending…" : form.submit_label || "Send info"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
