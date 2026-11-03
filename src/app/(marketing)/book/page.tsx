import Link from "next/link";
import { CalendarClock, ChevronRight, MapPin, Phone, Video } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { PublicType } from "./actions";

export const metadata = { title: "Book a time · Echo", description: "Schedule a call or meeting with the Echo team.", alternates: { canonical: "/book" } };

const ICON = { video: Video, phone: Phone, in_person: MapPin } as const;

export default async function BookIndex() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("booking_type_public", { p_slug: null });
  const types = (data ?? []) as PublicType[];
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-16 sm:px-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Book a time</h1>
        <p className="text-muted-foreground">Pick what you&apos;d like to talk about, then choose a time that works.</p>
      </div>
      {types.length === 0 ? <p className="rounded-xl border p-6 text-muted-foreground">Online booking isn&apos;t open right now. <Link href="/contact" className="underline">Contact us</Link> instead.</p> : (
        <ul className="space-y-3">
          {types.map((t) => {
            const Icon = ICON[t.location as keyof typeof ICON] ?? CalendarClock;
            return (
              <li key={t.slug}>
                <Link href={`/book/${t.slug}`} className="flex items-center gap-4 rounded-2xl border p-5 transition-colors hover:bg-muted/50">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted"><Icon className="size-5" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{t.name}</span>
                    <span className="block text-sm text-muted-foreground">{t.minutes} minutes{t.description ? ` · ${t.description}` : ""}</span>
                  </span>
                  <ChevronRight className="size-5 text-muted-foreground" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
