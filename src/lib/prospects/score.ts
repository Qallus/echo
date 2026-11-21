import type { Confidence, Provider } from "./carriers";

// Prospect priority, 0 to 100. Weights and lists are plain data so they can
// be tuned here. Spec: docs/Prospecting/06-PROSPECT-CARRIER-LOOKUP.md section 5.

export const PROVIDER_POINTS: Partial<Record<Provider, number>> = {
  ringcentral: 30, // confirmed; "possible" gets POSSIBLE_POINTS
  mobile: 25, // owner answering on a cell: best fit for forwarding
  lumen: 20,
  landline: 20,
  cox: 20,
  spectrum: 20,
  other_voip: 10,
};
const POSSIBLE_POINTS = 10;

// Top segments (+20) and home cities (+10).
export const TOP_SEGMENTS = /financ|insur|hvac|plumb|electric|roof|landscap|pest|clean|home service|contractor|dental|dentist|medical|clinic|chiro|vet|law|legal|attorney/i;
export const HOME_CITIES = /chandler|gilbert|mesa|tempe|sun lakes/i; // the East Valley

export type ScoreInput = {
  provider: Provider | null; confidence: Confidence | null; category: string | null; city: string | null;
  website: string | null; status: string;
};

export function scoreProspect(p: ScoreInput): number {
  if (p.status === "dnc" || p.status === "won") return 0;
  let s = 0;
  if (p.provider) s += p.confidence === "possible" && p.provider === "ringcentral" ? POSSIBLE_POINTS : PROVIDER_POINTS[p.provider] ?? 0;
  if (p.category && TOP_SEGMENTS.test(p.category)) s += 20;
  if (p.city && HOME_CITIES.test(p.city)) s += 10;
  if (p.website) s += 5;
  return Math.min(100, s);
}
