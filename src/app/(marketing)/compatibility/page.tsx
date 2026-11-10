import Link from "next/link";
import { Building2, Info, PhoneIncoming, Smartphone } from "lucide-react";
import { FinalCta } from "@/components/marketing/home/final-cta";
import { CARRIERS, FORWARDING } from "@/lib/redial/carriers";

export const metadata = {
  title: "Works with your carrier · Redial",
  description: "Keep your number: forward the calls you miss, or every call, to Redial. Forwarding codes for T-Mobile, AT&T, Verizon and more, plus landlines and business phone services.",
  alternates: { canonical: "/compatibility" },
};

// Carriers, the forwarding codes setup shows, and the other ways to connect.
export default function CompatibilityPage() {
  return (
    <>
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <header className="max-w-3xl">
          <p className="text-sm font-medium text-muted-foreground">Compatibility</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">Works with the phone and number you have.</h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Redial answers through call forwarding, a feature every major carrier has. You dial a short code once, and calls you miss (or every call) go to DJ. Setup shows you the exact code with your Redial number filled in.
          </p>
        </header>

        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {[
            { icon: Smartphone, title: "Forward the calls you miss", desc: "Your phone rings first. Calls you don't answer, decline or can't get go to DJ." },
            { icon: PhoneIncoming, title: "Forward every call", desc: "Your phone stays quiet. DJ answers everything and puts the right calls through." },
            { icon: Building2, title: "Get a Redial number", desc: "A separate number to share. No forwarding needed: calls to it always reach DJ." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-2xl border p-6">
              <Icon className="size-5" />
              <h2 className="mt-4 font-semibold">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>

        <section className="mt-16">
          <h2 className="text-2xl font-semibold tracking-tight">Mobile carriers</h2>
          <p className="mt-1 text-sm text-muted-foreground"><span className="font-mono">N</span> is your Redial number. Codes can differ by plan; your carrier can always confirm.</p>
          <div className="mt-6 overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Carrier</th>
                  <th className="px-4 py-3 font-medium">Forward the calls you miss</th>
                  <th className="px-4 py-3 font-medium">Forward every call</th>
                  <th className="px-4 py-3 font-medium">Turn it off</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {CARRIERS.filter((c) => c.id !== "other").map((c) => {
                  const f = c.network ? FORWARDING[c.network] : null;
                  return (
                    <tr key={c.id} className="align-top">
                      <td className="px-4 py-3 font-medium">{c.label}</td>
                      {f ? (
                        <>
                          <td className="px-4 py-3 font-mono">{f.missed.on("N")}</td>
                          <td className="px-4 py-3 font-mono">{f.all.on("N")}</td>
                          <td className="px-4 py-3 font-mono">{f.missed.off === f.all.off ? f.missed.off : `${f.missed.off} / ${f.all.off}`}</td>
                        </>
                      ) : (
                        <td colSpan={3} className="px-4 py-3 text-muted-foreground">{c.note ?? "Set it in your carrier's app or account."}</td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 flex gap-2 text-sm text-muted-foreground">
            <Info className="mt-0.5 size-4 shrink-0" />
            {CARRIERS.filter((c) => c.network && c.note).map((c) => `${c.label}: ${c.note}`).join(" ")}
          </p>
        </section>

        <section className="mt-16 grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border p-6 md:col-span-2">
            <h2 className="text-lg font-semibold">Desk, cordless and Wi-Fi phones (SIP)</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              With Redial <Link href="/home-phone" className="underline underline-offset-4">Home Phone</Link> or <Link href="/business-phone" className="underline underline-offset-4">Business Phone</Link>, Redial is your phone line. Standard SIP phones from Grandstream (including the WP826 Wi-Fi cordless), Yealink and Poly set themselves up from Redial, and most other SIP phones work with the settings Redial shows you.
            </p>
          </div>
          <div className="rounded-2xl border p-6">
            <h2 className="text-lg font-semibold">Landlines and business phone services</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Office lines and services like RingCentral, Google Voice, Zoom Phone and Dialpad can forward calls too, usually from their admin portal or settings. Choose who should reach DJ (unanswered calls, after hours, or everything) and forward to your Redial number.
            </p>
          </div>
          <div className="rounded-2xl border p-6">
            <h2 className="text-lg font-semibold">Not sure about yours?</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Start setup and pick &ldquo;Other / not sure&rdquo;, or get a Redial number instead, which works with any phone. You can also <Link href="/contact" className="underline underline-offset-4">ask us</Link> and we&apos;ll help you set it up.
            </p>
          </div>
        </section>
      </div>
      <FinalCta title="Keep your number. Let DJ answer." />
    </>
  );
}
