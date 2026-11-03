import "server-only";

// Address -> latitude/longitude for the clients map, via OpenStreetMap's
// Nominatim (free, one request a second, identifies the app). Null when the
// address can't be found or the service is unavailable.
let last = 0;

export async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  const q = address.trim();
  if (q.length < 4) return null;
  const wait = 1100 - (Date.now() - last);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`, {
      headers: { "User-Agent": "Echo admin (https://echo.redial.si; hello@redial.si)", "Accept-Language": "en" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const [hit] = (await res.json()) as { lat: string; lon: string }[];
    return hit ? { lat: Number(hit.lat), lng: Number(hit.lon) } : null;
  } catch {
    return null;
  }
}
