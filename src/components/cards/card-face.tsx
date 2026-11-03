import { Globe, Mail, MapPin, Phone } from "lucide-react";
import type { PublicCard } from "@/lib/cards/types";
import { cn } from "@/lib/utils";

// The card itself: used on the public page and in the builder preview. It
// keeps its own light or dark theme whatever the site theme is.
export function CardFace({ card, onLink, children, className }: {
  card: PublicCard; onLink?: (label: string) => void; children?: React.ReactNode; className?: string;
}) {
  const dark = card.theme === "dark";
  const initials = card.full_name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const quick = [
    card.phone && { label: "Call", href: `tel:${card.phone.replace(/[^\d+]/g, "")}`, icon: Phone },
    card.email && { label: "Email", href: `mailto:${card.email}`, icon: Mail },
    card.website && { label: "Website", href: card.website, icon: Globe },
  ].filter(Boolean) as { label: string; href: string; icon: typeof Phone }[];

  return (
    <div className={cn("overflow-hidden rounded-3xl border shadow-xl", dark ? "border-zinc-800 bg-zinc-950 text-zinc-50" : "border-zinc-200 bg-white text-zinc-900", className)}
      style={{ ["--card-accent" as string]: card.accent }}>
      <div className="relative h-28" style={{ background: `linear-gradient(135deg, ${card.accent}, ${card.accent}cc)` }}>
        {card.logo_url && <img src={card.logo_url} alt="" className="absolute top-4 right-4 h-8 max-w-28 object-contain" />} {/* eslint-disable-line @next/next/no-img-element */}
      </div>
      <div className="space-y-5 px-6 pb-6">
        <div className="-mt-12 space-y-3">
          {card.photo_url
            ? <img src={card.photo_url} alt={card.full_name} className={cn("size-24 rounded-full border-4 object-cover", dark ? "border-zinc-950" : "border-white")} /> // eslint-disable-line @next/next/no-img-element
            : <div className={cn("grid size-24 place-items-center rounded-full border-4 text-2xl font-semibold text-white", dark ? "border-zinc-950" : "border-white")} style={{ background: card.accent }}>{initials}</div>}
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{card.full_name}</h1>
            {(card.title || card.company) && <p className={dark ? "text-zinc-400" : "text-zinc-600"}>{[card.title, card.company].filter(Boolean).join(" · ")}</p>}
          </div>
          {card.bio && <p className={cn("text-sm leading-relaxed", dark ? "text-zinc-300" : "text-zinc-700")}>{card.bio}</p>}
        </div>

        {quick.length > 0 && (
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${quick.length}, minmax(0, 1fr))` }}>
            {quick.map((q) => (
              <a key={q.label} href={q.href} target={q.label === "Website" ? "_blank" : undefined} rel="noopener noreferrer" onClick={() => onLink?.(q.label)}
                className={cn("flex flex-col items-center gap-1 rounded-2xl py-3 text-xs font-medium transition", dark ? "bg-zinc-900 hover:bg-zinc-800" : "bg-zinc-100 hover:bg-zinc-200")}>
                <q.icon className="size-5" style={{ color: card.accent }} />{q.label}
              </a>
            ))}
          </div>
        )}

        {card.address && (
          <a href={`https://maps.google.com/?q=${encodeURIComponent(card.address)}`} target="_blank" rel="noopener noreferrer" onClick={() => onLink?.("Map")}
            className={cn("flex items-center gap-2 text-sm", dark ? "text-zinc-300" : "text-zinc-700")}>
            <MapPin className="size-4 shrink-0" style={{ color: card.accent }} />{card.address}
          </a>
        )}

        {card.links.length > 0 && (
          <ul className="space-y-2">
            {card.links.map((l) => (
              <li key={l.label + l.url}>
                <a href={l.url} target="_blank" rel="noopener noreferrer" onClick={() => onLink?.(l.label)}
                  className={cn("block rounded-2xl border px-4 py-3 text-center text-sm font-medium transition", dark ? "border-zinc-800 hover:bg-zinc-900" : "border-zinc-200 hover:bg-zinc-50")}>
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        )}
        {children}
      </div>
    </div>
  );
}
