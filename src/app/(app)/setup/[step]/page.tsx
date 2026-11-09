import { notFound } from "next/navigation";
import { AboutStep } from "@/components/redial/setup/about-step";
import { PhoneStep } from "@/components/redial/setup/phone-step";
import { RouteStep } from "@/components/redial/setup/route-step";
import { SetupShell } from "@/components/redial/setup/setup-shell";
import { stepAt } from "@/lib/redial/setup";
import { loadSetup } from "@/lib/redial/setup-data";

export const metadata = { title: "Set up Redial" };

export default async function SetupStepPage({ params }: { params: Promise<{ step: string }> }) {
  const n = Number((await params).step);
  const step = stepAt(n);
  if (!step) notFound();
  const ctx = await loadSetup();
  const { answers } = ctx.setup;
  return (
    <SetupShell step={n} reached={ctx.setup.step}>
      {step.key === "about" && <AboutStep ctx={ctx} />}
      {step.key === "phone" && <PhoneStep initial={answers.phone} accountType={answers.about?.accountType ?? ctx.profile.accountType} />}
      {step.key === "route" && <RouteStep initial={answers.route} carrierId={answers.phone?.carrier} lineType={answers.phone?.lineType} />}
    </SetupShell>
  );
}
