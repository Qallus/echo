// Desk, cordless and Wi-Fi (SIP) phones that work with Redial phone service.
// Shared by the marketing pages and, later, the dashboard's Phones tab. The
// `setup` field is where the phone takes the auto-setup address Redial gives
// you; `kind` picks the drawing on the marketing pages.

export type PhoneVendor = "grandstream" | "yealink" | "poly" | "other";
export type PhoneKind = "cordless" | "desk" | "wifi";

export type PhoneModel = { id: string; vendor: PhoneVendor; name: string; kind: PhoneKind; note: string };

export const VENDORS: Record<PhoneVendor, { label: string; setup: string }> = {
  grandstream: { label: "Grandstream", setup: "Maintenance → Upgrade and Provisioning → Config Server Path" },
  yealink: { label: "Yealink", setup: "Settings → Auto Provision → Server URL" },
  poly: { label: "Poly", setup: "Settings → Provisioning Server → Server Address" },
  other: { label: "Any SIP phone", setup: "Enter the SIP server, username and password Redial shows you" },
};

export const PHONE_MODELS: PhoneModel[] = [
  { id: "gs_wp826", vendor: "grandstream", name: "WP826", kind: "wifi", note: "Wi-Fi cordless with a charging stand. Goes anywhere your Wi-Fi does." },
  { id: "gs_wp816", vendor: "grandstream", name: "WP816", kind: "wifi", note: "A lighter Wi-Fi cordless for home and small offices." },
  { id: "gs_dp_series", vendor: "grandstream", name: "DP720 / DP730 DECT", kind: "cordless", note: "Cordless handsets on a DECT base you plug into your router." },
  { id: "gs_grp2612", vendor: "grandstream", name: "GRP2612 / GRP2614", kind: "desk", note: "Color-screen desk phones with line keys and a headset port." },
  { id: "yl_t54w", vendor: "yealink", name: "T54W / T57W", kind: "desk", note: "Desk phones with built-in Wi-Fi and Bluetooth." },
  { id: "yl_t3x", vendor: "yealink", name: "T31 / T33 / T34", kind: "desk", note: "Simple, reliable desk phones for every desk." },
  { id: "yl_w73p", vendor: "yealink", name: "W73P / W76P DECT", kind: "cordless", note: "Cordless handsets for the warehouse, shop floor or home." },
  { id: "poly_vvx", vendor: "poly", name: "VVX 250 / 350 / 450", kind: "desk", note: "Business desk phones with HD Voice." },
  { id: "poly_edge", vendor: "poly", name: "Edge B and E series", kind: "desk", note: "Newer Poly desk phones with color screens." },
  { id: "sip_other", vendor: "other", name: "Other SIP phones and adapters", kind: "desk", note: "Most standard SIP phones, and ATA adapters for an existing corded phone." },
];
