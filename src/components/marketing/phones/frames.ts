import type { ScreenFrame } from "./phone-art";

// What the drawn phones' screens step through. {agent} is the rotating
// assistant name.

// The home phone: a screened call, then a blocked robocall.
export const HOME_FRAMES: ScreenFrame[] = [
  { tag: "Incoming", title: "(602) 555-0142", detail: "Unknown caller", soft: ["Answer", "Redial", "Decline"], tone: "call" },
  { tag: "{agent} is answering", title: "Dr. Patel's office", detail: "“Calling to confirm Tuesday's appointment.”", soft: ["Menu", "Listen", "History"], tone: "dj" },
  { tag: "{agent} screened it", title: "Dr. Patel's office", detail: "Appointment reminder. Press 1 to take it.", soft: ["Answer", "Press 1", "Decline"], tone: "dj" },
  { tag: "Blocked", title: "Car warranty robocall", detail: "{agent} hung up. Your phones never rang.", tone: "blocked" },
];

// The business desk phone: a new lead, a transfer, an after-hours callback.
export const BUSINESS_FRAMES: ScreenFrame[] = [
  { tag: "Incoming · Main line", title: "(480) 555-0187", detail: "New caller", soft: ["Answer", "Redial", "Decline"], tone: "call" },
  { tag: "{agent} is answering", title: "Dana Ortiz · Summit Roofing", detail: "“Looking for a quote on a roof repair.”", soft: ["Menu", "Listen", "History"], tone: "dj" },
  { tag: "Transfer from {agent}", title: "Dana Ortiz → Sales (101)", detail: "Wants a roof repair quote this week. Press 1 to take it.", soft: ["Answer", "Press 1", "Decline"], tone: "dj" },
  { tag: "After hours", title: "Callback booked", detail: "Dana Ortiz, 8:30 AM tomorrow. Summary sent to the team.", tone: "dj" },
];
