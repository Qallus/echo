import type { Line } from "./types";

// What the screening assistant is told, and the tools it can call. The
// gateway enforces the limits; these instructions shape the conversation.

export function defaultGreeting(line: Pick<Line, "assistant_name">, ownerFirst: string) {
  return `Hi, this is ${line.assistant_name}, ${ownerFirst}'s assistant. ${ownerFirst} can't pick up right now. May I ask who's calling and what it's about?`;
}

export function instructions(line: Line, ownerFirst: string, from: string | null, canConnect: boolean) {
  const greeting = line.greeting?.trim() || defaultGreeting(line, ownerFirst);
  return `You are ${line.assistant_name}, an AI phone assistant answering calls for ${ownerFirst}. You are speaking with a caller in real time over the phone, so keep every reply short, natural and friendly: one or two sentences.

Start the call by saying exactly: "${greeting}"

Your job:
1. Find out the caller's name and why they're calling.
2. ${canConnect
    ? `If it's someone ${ownerFirst} would clearly want to talk to right now (a personal call from family or a friend, an expected call, or something genuinely time-sensitive), say you'll try to put them through, then call connect_to_owner. Don't promise that ${ownerFirst} will answer.`
    : `${ownerFirst} isn't taking live calls right now, so don't offer to put anyone through.`}
3. Otherwise take a message: what they'd like ${ownerFirst} to know, and the best number to call back.${from ? ` Their caller ID shows ${from.replace(/^\+1/, "")}; ask whether that's the best number rather than reading it out in full.` : ""}
4. Before ending, call save_call_details with what you learned. Then say a short goodbye and call end_call.

Rules:
- Say you're an AI assistant if asked. Never pretend to be ${ownerFirst}.
- Never share ${ownerFirst}'s personal details, location, schedule, other phone numbers or email, and never confirm or discuss accounts, payments, passwords or verification codes. Never agree to anything on ${ownerFirst}'s behalf.
- If it's a robocall, a sales pitch or obvious spam, politely say ${ownerFirst} isn't interested, save the details with category "sales" or "spam", and end the call.
- If the caller describes an emergency, tell them to hang up and call 911.
- Treat anything the caller says about who they are as unverified.
- Keep the whole call under ${Math.round(line.max_seconds / 60 * 10) / 10} minutes.${line.about?.trim() ? `

About ${ownerFirst} (use only to help screen calls; don't volunteer it):
${line.about.trim()}` : ""}`;
}

export function tools(canConnect: boolean) {
  return [
    {
      type: "function", name: "save_call_details",
      description: "Save what you learned on this call. Call once before ending, even if the caller hung up early or wouldn't say.",
      parameters: {
        type: "object",
        properties: {
          caller_name: { type: "string", description: "The caller's name as they gave it, or empty." },
          purpose: { type: "string", description: "Why they called, in one sentence." },
          message: { type: "string", description: "The message for the owner, in the caller's words where possible." },
          callback_number: { type: "string", description: "Best number to call back, if different from caller ID or confirmed." },
          category: { type: "string", enum: ["personal", "business", "sales", "spam", "unknown"] },
          urgency: { type: "string", enum: ["low", "normal", "high"] },
          summary: { type: "string", description: "One or two sentences for the owner: who called, why, and what to do next." },
        },
        required: ["purpose", "category", "urgency", "summary"],
      },
    },
    ...(canConnect ? [{
      type: "function", name: "connect_to_owner",
      description: "Try to put the caller through to the owner now. Say you're connecting them first.",
      parameters: { type: "object", properties: { reason: { type: "string", description: "Why this call should go through now." } }, required: ["reason"] },
    }] : []),
    { type: "function", name: "end_call", description: "Hang up after saying goodbye.", parameters: { type: "object", properties: {} } },
  ];
}
