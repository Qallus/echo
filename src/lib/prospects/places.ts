import "server-only";
import { secret } from "@/lib/secrets";
import { prospectE164 } from "./phone";

// Google Places (New) Text Search: "HVAC in Chandler, AZ" -> businesses with
// their phone, website, address, rating and map position. Up to 20 a page and
// 3 pages (60) per search; Google bills each page as one request. The key is
// GOOGLE_MAPS_API_KEY (Admin -> Settings -> Integrations -> Google Maps).
// Google's terms let us keep the place ID; the other details are refreshed by
// searching again rather than kept as a copy of Google's data.

export type PlaceResult = {
  placeId: string; name: string; phone: string | null; phoneE164: string | null; website: string | null;
  address: string | null; address2: string | null; city: string | null; state: string | null; zip: string | null; country: string | null;
  category: string | null; rating: number | null; reviews: number | null; lat: number | null; lng: number | null;
  open: boolean; // false when Google marks it closed
};

const FIELDS = [
  "places.id", "places.displayName", "places.nationalPhoneNumber", "places.internationalPhoneNumber", "places.formattedAddress",
  "places.addressComponents", "places.websiteUri", "places.rating", "places.userRatingCount", "places.location",
  "places.primaryTypeDisplayName", "places.businessStatus", "nextPageToken",
].join(",");

type Raw = {
  id: string; displayName?: { text?: string }; nationalPhoneNumber?: string; internationalPhoneNumber?: string; formattedAddress?: string;
  addressComponents?: { longText?: string; shortText?: string; types?: string[] }[]; websiteUri?: string; rating?: number; userRatingCount?: number;
  location?: { latitude?: number; longitude?: number }; primaryTypeDisplayName?: { text?: string }; businessStatus?: string;
};

export async function placesConfigured() {
  return Boolean(await secret("GOOGLE_MAPS_API_KEY"));
}

export async function searchPlacesText(query: string, pageToken?: string): Promise<{ results?: PlaceResult[]; next?: string; error?: string }> {
  const key = await secret("GOOGLE_MAPS_API_KEY");
  if (!key) return { error: "Add a Google Maps API key in Admin → Settings → Integrations → Google Maps first." };
  let res: Response;
  try {
    res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELDS },
      body: JSON.stringify({ textQuery: query, pageSize: 20, regionCode: "US", languageCode: "en", ...(pageToken ? { pageToken } : {}) }),
      signal: AbortSignal.timeout(15000),
    });
  } catch {
    return { error: "Google Places didn't answer. Try again." };
  }
  const body = (await res.json().catch(() => ({}))) as { places?: Raw[]; nextPageToken?: string; error?: { message?: string; status?: string } };
  if (!res.ok) {
    const m = body.error?.message ?? `HTTP ${res.status}`;
    if (/not been used|disabled|PERMISSION_DENIED|API_KEY/i.test(`${m} ${body.error?.status ?? ""}`))
      return { error: `Google refused the key: ${m} Turn on "Places API (New)" for this key in Google Cloud, with billing on.` };
    return { error: `Google Places: ${m}` };
  }
  return { results: (body.places ?? []).map(toResult), next: body.nextPageToken };
}

function toResult(p: Raw): PlaceResult {
  const part = (type: string, short = false) => {
    const c = p.addressComponents?.find((x) => x.types?.includes(type));
    return (short ? c?.shortText : c?.longText) ?? null;
  };
  const street = [part("street_number"), part("route")].filter(Boolean).join(" ") || null;
  const unit = part("subpremise");
  const phone = p.nationalPhoneNumber ?? p.internationalPhoneNumber ?? null;
  return {
    placeId: p.id, name: p.displayName?.text ?? "Unnamed business", phone, phoneE164: phone ? prospectE164(p.internationalPhoneNumber ?? phone) : null,
    website: p.websiteUri ?? null,
    address: street, address2: unit ? `Suite ${unit}` : null,
    city: part("locality") ?? part("sublocality") ?? part("postal_town"), state: part("administrative_area_level_1", true),
    zip: part("postal_code"), country: part("country", true),
    category: p.primaryTypeDisplayName?.text ?? null,
    rating: typeof p.rating === "number" ? p.rating : null, reviews: typeof p.userRatingCount === "number" ? p.userRatingCount : null,
    lat: p.location?.latitude ?? null, lng: p.location?.longitude ?? null,
    open: !p.businessStatus || p.businessStatus === "OPERATIONAL",
  };
}
