// The four kinds of request on the contact page (?type= in the link).
export const CONTACT_TYPES = ["residential", "business", "ai-agents", "live-agents"] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];
