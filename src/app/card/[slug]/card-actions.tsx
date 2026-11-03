"use client";

import { useEffect, useState, useTransition } from "react";
import QRCode from "qrcode";
import { Check, QrCode, Send, Share2, UserPlus, X } from "lucide-react";
import { CardFace } from "@/components/cards/card-face";
import { toVCard, type PublicCard } from "@/lib/cards/types";
import { cn } from "@/lib/utils";
import { shareInfo, track } from "../actions";

// Card plus its actions: Save contact (vCard), Share, QR code and the
// "share your info" form. Counts a view once per visit; ?src=qr or ?src=nfc
// records how the visitor arrived.
export function CardActions({ card, url }: { card: PublicCard; url: string }) {
  const dark = card.theme === "dark";
  const [qr, setQr] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const src = new URLSearchParams(window.location.search).get("src");
    const key = `card-view:${card.slug}`;
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, "1"); } catch { /* private mode */ }
    void track(card.slug, src === "qr" || src === "nfc" ? src : "view", document.referrer ? new URL(document.referrer).hostname : undefined);
  }, [card.slug]);

  function save() {
    void track(card.slug, "save");
    const blob = new Blob([toVCard(card, url)], { type: "text/vcard;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${card.full_name.replace(/[^\w ]+/g, "").trim() || "contact"}.vcf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  async function share() {
    void track(card.slug, "share");
    if (navigator.share) { await navigator.share({ title: card.full_name, url }).catch(() => {}); return; }
    await navigator.clipboard.writeText(url).catch(() => {});
    alert("Link copied.");
  }
  async function showQr() {
    setQr(await QRCode.toDataURL(`${url}?src=qr`, { width: 480, margin: 1, errorCorrectionLevel: "M" }));
  }

  const btn = cn("flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-medium transition", dark ? "bg-zinc-900 hover:bg-zinc-800" : "bg-zinc-100 hover:bg-zinc-200");
  return (
    <CardFace card={card} onLink={(label) => void track(card.slug, "click", label)}>
      <button type="button" onClick={save} className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 font-medium text-white shadow-sm transition hover:opacity-90" style={{ background: card.accent }}>
        <UserPlus className="size-5" /> Save contact
      </button>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => void share()} className={btn}><Share2 className="size-4" /> Share</button>
        <button type="button" onClick={() => void showQr()} className={btn}><QrCode className="size-4" /> QR code</button>
      </div>
      {card.lead_capture && (showForm
        ? <LeadForm card={card} onClose={() => setShowForm(false)} />
        : <button type="button" onClick={() => setShowForm(true)} className={cn(btn, "w-full")}><Send className="size-4" /> Share your info with {card.full_name.split(" ")[0]}</button>)}

      {qr && (
        <div role="dialog" aria-modal="true" aria-label="QR code" className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-6" onClick={() => setQr(null)}>
          <div className="w-full max-w-xs space-y-3 rounded-3xl bg-white p-5 text-center text-zinc-900" onClick={(e) => e.stopPropagation()}>
            <img src={qr} alt={`QR code for ${card.full_name}'s card`} className="w-full" /> {/* eslint-disable-line @next/next/no-img-element */}
            <p className="text-sm text-zinc-600">Scan with a phone camera to open this card.</p>
            <button type="button" onClick={() => setQr(null)} className="inline-flex items-center gap-1 text-sm font-medium"><X className="size-4" /> Close</button>
          </div>
        </div>
      )}
    </CardFace>
  );
}

function LeadForm({ card, onClose }: { card: PublicCard; onClose: () => void }) {
  const dark = card.theme === "dark";
  const [f, setF] = useState({ name: "", email: "", phone: "", company: "", message: "", website: "" });
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const input = cn("h-11 w-full rounded-xl border px-3 text-sm outline-none focus:ring-2", dark ? "border-zinc-700 bg-zinc-900 placeholder:text-zinc-500" : "border-zinc-300 bg-white placeholder:text-zinc-400");
  if (done) return <p className="flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-medium"><Check className="size-4" style={{ color: card.accent }} /> Sent. {card.full_name.split(" ")[0]} will be in touch.</p>;
  return (
    <form className="space-y-2" onSubmit={(e) => {
      e.preventDefault();
      start(async () => { const r = await shareInfo({ slug: card.slug, ...f }); if (r.error) setError(r.error); else setDone(true); });
    }}>
      <input className={input} placeholder="Your name" required autoComplete="name" aria-label="Your name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <input className={input} placeholder="Email" type="email" autoComplete="email" aria-label="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      <input className={input} placeholder="Phone" type="tel" autoComplete="tel" aria-label="Phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
      <input className={input} placeholder="Company (optional)" autoComplete="organization" aria-label="Company" value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} />
      <textarea className={cn(input, "h-20 py-2")} placeholder="Message (optional)" aria-label="Message" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="flex-1 rounded-xl py-3 text-sm font-medium text-white disabled:opacity-60" style={{ background: card.accent }}>{pending ? "Sending…" : "Send my details"}</button>
        <button type="button" onClick={onClose} className="rounded-xl px-4 text-sm">Cancel</button>
      </div>
    </form>
  );
}
