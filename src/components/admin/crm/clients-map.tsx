"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Map as LeafletMap } from "leaflet";

export type MapPoint = { id: string; name: string; lat: number; lng: number; sub: string; color: string };

const COLORS: Record<string, string> = { client: "#059669", prospect: "#0284c7", partner: "#7c3aed", former: "#71717a" };

// Clients on an OpenStreetMap map, one dot per client (colored by status).
// Clicking a dot opens its popup with a link to the client.
export function ClientsMap({ points }: { points: MapPoint[] }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current) return;
      map.current?.remove();
      const m = L.map(el.current, { scrollWheelZoom: false }).setView([33.45, -112.07], 9);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(m);
      const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
      const markers = points.map((p) => L.circleMarker([p.lat, p.lng], { radius: 8, color: "#fff", weight: 2, fillColor: COLORS[p.color] ?? "#0284c7", fillOpacity: 0.9 })
        .bindPopup(`<strong>${esc(p.name)}</strong><br/><span style="color:#71717a">${esc(p.sub)}</span><br/><a href="/admin/clients/${p.id}">Open client →</a>`).addTo(m));
      if (markers.length) m.fitBounds(L.featureGroup(markers).getBounds().pad(0.2), { maxZoom: 13 });
      map.current = m;
    })();
    return () => { cancelled = true; map.current?.remove(); map.current = null; };
  }, [points]);

  return <div ref={el} className="z-0 h-[65dvh] min-h-96 w-full overflow-hidden rounded-xl border" />;
}
