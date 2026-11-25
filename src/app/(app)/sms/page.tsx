import Link from "next/link";
import { ArrowRight, MessageSquareText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ComingSoon } from "@/components/shell/coming-soon";
import { LineTexts, type LineText, type TextPerson } from "@/components/redial/line-texts";
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
  const people: TextPerson[] = contacts.filter((c) => c.phone)
    .map((c) => ({ id: c.id, name: [c.first_name, c.last_name].filter(Boolean).join(" ") || c.phone!, phone: c.phone! }));

  return (
    <div className="w-full space-y-4 px-4 py-6 sm:px-6 lg:px-8 2xl:px-10">
      <div className="max-md:sr-only">
        <h1 className="text-2xl font-semibold tracking-tight">SMS</h1>
        <p className="text-sm text-muted-foreground">Texts on your Redial number{lines.length > 1 ? "s" : ""}. People who reply STOP aren&apos;t texted until they reply START.</p>
      </div>
      <LineTexts lines={lines.map((l) => ({ id: l.id, number: l.number, label: l.label }))} texts={texts} people={people} optOuts={[...stopped]} />
    </div>
  );
}
