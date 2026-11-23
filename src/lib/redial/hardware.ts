// Phones Redial sells or recommends, and where Redial buys them. From
// docs/Wholesale-Phones/ReDial Phone Hardware & Resellers.xlsx. Shared by the
// public Shop phones page (/phones) and Admin -> Redial -> Hardware.
//
// Prices are the makers' list or typical store prices in US dollars. They show
// on the site as "about $X" until Redial is an approved reseller and sets its
// own price (`redialPrice`). Dealer prices are estimates, shown to staff only.

import type { PhoneVendor } from "./phone-models";

export type HardwareSegment = "home" | "business" | "mobile";
export type HardwareStatus = "available" | "coming_soon" | "staff_only";

export type HardwareItem = {
  id: string; segment: HardwareSegment; brand: string; model: string; type: string;
  listPrice: number; dealerPrice?: number; redialPrice?: number;
  /** Sets itself up from a Redial line (auto-provisioning). */
  autoSetup: boolean; vendor?: PhoneVendor; openSource?: string;
  blurb: string; staffNote: string; status: HardwareStatus;
};

export const SEGMENTS: Record<HardwareSegment, { label: string; title: string; sub: string }> = {
  home: { label: "Home", title: "For the house", sub: "Keep the phones you have with an adapter, or go cordless. Every one rings with your Redial number and screens calls first." },
  business: { label: "Business", title: "For the office", sub: "Desk phones that set themselves up: plug them in, and they register to your Redial lines and extensions." },
  mobile: { label: "Mobile", title: "Phones with Redial built in", sub: "Coming later: a repairable, privacy-first smartphone with Redial as the phone app." },
};

export const HARDWARE: HardwareItem[] = [
  { id: "gs_ht801", segment: "home", brand: "Grandstream", model: "HT801", type: "1-port phone adapter", listPrice: 39, autoSetup: true, vendor: "grandstream", status: "available",
    blurb: "Plug your existing home phone into this and your router. The cheapest way to put the whole house on Redial.", staffNote: "CDW lists $43.88. Cheapest way onto Redial." },
  { id: "gs_ht802", segment: "home", brand: "Grandstream", model: "HT802", type: "2-port phone adapter", listPrice: 49, autoSetup: true, vendor: "grandstream", status: "available",
    blurb: "Two phone jacks: two lines, or a phone and a fax, on one small box.", staffNote: "CDW lists $55.00." },
  { id: "gs_wp826", segment: "home", brand: "Grandstream", model: "WP826", type: "Wi-Fi cordless phone", listPrice: 109, dealerPrice: 64.6, autoSetup: true, vendor: "grandstream", status: "available",
    blurb: "A cordless phone that works anywhere your Wi-Fi does, with a charging stand.", staffNote: "Dealer portals $64.60–$84.79; stores $74.99–$129.95. Jeremy's current office phone." },
  { id: "gs_dp725", segment: "home", brand: "Grandstream", model: "DP725", type: "DECT cordless handset", listPrice: 60, autoSetup: true, vendor: "grandstream", status: "available",
    blurb: "An extra cordless handset for another room. Pairs with a Grandstream DECT base.", staffNote: "Needs a Grandstream DECT base (not in the sheet yet: decide whether to add one)." },
  { id: "yl_w73p", segment: "home", brand: "Yealink", model: "W73P", type: "DECT base and cordless handset", listPrice: 185, autoSetup: true, vendor: "yealink", status: "available",
    blurb: "A cordless base and handset with clear sound and long battery life. Add up to 10 handsets.", staffNote: "List $185; SHI sells for $169. Up to 10 handsets." },
  { id: "gs_grp2602", segment: "business", brand: "Grandstream", model: "GRP2602", type: "2-line desk phone", listPrice: 45, autoSetup: true, vendor: "grandstream", status: "available",
    blurb: "A simple, sturdy desk phone for every desk. Sets itself up in minutes.", staffNote: "Zero-touch provisioning for mass deployment." },
  { id: "yl_t31p", segment: "business", brand: "Yealink", model: "T31P", type: "Entry-level desk phone", listPrice: 52.25, autoSetup: true, vendor: "yealink", status: "available",
    blurb: "Yealink's dependable starter desk phone, powered over the network cable.", staffNote: "Walmart price." },
  { id: "yl_t54w", segment: "business", brand: "Yealink", model: "T54W", type: "Desk phone with Wi-Fi and Bluetooth", listPrice: 147.49, autoSetup: true, vendor: "yealink", status: "available",
    blurb: "A color touch screen, Bluetooth headsets and built-in Wi-Fi for front desks and managers.", staffNote: "Retail $147.49–$169.05." },
  { id: "fp_gen6_eos", segment: "mobile", brand: "Fairphone", model: "Gen 6 with /e/OS", type: "Repairable smartphone, de-Googled", listPrice: 699, autoSetup: false, openSource: "/e/OS", status: "coming_soon",
    blurb: "A repairable phone with a privacy-first, open-source system. The plan: Redial as the built-in phone app.", staffNote: "Top pick for a Redial-first phone. /e/OS is open source, so a Redial edition with Redial as the default dialer is possible." },
  { id: "fp_gen6", segment: "mobile", brand: "Fairphone", model: "Gen 6", type: "Repairable smartphone (Android)", listPrice: 649, autoSetup: false, status: "coming_soon",
    blurb: "The same repairable Fairphone with standard Android and the Redial app.", staffNote: "Sold directly in the US by Fairphone." },
  { id: "tc_thrive", segment: "mobile", brand: "Teracube", model: "Thrive", type: "Kids phone with parental controls", listPrice: 149, autoSetup: false, status: "coming_soon",
    blurb: "A first phone for kids, with parental controls and Redial screening the calls.", staffNote: "$149 with Teracube plan, $199 on other carriers. Fits the Redial family pitch." },
  { id: "pu_librem5", segment: "mobile", brand: "Purism", model: "Librem 5", type: "Linux phone (PureOS)", listPrice: 799, autoSetup: false, openSource: "PureOS (fully open)", status: "staff_only",
    blurb: "A fully open Linux phone.", staffNote: "Most open phone, but many everyday apps won't run. Bulk and custom builds available. Not on the public page until decided." },
];

export type Reseller = {
  id: string; company: string; role: string; carries: string; email?: string; phone?: string; website: string; apply?: string; notes: string;
};

export const RESELLERS: Reseller[] = [
  { id: "grandstream", company: "Grandstream", role: "Manufacturer", carries: "Grandstream", email: "reseller@grandstream.com", phone: "617-566-9300",
    website: "https://www.grandstream.com", apply: "https://partnerconnect.grandstream.com/resellers/register", notes: "Authorized online reseller program. Apply here first." },
  { id: "yealink", company: "Yealink", role: "Manufacturer", carries: "Yealink",
    website: "https://www.yealink.com", apply: "https://www.yealink.com/en/partner-reseller-become", notes: "Must buy through an authorized distributor. Replies in 3–5 business days." },
  { id: "nts", company: "NTS Direct", role: "Distributor", carries: "Yealink, Grandstream, Fanvil", email: "Sales@NTSDirect.com", phone: "877-483-5393",
    website: "https://www.ntsdirect.com", notes: "41 Main St, Bolton, MA 01740." },
  { id: "telecomspot", company: "The Telecom Spot", role: "Authorized dealer", carries: "Yealink, Grandstream", phone: "866-369-3394",
    website: "https://www.thetelecomspot.com", notes: "Log in for lower dealer pricing." },
  { id: "fairphone", company: "Fairphone", role: "Manufacturer", carries: "Fairphone", email: "wewantmore@fairphone.com",
    website: "https://www.fairphone.com/business", notes: "Sales partner program. Approved resellers order by email." },
  { id: "murena", company: "Murena", role: "/e/OS maker", carries: "Murena, Fairphone with /e/OS", email: "ephone_support@e.email",
    website: "https://murena.com/business", notes: "No formal reseller program; use the business contact form." },
  { id: "purism", company: "Purism", role: "Manufacturer", carries: "Librem 5, Liberty Phone", email: "sales@puri.sm",
    website: "https://puri.sm", notes: "Bulk orders and custom builds." },
  { id: "teracube", company: "Teracube", role: "Manufacturer", carries: "Thrive kids phone",
    website: "https://myteracube.com", notes: "Wholesale pricing via Faire. No direct partner email found." },
];

export const publicHardware = (segment?: HardwareSegment) => HARDWARE.filter((h) => h.status !== "staff_only" && (!segment || h.segment === segment));
export const priceLabel = (h: HardwareItem) => (h.redialPrice != null ? `$${h.redialPrice.toFixed(2).replace(/\.00$/, "")}` : `About $${Math.round(h.listPrice)}`);
