import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, MapPin, Monitor, Users } from "lucide-react";
import { eventWhen, type PublicEvent } from "@/lib/bookings/events";
import { createClient } from "@/lib/supabase/server";
import { RegisterForm } from "./register-form";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("events_public", { p_slug: slug }).maybeSingle<PublicEvent>();
  return { title: data ? `${data.title} · Echo` : "Event · Echo", description: data?.summary ?? undefined, alternates: { canonical: `/book/events/${slug}` } };
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,80}$/.test(slug)) notFound();
  const supabase = await createClient();
  const { data: e } = await supabase.rpc("events_public", { p_slug: slug }).maybeSingle<PublicEvent>();
  if (!e) notFound();
  const full = e.spots_left === 0;
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-5">
        <Link href="/book" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> All events and bookings</Link>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{e.title}</h1>
        {e.summary && <p className="text-lg text-muted-foreground">{e.summary}</p>}
        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-2"><CalendarClock className="size-4 text-muted-foreground" /> {eventWhen(e, e.timezone)}{e.all_day ? "" : ` (${e.timezone.split("/").pop()!.replace("_", " ")} time)`}</li>
          {e.location_kind !== "online" && e.location && <li className="flex items-center gap-2"><MapPin className="size-4 text-muted-foreground" /> {e.location}</li>}
          {e.location_kind !== "in_person" && <li className="flex items-center gap-2"><Monitor className="size-4 text-muted-foreground" /> Online: the link is emailed when you register</li>}
          {e.spots_left != null && <li className="flex items-center gap-2"><Users className="size-4 text-muted-foreground" /> {full ? "Full" : `${e.spots_left} spot${e.spots_left === 1 ? "" : "s"} left`}</li>}
        </ul>
        {e.description && <div className="max-w-prose space-y-3 text-sm leading-relaxed whitespace-pre-wrap">{e.description}</div>}
      </div>
      <aside className="lg:sticky lg:top-24 lg:self-start">
        {!e.registration_open ? <p className="rounded-2xl border p-6 text-muted-foreground">Registration for this event is closed.</p>
          : full ? <p className="rounded-2xl border p-6 text-muted-foreground">This event is full. <Link href="/contact" className="underline">Contact us</Link> to join the waitlist.</p>
            : <RegisterForm slug={e.slug} title={e.title} maxGuests={Math.min(e.spots_left ?? 10, 10)} />}
      </aside>
    </div>
  );
}
