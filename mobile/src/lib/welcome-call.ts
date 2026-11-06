// The welcome screen's call: a blocked number rings, Redial answers, you
// listen in with Insider, steer the assistant with Audible, and the call ends
// without you ever picking up. Times are ms from the start of the loop.

export type WelcomeLine = { at: number; who: "ai" | "caller" | "note"; text: string };

export const WELCOME_CALL = {
  number: "Blocked Number",
  caller: "Dave · SunPeak Energy",
  slide: 1400, // Redial starts sliding to answer
  answered: 2600,
  listen: 8000, // you tap Insider
  guide: 14000, // you send an Audible direction
  named: 11000, // the caller says who he is
  ended: 22000,
  loop: 27000,
  lines: [
    { at: 3200, who: "ai", text: "This is Jeremy. How can I help you?" },
    { at: 5600, who: "caller", text: "I'm calling about your home solar panels." },
    { at: 8600, who: "ai", text: "Sure. Who's calling, and from which company?" },
    { at: 11000, who: "caller", text: "Dave with SunPeak Energy. You qualify for a free panel upgrade." },
    { at: 14000, who: "note", text: "Not interested. Ask him to take us off his list." },
    { at: 16000, who: "ai", text: "Thanks, Dave. Jeremy isn't interested. Please take this number off your list." },
    { at: 19500, who: "caller", text: "Will do. Have a good day." },
  ] as WelcomeLine[],
};

// How long a button shows as pressed before its feature kicks in.
export const PRESS = 800;
