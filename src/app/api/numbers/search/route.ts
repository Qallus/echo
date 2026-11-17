import { twilioRequest } from "@/lib/comms/twilio";
import { requestIp } from "@/lib/mcp/agents";
import { toDigits, type NumberResult } from "@/components/numbers/keypad";

// Public number search for the number picker (/numbers, /pricing): real,
// available US numbers from Twilio's AvailablePhoneNumbers. Read-only:
// nothing is bought or held here, and a number shown can be taken by someone
// else before checkout. Buying happens after payment (TODO when Stripe is
// back: purchase the picked number in the checkout webhook, then point its
// webhooks and create the Redial line). Small per-visitor allowance per
// server instance, like /api/site-ask.

const hits = new Map<string, number[]>();
function allowed(ip: string) {
  const now = Date.now(), recent = (hits.get(ip) ?? []).filter((t) => now - t < 3600_000);
  if (recent.filter((t) => now - t < 60_000).length >= 15 || recent.length >= 120) return false;
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) hits.delete(hits.keys().next().value!);
  return true;
}

const STATES = new Set("AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY".split(" "));

export async function GET(req: Request) {
  if (!allowed(requestIp(req) || "unknown")) return Response.json({ error: "That's a lot of searches. Try again in a minute." }, { status: 429 });
  const u = new URL(req.url).searchParams;
  const type = u.get("type") === "tollfree" ? "TollFree" : "Local";
  const area = (u.get("area") ?? "").replace(/\D/g, "").slice(0, 3);
  const contains = toDigits(u.get("contains") ?? "").slice(0, 10);
  const city = (u.get("city") ?? "").replace(/[^A-Za-z .'-]/g, "").trim().slice(0, 40);
  const state = (u.get("state") ?? "").toUpperCase().slice(0, 2);
  if (area && area.length !== 3) return Response.json({ error: "Area codes have 3 digits." }, { status: 400 });
  if (contains && contains.length < 2) return Response.json({ error: "Type at least 2 letters or digits to look for." }, { status: 400 });

  const params: Record<string, string> = { PageSize: "20", VoiceEnabled: "true" };
  if (type === "Local") {
    if (area) params.AreaCode = area;
    if (city) params.InLocality = city;
    if (STATES.has(state)) params.InRegion = state;
    params.SmsEnabled = "true";
  } else if (["800", "833", "844", "855", "866", "877", "888"].includes(area)) {
    params.AreaCode = area;
  }
  if (contains) params.Contains = `*${contains}*`;

  const r = await twilioRequest(`/AvailablePhoneNumbers/US/${type}.json`, params, "GET");
  if (!r.ok && r.status === 0) return Response.json({ error: "Number search isn't available right now." }, { status: 503 });
  let numbers = r.ok ? toResults(r.data, type) : [];
  let note: string | undefined;

  // Popular area codes run out (Phoenix's 480 and 602 often do): show other
  // numbers in the same state instead of nothing.
  const fallbackState = type === "Local" && area ? AREA_STATE[area] : undefined;
  if (!numbers.length && fallbackState) {
    const rest: Record<string, string> = { ...params, InRegion: fallbackState };
    delete rest.AreaCode;
    const again = await twilioRequest(`/AvailablePhoneNumbers/US/${type}.json`, rest, "GET");
    numbers = again.ok ? toResults(again.data, type) : [];
    if (numbers.length) note = `No (${area}) numbers are available right now. Here are other ${fallbackState} numbers.`;
  }
  if (!numbers.length) note = "No numbers matched. Try a nearby area code or fewer letters.";
  return Response.json({ numbers, ...(note ? { note } : {}) }, { headers: { "cache-control": "no-store" } });
}

type TwilioNumber = { phone_number: string; friendly_name: string; locality?: string | null; region?: string | null; capabilities?: { SMS?: boolean; MMS?: boolean; voice?: boolean } };
function toResults(data: Record<string, unknown>, type: "Local" | "TollFree"): NumberResult[] {
  return ((data.available_phone_numbers ?? []) as TwilioNumber[]).slice(0, 20).map((n) => ({
    number: n.phone_number, display: n.friendly_name, locality: n.locality || null, region: n.region || null, sms: Boolean(n.capabilities?.SMS), tollFree: type === "TollFree",
  }));
}

// Area code -> state, for the "sold out" fallback (Arizona and the biggest metros).
const AREA_STATE: Record<string, string> = Object.fromEntries(Object.entries({
  AZ: "480 520 602 623 928", CA: "209 213 310 323 408 415 424 510 562 619 626 650 657 661 707 714 760 805 818 858 909 916 925 949 951",
  NY: "212 315 347 516 518 585 607 631 646 716 718 845 914 917", TX: "210 214 254 281 361 409 469 512 682 713 737 806 817 830 832 903 915 936 940 956 972 979",
  FL: "239 305 321 352 386 407 561 727 754 772 786 813 850 863 904 941 954", IL: "217 224 309 312 618 630 708 773 779 815 847 872",
  WA: "206 253 360 425 509", CO: "303 719 720 970", NV: "702 725 775", GA: "229 404 470 478 678 706 762 770 912", UT: "385 435 801",
  NM: "505 575", OR: "458 503 541 971", NC: "252 336 704 828 910 919 980 984", MA: "339 351 413 508 617 774 781 857 978",
  PA: "215 267 412 484 570 610 717 724 814 878", MN: "218 320 507 612 651 763 952", MO: "314 417 573 636 660 816", TN: "423 615 629 731 865 901 931", DC: "202", OH: "216 234 330 380 419 440 513 567 614 740 937", MI: "231 248 269 313 517 586 616 734 810 906 947 989",
}).flatMap(([st, codes]) => codes.split(" ").map((c) => [c, st])));
