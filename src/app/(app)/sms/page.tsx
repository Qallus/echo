import Link from "next/link";
import { ArrowRight, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ComingSoon } from "@/components/shell/coming-soon";
import { LineTexts, type LineText, type ScheduledText, type TextPack, type TextPerson } from "@/components/redial/line-texts";
import { loadCatalog } from "@/lib/billing/catalog-server";
import { money, products } from "@/lib/billing/catalog";
import { lineSmsUsage } from "@/lib/sms/server";
import { requireUser } from "@/lib/data";
import { listContacts } from "@/lib/crm/data";
import { workspaceCrmReady } from "@/lib/crm/scope";
import { myLines } from "@/lib/redial/data";
import { columnReady } from "@/lib/schema-ready";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "SMS · Redial" };

// Texts on your Redial line(s): two-way conversations, new texts to one
// person or several, and STOP honored.
export default async function SmsPage() {
  await requireUser();
  if (!(await columnReady("phone_messages", "line_id"))) {
    return <ComingSoon title="SMS" what="Text customers and contacts from your own Redial number, with every conversation in one place."
      points={["Two-way texts from your Redial line", "Search contacts or type any number", "Text several people at once", "Opt-outs (STOP) handled for you"]}
      meanwhile={{ href: "/calls?tab=phone", label: "Open the Dialpad" }} />;
  }
  const lines = (await myLines()).filter((l) => l.access.owner || l.access.capabilities.includes("send_texts"));
  if (!lines.length) {
    return (
      <div className="w-full space-y-4 px-4 py-10 text-center sm:px-6">
        <MessageSquareText className="mx-auto size-8 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Text from your own Redial number</h1>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">Set up Redial to get a number (or bring yours), then your texts show up here.</p>
        <Button nativeButton={false} render={<Link href="/setup" />}>Set up Redial <ArrowRight /></Button>
      </div>
    );
  }
  const supabase = await createClient();
  const [{ data }, contacts] = await Promise.all([
    supabase.from("phone_messages").select("id, line_id, direction, from_number, to_number, body, status, error, media, read_at, created_at")
      .in("line_id", lines.map((l) => l.id)).order("created_at", { ascending: false }).limit(2000),
    (await workspaceCrmReady()) ? listContacts().catch(() => []) : Promise.resolve([]),
  ]);
  const texts = (data ?? []) as LineText[];
  const others = [...new Set(texts.map((t) => (t.direction === "inbound" ? t.from_number : t.to_number)))];
  const stopped = new Set<string>();
  for (const l of lines) {
    const { data: out } = others.length ? await supabase.rpc("line_opt_outs", { p_line: l.id, p_numbers: others.slice(0, 200) }) : { data: [] };
    for (const n of (out ?? []) as string[]) stopped.add(n);
  }
  // Texts left (counted for each line's owner; your own line first), packs to buy, and scheduled texts.
  const own = lines.find((l) => l.access.owner) ?? lines[0];
  const [usage, sched] = await Promise.all([
    lineSmsUsage(supabase, own.id),
    supabase.from("line_scheduled_texts").select("id, line_id, to_numbers, body, send_at, status, sent, failed, error")
      .in("line_id", lines.map((l) => l.id)).order("send_at", { ascending: false }).limit(100),
    loadCatalog(),
  ]);
  const packs: TextPack[] = products().filter((p) => p.meter === "sms" && p.active !== false).flatMap((p) => {
    const price = p.prices.find((x) => x.active !== false && x.unitAmount != null);
    if (!price || !p.minutes) return [];
    return [{ key: price.key, name: p.name, price: money(price.unitAmount!), texts: p.minutes, monthly: p.kind !== "pack", perText: `${(price.unitAmount! / p.minutes).toFixed(2)}¢` }];
  });
  const people: TextPerson[] = contacts.filter((c) => c.phone)
    .map((c) => ({ id: c.id, name: [c.first_name, c.last_name].filter(Boolean).join(" ") || c.phone!, phone: c.phone! }));

  return (
    <div className="w-full space-y-4 px-4 py-6 sm:px-6 lg:px-8 2xl:px-10">
      <div className="max-md:sr-only">
        <h1 className="text-2xl font-semibold tracking-tight">SMS</h1>
        <p className="text-sm text-muted-foreground">Texts on your Redial number{lines.length > 1 ? "s" : ""}. People who reply STOP aren&apos;t texted until they reply START.</p>
      </div>
      <LineTexts lines={lines.map((l) => ({ id: l.id, number: l.number, label: l.label }))} texts={texts} people={people} optOuts={[...stopped]}
        balance={usage ? { used: usage.used, allowance: usage.allowance, remaining: usage.remaining } : null} packs={packs}
        scheduled={(sched.data ?? []) as ScheduledText[]} />
    </div>
  );
}
