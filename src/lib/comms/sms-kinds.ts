// Bulk text options shared by the admin screens and the sender. Waitlist
// people choose how often they're texted (app_waitlist.sms_frequency) and
// which updates they want (update_topics); a bulk text says what kind of
// message it is, and only goes to people whose choice allows it and who
// haven't had a bulk text too recently.

export const SMS_KINDS = {
  major: { label: "Major announcement", hint: "Launches and big news. Goes to everyone who agreed to texts.", allows: ["major", "monthly", "weekly", "all"], gapDays: 1 },
  monthly: { label: "Monthly update", hint: "People who chose monthly or more. Skips anyone texted in the last 25 days.", allows: ["monthly", "weekly", "all"], gapDays: 25 },
  weekly: { label: "Weekly update", hint: "People who chose weekly or more. Skips anyone texted in the last 6 days.", allows: ["weekly", "all"], gapDays: 6 },
  update: { label: "Any update", hint: "Only people who chose every update. Skips anyone texted in the last day.", allows: ["all"], gapDays: 1 },
} as const;
export type SmsKind = keyof typeof SMS_KINDS;
export const isSmsKind = (k: unknown): k is SmsKind => typeof k === "string" && k in SMS_KINDS;

export const SMS_TOPICS = [
  { value: "launch", label: "Launch news" }, { value: "beta", label: "Beta invites" }, { value: "features", label: "New features" },
  { value: "tips", label: "Tips" }, { value: "offers", label: "Offers" },
] as const;
export const SMS_PRODUCTS = [{ value: "echo", label: "Echo" }, { value: "redial", label: "Redial" }] as const;

export const SMS_CAP = 2000;
export const STOP_LINE = "Reply STOP to opt out.";
// Texts are billed per 160-character segment (70 when there's an emoji or other non-GSM character).
export const smsSegments = (body: string) => {
  const unicode = /[^\n\r -~£¥èéùìòÇØøÅåÄÖÑÜ§¿äöñüà€^{}\\[~\]|]/.test(body);
  const per = unicode ? 70 : 160, multi = unicode ? 67 : 153;
  return body.length <= per ? 1 : Math.ceil(body.length / multi);
};
// Quiet hours for bulk texts: only 8am to 9pm in the business's time zone.
export const QUIET = { from: 8, to: 21 };
