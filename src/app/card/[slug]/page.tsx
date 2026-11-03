import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { cardName, cardPath, normalizeDesign, normalizeLinks, type PublicCard } from "@/lib/cards/types";
import { siteUrl } from "@/lib/notify/senders";
import { createClient } from "@/lib/supabase/server";
import { PublicCardView } from "./public-card";

const SLUG = /^[a-z0-9][a-z0-9-]{1,59}$/;

async function load(slug: string): Promise<PublicCard | null> {
  if (!SLUG.test(slug)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("card_public", { p_slug: slug });
  const c = data as PublicCard | null;
  return c ? { ...c, links: normalizeLinks(c.links), design: normalizeDesign(c.design) } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const card = await load((await params).slug);
  if (!card) return { title: "Card not found" };
  const line = [card.job_title, card.company_name].filter(Boolean).join(" · ");
  return {
    title: cardName(card), description: line || card.bio || undefined,
    openGraph: { title: cardName(card), description: line || undefined, images: card.profile_photo_url ? [card.profile_photo_url] : undefined },
    robots: { index: false },
  };
}

// A person's digital business card.
export default async function CardPage({ params }: { params: Promise<{ slug: string }> }) {
  const card = await load((await params).slug);
  if (!card) notFound();
  return <PublicCardView card={card} url={siteUrl(cardPath(card.slug))} />;
}
