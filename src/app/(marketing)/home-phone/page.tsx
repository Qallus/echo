import Link from "next/link";
import {
  ArrowRight, BellRing, CalendarClock, FileText, Hash, HeartHandshake, MapPin, PhoneForwarded, ShieldBan, Smartphone, UsersRound, Voicemail,
} from "lucide-react";
import { FaqSection } from "@/components/marketing/faq-list";
import { FinalCta } from "@/components/marketing/home/final-cta";
import { CompareTable } from "@/components/marketing/phones/compare-table";
import { HOME_FRAMES } from "@/components/marketing/phones/frames";
import { CordlessPhone } from "@/components/marketing/phones/phone-art";
import { PlanCompare } from "@/components/marketing/phones/plan-compare";
import { EmergencyNotice, FaqJsonLd, FeatureGrid, SectionHead, StepsSection, SupportedPhones } from "@/components/marketing/phones/sections";
import { Button } from "@/components/ui/button";
import { FAQ_TOPICS } from "@/lib/faq";
import { AgentName } from "@/components/marketing/agent-name";

export const metadata = {
  title: "Redial Home Phone · A home phone that screens its own calls",
  description: "Replace your landline with Redial Home Phone: keep your number or get a new one, use cordless and Wi-Fi phones like the Grandstream WP826, and let your AI assistant answer spam and unknown callers. Unlimited US and Canada calling, 911 with your address.",
  alternates: { canonical: "/home-phone" },
};

const STEPS = [
  { title: "Pick your number", desc: "Get a new local number in minutes, or bring the home number you've had for years." },
  { title: "Connect your phone", desc: "Set a Wi-Fi cordless like the WP826 on its stand, or plug a desk phone into your router." },
  { title: "It sets itself up", desc: "Type in the setup address Redial gives you once. The phone downloads its settings and is ready." },
  { title: "{agent} answers for you", desc: "Family rings straight through. Unknown callers meet {agent} first, and spam never rings at all." },
];

const FEATURES = [
  { icon: ShieldBan, title: "Spam never rings", desc: "Robocalls and sales pitches are stopped before a single phone in the house rings." },
  { icon: HeartHandshake, title: "Family always gets through", desc: "Put family, school and the doctor on your VIP list and they ring right away." },
  { icon: BellRing, title: "Every phone rings together", desc: "Cordless handsets around the house, the desk phone and the Redial app on your mobile." },
  { icon: Voicemail, title: "Voicemail you can read", desc: "Messages are transcribed and summarized, so you know what's urgent without listening." },
  { icon: CalendarClock, title: "Callbacks, booked", desc: "When you can't take a call, {agent} takes a message and a good time to call back." },
  { icon: UsersRound, title: "Share the line", desc: "Give your partner or a parent their own access, and choose what they can do." },
];

const COMPARE = [
  { feature: "Spam and robocalls stopped before they ring", cells: [true, false, "Basic spam filter"] },
  { feature: "Caller says who and why before you answer", cells: [true, false, false] },
  { feature: "Rings your mobile along with the house phones", cells: [true, false, "Sometimes"] },
  { feature: "Written summary of every call", cells: [true, false, false] },
  { feature: "Voicemail transcribed", cells: [true, false, "Sometimes"] },
  { feature: "Keep your current number", cells: [true, true, true] },
  { feature: "911 with your address", cells: ["Yes, registered address", "Yes", "Yes, registered address"] },
  { feature: "Works in a power outage", cells: ["With router backup power", "Copper lines usually do", "With router backup power"] },
  { feature: "Needs a phone jack and a phone company line", cells: [false, true, false] },
  { feature: "Long-term contract", cells: ["No, month to month", "Often", "Varies"] },
];

const FAQ = FAQ_TOPICS.find((t) => t.id === "phones")?.items ?? [];

export default function HomePhonePage() {
  return (
    <>
      <FaqJsonLd items={FAQ} />
      <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 pt-16 pb-16 sm:px-6 sm:pt-24 lg:grid-cols-[1fr_auto] lg:gap-16">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Redial Home Phone</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-6xl">Your home phone, with <AgentName /> on the line.</h1>
          <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
            A home phone line that runs over your internet, on real cordless and desk phones. <AgentName /> answers unknown callers, stops spam before it rings, and tells you who&apos;s calling and why.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" nativeButton={false} render={<Link href="/pricing#phone-service" />}>Get Redial Home Phone <ArrowRight /></Button>
            <Button size="lg" variant="outline" nativeButton={false} render={<Link href="#how" />}>How it works</Button>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Unlimited US and Canada calling. No contract. Keep your number.</p>
        </div>
        <CordlessPhone frames={HOME_FRAMES} />
      </section>

      <StepsSection id="how" eyebrow="How it works" title="From landline to Redial in an afternoon." steps={STEPS} />

      <section className="border-t bg-muted/30">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <SectionHead eyebrow="Your phone number" title="Keep the number everyone knows, or start fresh." />
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border bg-background p-6">
              <Hash className="size-5" />
              <h3 className="mt-4 font-semibold">Bring your home number</h3>
              <p className="mt-1 text-sm text-muted-foreground">We move your number from the phone company to Redial (called porting). It usually takes one to two weeks, and your old line keeps working until the move is done.</p>
              <Link href="/contact" className="mt-4 inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline">Ask about moving your number <ArrowRight className="size-3.5" /></Link>
            </div>
            <div className="rounded-2xl border bg-background p-6">
              <MapPin className="size-5" />
              <h3 className="mt-4 font-semibold">Get a new local number</h3>
              <p className="mt-1 text-sm text-muted-foreground">Pick a number with your area code and start using it the same day. You can move your old number over later.</p>
            </div>
          </div>
        </div>
      </section>

      <SupportedPhones title="Use the phones you like." sub="Wi-Fi cordless phones like the Grandstream WP826 go anywhere your Wi-Fi does. DECT cordless sets and desk phones plug into your router. The Redial app turns your mobile into another extension." />

      <FeatureGrid eyebrow="Made for home" title="The house phone, without the interruptions." items={FEATURES} />

      <section className="border-t">
        <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
          <SectionHead eyebrow="Compare" title="Redial Home Phone vs. a landline." sub="What you get compared with a traditional landline from the phone company and a typical internet home phone service." />
          <div className="mt-10">
            <CompareTable caption="Redial Home Phone compared with a traditional landline and basic internet home phone service" columns={["Redial Home Phone", "Traditional landline", "Basic internet home phone"]} rows={COMPARE} />
          </div>
          <p className="mt-4 text-sm text-muted-foreground">Features vary by provider and plan. Check your current provider for the details of your line.</p>
        </div>
      </section>

      <PlanCompare ids={["redial_home_phone", "redial_personal", "free"]} title="A full phone line, or screening for your cell." sub="Home Phone is a complete phone line with phones in the house. Personal and Free put {agent} on your mobile number instead." />

      <section className="border-t">
        <div className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-16 sm:px-6 md:grid-cols-3">
          {[
            { icon: Smartphone, title: "No home phones?", desc: "Redial Personal screens the calls to your mobile instead.", href: "/#redial" },
            { icon: PhoneForwarded, title: "Running a business?", desc: "Redial Business Phone adds desk phones, extensions and a receptionist.", href: "/business-phone" },
            { icon: FileText, title: "Every call written down", desc: "Echo turns calls into transcripts and notes you can search.", href: "/#features" },
          ].map(({ icon: Icon, title, desc, href }) => (
            <Link key={title} href={href} className="rounded-2xl border p-6 transition-colors hover:bg-muted/40">
              <Icon className="size-5" />
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <EmergencyNotice />
      <FaqSection items={FAQ} title="Home phone questions" />
      <FinalCta title="Hang up on spam for good." sub="Keep your number, use phones you love, and let {agent} answer the rest." />
    </>
  );
}
