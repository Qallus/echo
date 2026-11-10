import { notFound } from "next/navigation";
import { AboutStep } from "@/components/redial/setup/about-step";
import { AfterStep } from "@/components/redial/setup/after-step";
import { AssistantStep } from "@/components/redial/setup/assistant-step";
import { PhoneStep } from "@/components/redial/setup/phone-step";
import { PlanStep } from "@/components/redial/setup/plan-step";
import { ReviewStep } from "@/components/redial/setup/review-step";
import { RouteStep } from "@/components/redial/setup/route-step";
import { ScreeningStep } from "@/components/redial/setup/screening-step";
import { SetupShell } from "@/components/redial/setup/setup-shell";
import { getBillingSettings } from "@/lib/billing/settings";
import { stepAt } from "@/lib/redial/setup";
import { loadSetup, readiness } from "@/lib/redial/setup-data";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Set up Redial" };

export default async function SetupStepPage({ params }: { params: Promise<{ step: string }> }) {
  const n = Number((await params).step);
  const step = stepAt(n);
  if (!step) notFound();
  const ctx = await loadSetup();
  const { answers } = ctx.setup;
  const business = (answers.about?.accountType ?? ctx.profile.accountType) === "business";
  const forwarding = answers.route?.method === "missed" || answers.route?.method === "all";
  return (
    <SetupShell step={n} reached={ctx.setup.step} note={ctx.setup.status === "needs_info" ? ctx.setup.staff_note ?? "We need a little more information. Check your answers and finish again." : null}>
      {step.key === "about" && <AboutStep ctx={ctx} />}
      {step.key === "phone" && <PhoneStep initial={answers.phone} accountType={business ? "business" : "personal"} />}
      {step.key === "route" && <RouteStep initial={answers.route} carrierId={answers.phone?.carrier} lineType={answers.phone?.lineType} redialNumber={ctx.line?.number} />}
      {step.key === "screening" && <ScreeningStep initial={answers.screening} business={business} />}
      {step.key === "assistant" && <AssistantStep initial={answers.assistant} firstName={ctx.profile.firstName} business={business} />}
      {step.key === "after" && <AfterStep initial={answers.after} mobile={answers.about?.phone ?? ""} forwarding={forwarding} business={business} />}
      {step.key === "plan" && <PlanStep initial={answers.plan} business={business} freeMinutes={(await getBillingSettings(await createClient())).redialFreeMinutes} />}
      {step.key === "review" && <ReviewStep setup={ctx.setup} ready={readiness(ctx)} line={ctx.line} />}
    </SetupShell>
  );
}
