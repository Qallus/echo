import Link from "next/link";
import { Briefcase, Check, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Pricing · Echo",
  description: "Echo is free during the trial, for Personal and Business accounts.",
};

const PLANS = [
  {
    icon: Lock, name: "Personal", who: "For your own calls and meetings.",
    features: ["Unlimited recordings during the trial", "Browser recording with notes and flags", "Automatic transcripts with speakers", "Search and Ask Echo", "Claude connector"],
  },
  {
    icon: Briefcase, name: "Business", who: "For a company or team that shares recordings.",
    features: ["Everything in Personal", "A shared Business workspace", "Invite teammates as admins or members", "Move recordings between Business and Personal", "Each person keeps a private Personal space"],
  },
];

export default function PricingPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6 sm:py-24">
      <div className="text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Free during the trial</h1>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Every feature is unlocked with unlimited minutes while Echo is in its trial. Paid plans will be announced
          ahead of time, and nothing is charged without your agreement.
        </p>
      </div>
      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {PLANS.map(({ icon: Icon, name, who, features }) => (
          <div key={name} className="flex flex-col rounded-2xl border p-6">
            <Icon className="mb-3 size-5" />
            <h2 className="text-xl font-semibold">{name}</h2>
            <p className="text-sm text-muted-foreground">{who}</p>
            <p className="mt-4 text-3xl font-semibold">$0 <span className="text-base font-normal text-muted-foreground">during the trial</span></p>
            <ul className="mt-6 flex-1 space-y-2 text-sm">
              {features.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0" /> {f}</li>)}
            </ul>
            <Button className="mt-6" nativeButton={false} render={<Link href={name === "Business" ? "/signup?type=business" : "/signup"} />}>Start with {name}</Button>
          </div>
        ))}
      </div>
    </div>
  );
}
