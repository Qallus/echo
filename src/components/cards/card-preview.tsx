"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { ExternalLink, Mail, MapPin, MessageSquare, Nfc, Phone } from "lucide-react";
import {
  cardName, DEFAULT_LOGO_HEIGHT, DEFAULT_LOGO_MARGIN_BOTTOM, DEFAULT_QR_DISPLAY,
  type CardLink, type CardSection, type PublicCard, type Slide, type StepItem,
} from "@/lib/cards/types";
import { cn } from "@/lib/utils";

export type CardAction = "call" | "sms" | "email" | "map" | "lead" | "website" | "video";

export function hexAlpha(hex: string, alpha: number) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
  if (!m) return `rgba(127,127,127,${alpha})`;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${alpha})`;
}

// A QR code as a data URL, made in the browser.
export function useQr(value: string, size: number, fg = "#000000") {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(value, { width: size, margin: 1, errorCorrectionLevel: "M", color: { dark: /^#[0-9a-f]{6}$/i.test(fg) ? fg : "#000000", light: "#ffffff" } })
      .then((u) => { if (live) setSrc(u); }).catch(() => {});
    return () => { live = false; };
  }, [value, size, fg]);
  return src;
}

function CardQr({ url, px, fg }: { url: string; px: number; fg: string }) {
  const src = useQr(`${url}?src=qr`, Math.max(320, px * 2), fg);
  return (
    <div className="flex justify-center">
      <div className="rounded-xl bg-white p-3">
        {src ? <img src={src} alt="QR code" style={{ width: px, height: px }} /> : <div style={{ width: px, height: px }} />} {/* eslint-disable-line @next/next/no-img-element */}
      </div>
    </div>
  );
}

// The card body: used by the builder preview and the public page. The parent
// handles clicks (tracking, opening links).
export function CardPreview({ card, publicUrl, onLink, onAction }: {
  card: PublicCard; publicUrl: string; onLink?: (link: CardLink) => void; onAction?: (action: CardAction) => void;
}) {
  const bg = card.background_color || "#ffffff";
  const accent = card.accent_color || "#18181b";
  const text = card.text_color || "#18181b";
  const surface = hexAlpha(text, 0.06);
  const border = hexAlpha(text, 0.12);
  const media = card.design.media_settings ?? {};
  const shape = media.profile_shape === "square" ? "rounded-md" : media.profile_shape === "rounded" ? "rounded-2xl" : "rounded-full";
  const outline = media.profile_outline ? media.profile_outline_color || accent : border;
  const align = media.content_align === "left" ? "items-start text-left" : "items-center text-center";
  const bgImage = Boolean(media.use_background_image && card.background_image_url);
  const name = cardName(card) === "Untitled card" ? "Your name" : cardName(card);
  const subtitle = [card.job_title, card.company_name].filter(Boolean).join(" · ");
  const sections = card.design.sections.filter((s) => s.is_visible && s.section_type !== "opener");

  const note = (title: string, body: string) => (
    <div className="rounded-xl px-4 py-3 text-xs" style={{ background: surface, border: `1px solid ${border}`, color: hexAlpha(text, 0.6) }}>
      <div className="font-semibold" style={{ color: text }}>{title}</div>{body}
    </div>
  );
  const pill = (label: string, icon: React.ReactNode, action: CardAction) => (
    <button key={label} type="button" onClick={() => onAction?.(action)} className="flex flex-1 flex-col items-center justify-center gap-1 rounded-xl py-3 text-xs font-medium transition active:scale-95"
      style={{ background: surface, border: `1px solid ${border}`, color: accent }}>
      {icon}<span style={{ color: text }}>{label}</span>
    </button>
  );
  const row = (label: string, onClick: () => void, key: string) => (
    <button key={key} type="button" onClick={onClick} className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-sm font-semibold transition active:scale-[0.99]"
      style={{ background: surface, border: `1px solid ${border}`, color: text }}>
      <span className="truncate">{label}</span><ExternalLink className="size-4 shrink-0 opacity-60" />
    </button>
  );

  function render(s: CardSection) {
    const wrap = (node: React.ReactNode) => node ? <div key={s.id} style={{ marginTop: s.margin_top, marginBottom: s.margin_bottom }}>{node}</div> : null;
    switch (s.section_type) {
      case "profile_header": {
        const logo = card.logo_url ? <img src={card.logo_url} alt="" className="object-contain" style={{ height: media.logo_height || DEFAULT_LOGO_HEIGHT, width: media.logo_width || "auto", maxWidth: "100%" }} /> : null; // eslint-disable-line @next/next/no-img-element
        const photo = card.profile_photo_url
          ? <img src={card.profile_photo_url} alt={name} className={cn("size-24 object-cover", shape)} style={{ border: `2px solid ${outline}` }} /> // eslint-disable-line @next/next/no-img-element
          : <div className={cn("grid size-24 place-items-center text-2xl font-semibold", shape)} style={{ background: surface, color: accent, border: `2px solid ${outline}` }}>{name.slice(0, 1)}</div>;
        return wrap(
          <div className={cn("flex flex-col", align)}>
            {logo ? (
              <div style={{
                alignSelf: media.logo_align === "left" ? "flex-start" : media.logo_align === "right" ? "flex-end" : media.logo_align === "center" ? "center" : undefined,
                padding: media.logo_padding || 0, marginTop: media.logo_margin_top || 0, marginBottom: media.logo_margin_bottom ?? DEFAULT_LOGO_MARGIN_BOTTOM, maxWidth: "100%",
              }}>
                {media.logo_link_url ? <a href={media.logo_link_url} target="_blank" rel="noopener noreferrer" className="inline-block">{logo}</a> : logo}
              </div>
            ) : <div className="mb-3 text-[10px] font-semibold tracking-[0.2em] uppercase" style={{ color: hexAlpha(text, 0.5) }}>{card.company_name || "Digital card"}</div>}
            {media.profile_link_url ? <a href={media.profile_link_url} target="_blank" rel="noopener noreferrer" className="inline-block">{photo}</a> : photo}
            <div className="mt-3 text-lg font-semibold" style={{ color: text }}>{name}</div>
            {subtitle && <div className="mt-0.5 text-xs font-medium" style={{ color: hexAlpha(text, 0.7) }}>{subtitle}</div>}
            {card.department && <div className="text-xs" style={{ color: hexAlpha(text, 0.55) }}>{card.department}</div>}
            {card.bio && <p className="mt-2 text-xs leading-5" style={{ color: hexAlpha(text, 0.7) }}>{card.bio}</p>}
          </div>,
        );
      }
      case "quick_actions": {
        const actions = [
          card.primary_phone && pill("Call", <Phone className="size-4" />, "call"),
          (card.sms_phone || card.primary_phone) && pill("Text", <MessageSquare className="size-4" />, "sms"),
          card.primary_email && pill("Email", <Mail className="size-4" />, "email"),
          (card.maps_url || card.address) && pill("Map", <MapPin className="size-4" />, "map"),
        ].filter(Boolean);
        return actions.length ? wrap(<div className="flex gap-2">{actions}</div>) : null;
      }
      case "links": {
        const rows = [
          card.website_url && row("Website", () => onAction?.("website"), "website"),
          ...card.links.filter((l) => l.is_visible && l.url).map((l) => row(l.label || "Link", () => onLink?.(l), l.id)),
        ].filter(Boolean);
        return rows.length ? wrap(<div className="flex flex-col gap-2">{rows}</div>) : null;
      }
      case "lead_capture":
        if (!card.design.lead_form_settings.enabled) return null;
        return wrap(
          <button type="button" onClick={() => onAction?.("lead")} className="w-full rounded-xl py-3 text-sm font-semibold transition active:scale-[0.99]" style={{ background: accent, color: bg }}>
            {card.design.lead_form_settings.button_label || "Send me your info"}
          </button>,
        );
      case "video":
        return wrap(card.intro_video_url ? row("Watch intro video", () => onAction?.("video"), "video") : note("Intro video", "Add an intro video link in Content to show this section."));
      case "qr_code":
        return wrap(<CardQr url={publicUrl} px={card.design.qr_settings.display_size || DEFAULT_QR_DISPLAY} fg={card.design.qr_settings.foreground || "#000000"} />);
      case "slideshow": {
        const slides = (Array.isArray(s.content.slides) ? s.content.slides : []) as Slide[];
        if (!slides.length) return wrap(note("Slideshow", "Add images in the Slideshow panel to show a gallery here."));
        return wrap(
          <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
            {slides.map((sl) => (
              <div key={sl.id} className="relative w-full shrink-0 snap-center overflow-hidden rounded-xl" style={{ border: `1px solid ${border}` }}>
                <img src={sl.image_url} alt={sl.caption || ""} className="h-44 w-full object-cover" /> {/* eslint-disable-line @next/next/no-img-element */}
                {sl.caption && <div className="absolute inset-x-0 bottom-0 px-3 py-1.5 text-xs font-medium" style={{ background: hexAlpha(bg, 0.7), color: text }}>{sl.caption}</div>}
              </div>
            ))}
          </div>,
        );
      }
      case "steps": {
        const steps = (Array.isArray(s.content.steps) ? s.content.steps : []) as StepItem[];
        if (!steps.length) return wrap(note("Steps", "Add steps in the Steps panel to show a “how it works” list."));
        return wrap(
          <div className="flex flex-col gap-2">
            {steps.map((st, i) => (
              <div key={st.id} className="flex gap-3 rounded-xl px-3 py-2.5 text-left" style={{ background: surface, border: `1px solid ${border}` }}>
                <div className="grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold" style={{ background: accent, color: bg }}>{i + 1}</div>
                <div>
                  <div className="text-sm font-semibold" style={{ color: text }}>{st.title}</div>
                  {st.description && <div className="text-xs" style={{ color: hexAlpha(text, 0.7) }}>{st.description}</div>}
                </div>
              </div>
            ))}
          </div>,
        );
      }
      case "nfc":
        return wrap(
          <div className="rounded-xl px-4 py-3 text-xs" style={{ background: surface, border: `1px solid ${border}`, color: hexAlpha(text, 0.6) }}>
            <div className="flex items-center gap-1.5 font-semibold" style={{ color: text }}><Nfc className="size-3.5" /> Tap to share</div>
            Hold a phone to my card to open this page.
          </div>,
        );
      default:
        return null;
    }
  }

  return (
    <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-[26px] p-5 shadow-xl"
      style={{
        background: bg, color: text, border: `1px solid ${border}`,
        ...(bgImage ? { backgroundImage: `linear-gradient(${hexAlpha(bg, 0.82)}, ${hexAlpha(bg, 0.92)}), url(${card.background_image_url})`, backgroundSize: "cover", backgroundPosition: "center" } : {}),
      }}>
      {sections.map(render)}
      <div className="mt-4 text-center text-[10px]" style={{ color: hexAlpha(text, 0.4) }}>Powered by Echo</div>
    </div>
  );
}
