import { z } from "zod";
import { CARRIERS } from "./carriers";

// The Redial setup wizard (/setup): its steps and the answers each one saves
// into redial_setups.answers. Every step is optional to finish now and can be
// picked up later; each step's answers are checked here before they're saved.

export const SETUP_STEPS = [
  { n: 1, key: "about", title: "About you", short: "You" },
  { n: 2, key: "phone", title: "Your phone", short: "Phone" },
  { n: 3, key: "route", title: "How calls reach Redial", short: "Calls" },
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

const text = (max: number) => z.string().trim().max(max);
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
} as const;

export type AboutAnswers = z.infer<typeof ANSWERS.about>;
export type PhoneAnswers = z.infer<typeof ANSWERS.phone>;
export type RouteAnswers = z.infer<typeof ANSWERS.route>;
export type SetupAnswers = { about?: Partial<AboutAnswers>; phone?: Partial<PhoneAnswers>; route?: Partial<RouteAnswers> };
export type Setup = { step: number; status: "draft" | "submitted" | "active" | "needs_info"; answers: SetupAnswers; line_id: string | null };
