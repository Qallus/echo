// The short Redial call the website's mobile section plays: the assistant
// screens Mike, you take over with Gavel, and the rest is recorded. Times are
// ms from the start of the loop. No imports, so the app (mobile/) could share
// this file as is (its welcome screen has its own call, mobile/src/lib/welcome-call.ts).

export type DemoLine = { at: number; who: "ai" | "caller" | "you"; text: string };

export const DEMO_CALL = {
  number: "(602) 555-0117",
  caller: "Mike · Strategic Income Group",
  lines: [
    { at: 1500, who: "ai", text: "Hi, this is Jeremy's assistant. How can I help you?" },
    { at: 4500, who: "caller", text: "Is Jeremy available?" },
    { at: 6800, who: "ai", text: "He's currently busy. Is there something I can help you with?" },
    { at: 10000, who: "caller", text: "This is Mike from Strategic Income Group." },
    { at: 16000, who: "you", text: "Hey Mike, how are you doing?" },
    { at: 18800, who: "caller", text: "I'm doing great!" },
  ] as DemoLine[],
  named: 10000, // Mike says who he is
  press: 12500, // you tap Gavel
  tookOver: 14000,
  ended: 21500,
  loop: 25000,
};
