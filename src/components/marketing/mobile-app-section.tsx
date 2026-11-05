import { AudioLines, BatteryFull, Bell, Headphones, Inbox, Mic, PhoneCall, Settings, Signal, Sparkles, Wifi } from "lucide-react";
import { FEATURES } from "@/lib/redial/features";
import { AppBadges } from "./app-badges";
import { PhoneCallDemo } from "./phone-call-demo";

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

// A phone frame with the app's live call screen inside, playing a short
// Redial call. Decorative.
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
            <span className="ml-auto rounded-full bg-primary px-1.5 text-[9px] font-medium text-primary-foreground">Live</span>
          </div>
          <PhoneCallDemo />
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
