"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Map as LeafletMap, Marker, Circle } from "leaflet";

export type MapAgent = { id: string; handle: string; name: string; lat: number; lng: number; label: string };

// Live Agents on an OpenStreetMap map. Each agent is a rate pin inside a
// ~3 km circle: the spot is already moved from where they live, and the
// circle makes clear it's an area, not an address. Hovering a card
// highlights its pin; clicking a pin opens the profile.
export function AgentsMap({ agents, active, onHover, className }: {
  agents: MapAgent[]; active?: string | null; onHover?: (id: string | null) => void; className?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const pins = useRef(new Map<string, { marker: Marker; circle: Circle }>());
  const hover = useRef(onHover);
  useEffect(() => { hover.current = onHover; }, [onHover]);
  const router = useRouter();
  const go = useRef((handle: string) => router.push(`/live-agents/${handle}`));
  useEffect(() => { go.current = (handle: string) => router.push(`/live-agents/${handle}`); }, [router]);

  useEffect(() => {
    let cancelled = false;
    const store = pins.current;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !el.current) return;
      map.current?.remove();
      store.clear();
      const m = L.map(el.current, { scrollWheelZoom: false }).setView([33.45, -112.07], 9);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 15, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(m);
      const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
      const layers = agents.map((a) => {
        const circle = L.circle([a.lat, a.lng], { radius: 3000, color: "#10b981", weight: 1, fillColor: "#10b981", fillOpacity: 0.08 }).addTo(m);
        const marker = L.marker([a.lat, a.lng], {
          icon: L.divIcon({ className: "", iconSize: undefined, html: `<span class="la-pin" data-id="${esc(a.id)}">${esc(a.label)}</span>` }),
          title: a.name, riseOnHover: true,
        }).addTo(m);
        marker.on("click", () => go.current(a.handle));
        marker.on("mouseover", () => hover.current?.(a.id));
        marker.on("mouseout", () => hover.current?.(null));
        store.set(a.id, { marker, circle });
        return circle;
      });
      // Open on where most agents are (within ~250 km of the median spot) so
      // a few far-away agents don't zoom the map out to the whole country.
      if (layers.length) {
        const mid = (xs: number[]) => xs.sort((x, y) => x - y)[Math.floor(xs.length / 2)];
        const cLat = mid(agents.map((a) => a.lat)), cLng = mid(agents.map((a) => a.lng));
        const near = layers.filter((_, i) => m.distance([agents[i].lat, agents[i].lng], [cLat, cLng]) < 250_000);
        const focus = near.length * 2 >= layers.length ? near : layers;
        m.fitBounds(L.featureGroup(focus).getBounds().pad(0.15), { maxZoom: 11 });
      }
      map.current = m;
    })();
    return () => { cancelled = true; map.current?.remove(); map.current = null; store.clear(); };
  }, [agents]);

  useEffect(() => {
    pins.current.forEach(({ marker, circle }, id) => {
      const on = id === active;
      marker.getElement()?.querySelector(".la-pin")?.classList.toggle("la-pin-active", on);
      marker.setZIndexOffset(on ? 1000 : 0);
      circle.setStyle({ fillOpacity: on ? 0.22 : 0.08, weight: on ? 2 : 1 });
    });
  }, [active]);

  return (
    <>
      <style>{`
        .la-pin { display:inline-block; transform:translate(-50%,-50%); white-space:nowrap; border-radius:9999px; padding:3px 9px; font:600 12px/1.4 var(--font-sans, system-ui);
          background:#fff; color:#171717; border:1px solid #d4d4d4; box-shadow:0 1px 3px rgb(0 0 0 / .18); cursor:pointer; transition:all .15s; }
        .la-pin-active, .la-pin:hover { background:#171717; color:#fff; border-color:#171717; transform:translate(-50%,-50%) scale(1.08); }
      `}</style>
      <div ref={el} className={className ?? "z-0 h-[60dvh] min-h-80 w-full overflow-hidden rounded-xl border"} />
    </>
  );
}
