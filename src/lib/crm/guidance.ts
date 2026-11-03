// Stage guidance and Next Steps, from Channel-Cast's pipeline-guidance.ts and
// stage-config.ts. STAGE_GUIDE holds the defaults; admins override a stage's
// goal, actions and steps in Configure stages (platform_settings "crm_stages").
// Built-in steps can tick themselves from the record (`auto`).

import { STAGE_ORDER, type DealStage, type ExtraStep } from "./deals";
import type { Deal } from "./types";

export type Step = { id: string; label: string; required?: boolean; auto?: (d: Deal) => boolean };
export type StageGuide = { goal: string; actions: string[]; steps: Step[] };

const hasNextStep = (d: Deal) => Boolean(d.next_step && d.next_step_due);

export const STAGE_GUIDE: Record<DealStage, StageGuide> = {
  new_working: {
    goal: "Get the opportunity owned and the first outreach out the door.",
    actions: ["Confirm the contact details are current.", "Confirm where the lead came from.", "Make the first outreach attempt.", "Schedule the next action."],
    steps: [
      { id: "owner", label: "Owner assigned", required: true, auto: (d) => Boolean(d.owner_id) },
      { id: "contact", label: "Contact linked", required: true, auto: (d) => Boolean(d.contact_id) },
      { id: "source", label: "Lead source confirmed", auto: (d) => Boolean(d.source?.trim()) },
      { id: "outreach", label: "First outreach attempted" },
      { id: "next", label: "Next action scheduled", required: true, auto: hasNextStep },
    ],
  },
  contacted: {
    goal: "Establish two-way contact and find out what they actually need.",
    actions: ["Reach a real conversation, not just a voicemail.", "Identify the need: meetings, calls, team size.", "Find out who decides.", "Book the follow-up."],
    steps: [
      { id: "twoway", label: "Two-way contact made", required: true },
      { id: "need", label: "Need or interest identified", required: true },
      { id: "dm", label: "Decision-maker identified" },
      { id: "followup", label: "Follow-up scheduled", auto: hasNextStep },
    ],
  },
  qualified: {
    goal: "Confirm this is a real Echo opportunity worth working.",
    actions: ["Confirm the fit and use case.", "Confirm buying authority.", "Confirm timing.", "Estimate seats and plan.", "Agree the next sales action."],
    steps: [
      { id: "fit", label: "Fit confirmed", required: true },
      { id: "dm", label: "Decision-maker identified", required: true },
      { id: "type", label: "Opportunity type selected", required: true, auto: (d) => Boolean(d.opportunity_type) },
      { id: "value", label: "Estimated value entered", required: true, auto: (d) => d.value_cents > 0 },
      { id: "close", label: "Expected close date entered", required: true, auto: (d) => Boolean(d.expected_close) },
      { id: "next", label: "Next action scheduled", auto: hasNextStep },
    ],
  },
  opportunity: {
    goal: "Scope the deal: what they're buying, for how much, and by when.",
    actions: ["Scope plans, seats and add-ons.", "Confirm pricing approach.", "Map the stakeholders.", "Agree the next milestone."],
    steps: [
      { id: "products", label: "Plans and add-ons scoped", required: true, auto: (d) => d.products.length > 0 },
      { id: "stakeholders", label: "Stakeholders mapped" },
      { id: "value", label: "Value and probability current", auto: (d) => d.value_cents > 0 },
      { id: "next", label: "Next milestone agreed", auto: hasNextStep },
    ],
  },
  proposal: {
    goal: "Get a proposal in front of them and confirm it was received.",
    actions: ["Build the proposal or quote.", "Send it.", "Confirm it was reviewed.", "Handle the first round of questions.", "Book the review meeting."],
    steps: [
      { id: "created", label: "Proposal created", required: true },
      { id: "sent", label: "Proposal sent", required: true },
      { id: "reviewed", label: "Pricing reviewed with the client" },
      { id: "objections", label: "Objections captured" },
      { id: "meeting", label: "Next meeting booked", auto: hasNextStep },
    ],
  },
  negotiation: {
    goal: "Close the remaining gaps: price, terms, timing, approval.",
    actions: ["Settle final pricing and any discount.", "Move the agreement through review.", "Confirm the start date and seats.", "Confirm billing details.", "Confirm the decision date."],
    steps: [
      { id: "pricing", label: "Final pricing agreed", required: true },
      { id: "contract", label: "Agreement status known", required: true },
      { id: "dates", label: "Start date and seats confirmed" },
      { id: "billing", label: "Billing details captured" },
      { id: "decision", label: "Decision date confirmed", auto: (d) => Boolean(d.expected_close) },
    ],
  },
  closed_won: {
    goal: "Capture what was sold and hand it to onboarding.",
    actions: ["Record the final value.", "Summarize why it was won.", "Set the customer's role.", "Kick off onboarding."],
    steps: [
      { id: "value", label: "Final deal value recorded", required: true, auto: (d) => d.value_cents > 0 },
      { id: "closedate", label: "Close date recorded", required: true, auto: (d) => Boolean(d.closed_at || d.expected_close) },
      { id: "summary", label: "Won reason or summary", auto: (d) => Boolean(d.won_summary?.trim()) },
      { id: "role", label: "Customer role updated" },
    ],
  },
  closed_lost: {
    goal: "Record why, so the pattern is visible and the account can be nurtured later.",
    actions: ["Record the lost reason.", "Note the competitor if there was one.", "Decide whether to nurture."],
    steps: [
      { id: "reason", label: "Lost reason recorded", required: true, auto: (d) => Boolean(d.lost_reason) },
      { id: "notes", label: "Lost notes captured", auto: (d) => Boolean(d.lost_notes?.trim()) },
    ],
  },
  nurture: {
    goal: "Stay in touch until the timing is right.",
    actions: ["Set a revisit date.", "Keep the account on a light-touch cadence."],
    steps: [{ id: "revisit", label: "Revisit date set", auto: hasNextStep }],
  },
};

// ---------------------------------------------------------------------------
// Admin overrides (Configure stages)
// ---------------------------------------------------------------------------
export type StoredStep = { id: string; label: string; required?: boolean };
export type StoredStage = { goal: string; actions: string[]; steps: StoredStep[] };
export type StageConfig = Partial<Record<DealStage, StoredStage>>;

export function defaultStage(stage: DealStage): StoredStage {
  const g = STAGE_GUIDE[stage];
  return { goal: g.goal, actions: [...g.actions], steps: g.steps.map(({ id, label, required }) => ({ id, label, required })) };
}

export const defaultConfig = () => Object.fromEntries(STAGE_ORDER.map((s) => [s, defaultStage(s)])) as Record<DealStage, StoredStage>;

// Accepts only well-formed stored stages (the value comes from the database).
export function parseStageConfig(raw: unknown): StageConfig {
  if (!raw || typeof raw !== "object") return {};
  const out: StageConfig = {};
  for (const stage of STAGE_ORDER) {
    const s = (raw as Record<string, unknown>)[stage] as Partial<StoredStage> | undefined;
    if (!s || typeof s.goal !== "string" || !Array.isArray(s.actions) || !Array.isArray(s.steps)) continue;
    out[stage] = {
      goal: s.goal.slice(0, 300),
      actions: s.actions.filter((a): a is string => typeof a === "string").slice(0, 12).map((a) => a.slice(0, 200)),
      steps: s.steps.filter((x): x is StoredStep => Boolean(x && typeof x.id === "string" && typeof x.label === "string")).slice(0, 15)
        .map((x) => ({ id: x.id.slice(0, 40), label: x.label.slice(0, 160), required: Boolean(x.required) })),
    };
  }
  return out;
}

const autoFor = (stage: DealStage, id: string) => STAGE_GUIDE[stage].steps.find((s) => s.id === id)?.auto;

/** The team's version of a stage (or the default), plus steps added to this deal alone. */
export function resolveStage(stage: DealStage, config: StageConfig, deal?: Deal): StageGuide {
  const stored = config[stage] ?? defaultStage(stage);
  const extras = ((deal?.extra_steps ?? []) as ExtraStep[]).filter((e) => e.stage === stage);
  return {
    goal: stored.goal,
    actions: stored.actions,
    steps: [
      ...stored.steps.map((s) => ({ ...s, auto: autoFor(stage, s.id) })),
      ...extras.map(({ id, label, required }) => ({ id, label, required })),
    ],
  };
}

export type StepState = { step: Step; done: boolean; automatic: boolean; custom: boolean };

export function stepsFor(deal: Deal, config: StageConfig, stage: DealStage = deal.stage): StepState[] {
  const custom = new Set(((deal.extra_steps ?? []) as ExtraStep[]).map((e) => e.id));
  return resolveStage(stage, config, deal).steps.map((step) => {
    const automatic = Boolean(step.auto?.(deal));
    return { step, automatic, custom: custom.has(step.id), done: automatic || Boolean(deal.checklist?.[`${stage}:${step.id}`]) };
  });
}

/** Required steps still open: what blocks moving forward out of a stage. */
export const blockingSteps = (deal: Deal, config: StageConfig, stage: DealStage = deal.stage) =>
  stepsFor(deal, config, stage).filter((s) => s.step.required && !s.done).map((s) => s.step);
