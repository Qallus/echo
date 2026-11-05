import { AudioLines, BatteryFull, Bell, Bot, Gavel, Headphones, Inbox, Mic, PhoneCall, PhoneForwarded, Settings, Signal, Sparkles, Wifi } from "lucide-react";
import { FEATURES } from "@/lib/redial/features";
import { AppBadges } from "./app-badges";

// Home page: the Echo app for iPhone and Android. Text, the store buttons
// under it, and a phone showing the app's live call screen.

const POINTS = [
  { icon: Bell, title: "Know when your assistant is screening", desc: "A quiet alert, not a ringing phone. Open it to see who's calling and why." },
  { icon: Headphones, title: "Step in from anywhere", desc: `${FEATURES.insider.action}, guide your assistant, ${FEATURES.gavel.action.toLowerCase()} or transfer, on the same call.` },
  { icon: Mic, title: "Record on the go", desc: "Capture a meeting or call from your phone and get the transcript and summary like on the web." },
  { icon: Sparkles, title: "Your whole library, in your pocket", desc: "Messages, callbacks, recordings and Ask Echo, with the same account as the web." },
];

export function MobileAppSection() {
  return (
    <section id="app" className="scroll-mt-20">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-20 sm:px-6 md:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Mobile app</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">Echo and Redial, in your pocket</h2>
          <p className="mt-3 max-w-xl text-muted-foreground">
            One app for your calls and your conversations. Your assistant answers on the server, so screening works whether the app is open or not.
          </p>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2">
            {POINTS.map(({ icon: Icon, title, desc }) => (
              <li key={title} className="space-y-1">
                <Icon className="size-5" />
                <h3 className="font-medium">{title}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </li>
            ))}
          </ul>
          <AppBadges source="home-app-section" className="mt-8" />
        </div>
        <Phone />
      </div>
    </section>
  );
}

// A phone frame with the app's live call screen inside. Decorative.
function Phone() {
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-[300px]">
      <div className="relative rounded-[3rem] bg-neutral-900 p-[3.5%] shadow-2xl shadow-black/25 ring-1 ring-black/10 dark:ring-white/15">
        <span className="absolute top-[18%] -left-[3px] h-[7%] w-[3px] rounded-l bg-neutral-700" />
        <span className="absolute top-[24%] -right-[3px] h-[14%] w-[3px] rounded-r bg-neutral-700" />
        <div className="relative flex aspect-[9/19.5] flex-col overflow-hidden rounded-[2.5rem] bg-background text-[11px]">
          <span className="absolute top-2 left-1/2 h-5 w-24 -translate-x-1/2 rounded-full bg-neutral-900" />
          <div className="flex h-9 shrink-0 items-end justify-between px-6 pb-1 text-[10px] font-semibold">
            <span>9:41</span><span className="flex items-center gap-1"><Signal className="size-3" /><Wifi className="size-3" /><BatteryFull className="size-3.5" /></span>
          </div>
          <div className="flex items-center gap-1.5 border-b px-4 py-2.5">
            <PhoneCall className="size-3.5" /><span className="text-xs font-semibold">Calls</span>
            <span className="ml-auto rounded-full bg-primary px-1.5 text-[9px] font-medium text-primary-foreground">2 new</span>
          </div>
          <div className="flex-1 space-y-2.5 overflow-hidden p-3">
            <div className="space-y-2 rounded-xl border border-primary/40 bg-primary/5 p-2.5">
              <div className="flex items-center gap-1.5">
                <span className="size-1.5 animate-pulse rounded-full bg-primary" />
                <span className="font-semibold">Live: Dana Ortiz</span><span className="ml-auto tabular-nums text-muted-foreground">0:42</span>
              </div>
              <div className="flex max-w-[90%] gap-1.5 rounded-lg bg-muted px-2 py-1.5"><Bot className="mt-px size-3 shrink-0" />Thanks, Dana. What time should the crew arrive?</div>
              <div className="ml-auto max-w-[85%] rounded-lg bg-primary/10 px-2 py-1.5">Around 8am works.</div>
              <div className="grid grid-cols-3 gap-1 pt-0.5 text-[9px]">
                <span className="flex flex-col items-center gap-0.5 rounded-md border py-1.5"><Headphones className="size-3" />{FEATURES.insider.action}</span>
                <span className="flex flex-col items-center gap-0.5 rounded-md bg-foreground py-1.5 text-background"><Gavel className="size-3" />{FEATURES.gavel.action}</span>
                <span className="flex flex-col items-center gap-0.5 rounded-md border py-1.5"><PhoneForwarded className="size-3" />{FEATURES.directory.action}</span>
              </div>
            </div>
            {[
              { who: "Mike Chen", what: "Wants a quote for a roof inspection next week.", tag: "Business" },
              { who: "(602) 555-0188", what: "Sales call about a car warranty. Message taken.", tag: "Sales" },
              { who: "Mom", what: "VIP, rang straight through.", tag: "Personal" },
            ].map((c) => (
              <div key={c.who} className="rounded-xl border p-2.5">
                <div className="flex items-center justify-between"><span className="font-medium">{c.who}</span><span className="text-[9px] text-muted-foreground">{c.tag}</span></div>
                <p className="text-muted-foreground">{c.what}</p>
              </div>
            ))}
          </div>
          <div className="grid shrink-0 grid-cols-4 border-t px-2 py-2 text-[9px] text-muted-foreground">
            <span className="flex flex-col items-center gap-0.5 text-foreground"><Inbox className="size-3.5" />Calls</span>
            <span className="flex flex-col items-center gap-0.5"><AudioLines className="size-3.5" />Echo</span>
            <span className="flex flex-col items-center gap-0.5"><Sparkles className="size-3.5" />Ask</span>
            <span className="flex flex-col items-center gap-0.5"><Settings className="size-3.5" />Settings</span>
          </div>
          <div className="flex h-5 shrink-0 items-center justify-center"><span className="h-1 w-24 rounded-full bg-foreground/80" /></div>
        </div>
      </div>
    </div>
  );
}
