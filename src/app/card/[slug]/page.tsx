import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { cardPath, type PublicCard } from "@/lib/cards/types";
import { siteUrl } from "@/lib/notify/senders";
import { createClient } from "@/lib/supabase/server";
import { CardActions } from "./card-actions";

const SLUG = /^[a-z0-9][a-z0-9-]{1,59}$/;

async function load(slug: string) {
  if (!SLUG.test(slug)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("card_public", { p_slug: slug }).maybeSingle<PublicCard>();
  return data ? { ...data, links: Array.isArray(data.links) ? data.links : [] } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const card = await load((await params).slug);
  if (!card) return { title: "Card not found" };
  const line = [card.title, card.company].filter(Boolean).join(" · ");
  return {
    title: card.full_name, description: line || card.bio || undefined,
    openGraph: { title: card.full_name, description: line || undefined, images: card.photo_url ? [card.photo_url] : undefined },
    robots: { index: false },
  };
}

// A person's digital business card: save to contacts, share, QR, leave your details.
export default async function CardPage({ params }: { params: Promise<{ slug: string }> }) {
  const card = await load((await params).slug);
  if (!card) notFound();
  return (
    <main className={card.theme === "dark" ? "min-h-dvh bg-zinc-900 px-4 py-8" : "min-h-dvh bg-zinc-100 px-4 py-8"}>
      <div className="mx-auto w-full max-w-md">
        <CardActions card={card} url={siteUrl(cardPath(card.slug))} />
        <p className="pt-6 text-center text-xs text-zinc-500">
          Made with <Link href="/" className="underline underline-offset-2">Echo</Link>
        </p>
      </div>
    </main>
  );
}

