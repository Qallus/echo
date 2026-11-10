import { z } from "zod";
import { SMS_FREQUENCIES } from "@/lib/waitlist-options";
import { CARRIERS } from "./carriers";
import { VOICES } from "./types";

// The Redial setup wizard (/setup): its steps and the answers each one saves
// into redial_setups.answers. Every step is optional to finish now and can be
// picked up later; each step's answers are checked here before they're saved.

export const SETUP_STEPS = [
  { n: 1, key: "about", title: "About you", short: "You" },
  { n: 2, key: "phone", title: "Your phone", short: "Phone" },
  { n: 3, key: "route", title: "How calls reach Redial", short: "Calls" },
  { n: 4, key: "screening", title: "Who gets screened", short: "Screening" },
  { n: 5, key: "assistant", title: "Your assistant", short: "Assistant" },
  { n: 6, key: "after", title: "After the call", short: "After" },
  { n: 7, key: "plan", title: "Choose a plan", short: "Plan" },
  { n: 8, key: "review", title: "Review and finish", short: "Finish" },
] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];
export const stepAt = (n: number) => SETUP_STEPS.find((s) => s.n === n) ?? null;
export const LAST_STEP = SETUP_STEPS[SETUP_STEPS.length - 1].n;

export const TEAM_SIZES = ["Just me", "2–5", "6–20", "21–100", "100+"] as const;
export const INDUSTRIES = [
  "Home services", "Real estate", "Health and wellness", "Legal", "Financial services", "Professional services",
  "Retail", "Restaurants and hospitality", "Salon and beauty", "Automotive", "Nonprofit", "Other",
] as const;
export const DEVICES = [
  { id: "iphone", label: "iPhone" },
  { id: "android", label: "Android" },
  { id: "desk", label: "Desk phone" },
  { id: "voip_app", label: "A calling app on my computer" },
] as const;
export const LINE_TYPES = [
  { id: "mobile", label: "Mobile", detail: "A cell phone plan." },
  { id: "landline", label: "Landline", detail: "A home or office line from a phone company." },
  { id: "voip", label: "Business phone service", detail: "For example RingCentral, Google Voice, Zoom Phone or Dialpad." },
] as const;
export const ROUTES = [
  { id: "missed", label: "Keep my number, forward the calls I miss", detail: "Your phone rings first. Calls you don't answer, decline or can't get go to DJ.", tag: "Most popular" },
  { id: "all", label: "Keep my number, send every call to DJ", detail: "Your phone stays quiet. DJ answers everything and puts the right calls through." },
  { id: "new_number", label: "Give me a new Redial number", detail: "A separate number to share. Calls to it always reach DJ first." },
] as const;

export const SCREEN_MODES = [
  { id: "unknown", label: "Unknown callers", detail: "Contacts and VIPs ring straight through. Everyone else talks to DJ first.", tag: "Recommended" },
  { id: "all", label: "Every call", detail: "DJ answers every call except your VIPs." },
  { id: "off", label: "Not yet", detail: "Calls ring straight through for now. Turn screening on any time." },
] as const;
export const UPDATES = [{ id: "none", label: "No thanks" }, ...SMS_FREQUENCIES] as const;

const text = (max: number) => z.string().trim().max(max);
const phone = z.string().regex(/^\+[1-9]\d{7,14}$/, "Use full phone numbers, e.g. +14805550142.");
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use times like 09:00.");
const optional = (max: number) => text(max).optional().transform((v) => v || undefined);

export const ANSWERS = {
  about: z.object({
    fullName: text(100).min(2, "Enter your name."),
    accountType: z.enum(["personal", "business"]),
    phone: z.string().regex(/^\+[1-9]\d{7,14}$/, "Enter your mobile number."),
    company: optional(120),
    teamSize: z.enum(TEAM_SIZES).optional(),
    industry: z.enum(INDUSTRIES).optional(),
    website: optional(200),
  }).refine((a) => a.accountType !== "business" || a.company, { message: "Enter your business name.", path: ["company"] }),
  phone: z.object({
    carrier: z.enum(CARRIERS.map((c) => c.id) as [string, ...string[]], { message: "Pick your carrier." }),
    device: z.enum(DEVICES.map((d) => d.id) as [string, ...string[]], { message: "Pick your phone." }),
    lineType: z.enum(LINE_TYPES.map((l) => l.id) as [string, ...string[]], { message: "Pick what kind of line it is." }),
    provider: optional(80),
  }),
  route: z.object({
    method: z.enum(ROUTES.map((r) => r.id) as [string, ...string[]], { message: "Pick how calls should reach Redial." }),
  }),
  screening: z.object({
    mode: z.enum(["unknown", "all", "off"]),
    vip: z.array(phone).max(20, "Up to 20 VIP numbers here; add more later."),
    block: z.array(phone).max(20, "Up to 20 blocked numbers here; add more later."),
    hours: z.object({ start: time, end: time, weekdays: z.boolean() }).optional(),
  }),
  assistant: z.object({
    name: text(40).min(1, "Give your assistant a name."),
    voice: z.enum(VOICES.map((v) => v.id) as [string, ...string[]]),
    disclose: z.boolean(),
    greeting: optional(500),
    about: optional(4000),
  }),
  after: z.object({
    forwardTo: phone.optional(),
    putThrough: z.boolean(),
    alerts: z.object({ push: z.boolean(), sms: z.boolean(), email: z.boolean() }),
    directory: z.array(z.object({ label: text(80).min(1, "Name each transfer contact."), number: phone })).max(10),
  }),
  plan: z.object({
    priceKey: z.string().max(60).nullable(),
    quantity: z.number().int().min(1).max(100),
  }),
  review: z.object({
    terms: z.literal(true, { message: "Agree to the terms to finish." }),
    updates: z.enum(UPDATES.map((u) => u.id) as [string, ...string[]]),
  }),
} as const;

export type AboutAnswers = z.infer<typeof ANSWERS.about>;
export type PhoneAnswers = z.infer<typeof ANSWERS.phone>;
export type RouteAnswers = z.infer<typeof ANSWERS.route>;
export type ScreeningAnswers = z.infer<typeof ANSWERS.screening>;
export type AssistantAnswers = z.infer<typeof ANSWERS.assistant>;
export type AfterAnswers = z.infer<typeof ANSWERS.after>;
export type PlanAnswers = z.infer<typeof ANSWERS.plan>;
export type ReviewAnswers = z.infer<typeof ANSWERS.review>;
export type SetupAnswers = {
  about?: Partial<AboutAnswers>; phone?: Partial<PhoneAnswers>; route?: Partial<RouteAnswers>; screening?: Partial<ScreeningAnswers>;
  assistant?: Partial<AssistantAnswers>; after?: Partial<AfterAnswers>; plan?: Partial<PlanAnswers>; review?: Partial<ReviewAnswers>;
};

// The greeting DJ uses when the person doesn't write one. Saying it's an AI
// assistant is their choice.
export function setupGreeting(name: string, first: string, disclose: boolean) {
  const whose = first ? `${first}'s` : "your";
  return `Hi, this is ${name || "DJ"}, ${whose} ${disclose ? "AI assistant" : "assistant"}. ${first || "They"} can't pick up right now. May I ask who's calling and what it's about?`;
}
export type Setup = { step: number; status: "draft" | "submitted" | "active" | "needs_info"; answers: SetupAnswers; line_id: string | null; staff_note: string | null };
