"use client";

import { Building2, Mail, Phone, PhoneCall, Router, Smartphone, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CollectionView } from "@/components/collection/collection-view";
import { DetailList, IconTile, muted } from "@/components/collection/kit";
import { HARDWARE, RESELLERS, SEGMENTS, priceLabel, type HardwareItem, type Reseller } from "@/lib/redial/hardware";

const money = (n?: number) => (n == null ? null : `$${n.toFixed(2)}`);
const icon = (h: HardwareItem): LucideIcon => (h.segment === "mobile" ? Smartphone : /adapter/i.test(h.type) ? Router : /desk/i.test(h.type) ? PhoneCall : Phone);
// Margin per unit: our price (or list price until we set one) minus dealer cost.
const margin = (h: HardwareItem) => (h.dealerPrice == null ? null : (h.redialPrice ?? h.listPrice) - h.dealerPrice);
const STATUS: Record<HardwareItem["status"], string> = { available: "On the site", coming_soon: "Coming later", staff_only: "Staff only" };

export function HardwareCatalog() {
  return (
    <CollectionView<HardwareItem>
      items={HARDWARE} getId={(h) => h.id} title={(h) => `${h.brand} ${h.model}`} noun={["phone", "phones"]} storageKey="admin-hardware" defaultView="table"
      media={(h) => <IconTile icon={icon(h)} />}
      subtitle={(h) => h.type}
      badge={(h) => <Badge variant="outline">{STATUS[h.status]}</Badge>}
      meta={(h) => `List ${money(h.listPrice)}${h.dealerPrice ? ` · dealer ${money(h.dealerPrice)}` : ""}`}
      searchText={(h) => `${h.brand} ${h.model} ${h.type} ${h.segment} ${h.staffNote}`}
      filters={[
        { id: "all", label: "All", test: () => true },
        ...(Object.keys(SEGMENTS) as HardwareItem["segment"][]).map((s) => ({ id: s, label: SEGMENTS[s].label, test: (h: HardwareItem) => h.segment === s })),
        { id: "auto", label: "Sets itself up", test: (h) => h.autoSetup },
      ]}
      columns={[
        { id: "model", label: "Phone", cell: (h) => <span className="font-medium">{h.brand} {h.model}</span>, sort: (h) => `${h.brand} ${h.model}` },
        { id: "segment", label: "For", cell: (h) => SEGMENTS[h.segment].label, sort: (h) => h.segment },
        { id: "type", label: "Type", cell: (h) => h.type },
        { id: "list", label: "List price", cell: (h) => money(h.listPrice), sort: (h) => h.listPrice, className: "tabular-nums" },
        { id: "dealer", label: "Dealer (est.)", cell: (h) => muted(money(h.dealerPrice)), sort: (h) => h.dealerPrice ?? null, className: "tabular-nums" },
        { id: "site", label: "On the site", cell: (h) => (h.status === "staff_only" ? muted("Hidden") : priceLabel(h)), className: "tabular-nums" },
        { id: "margin", label: "Margin", cell: (h) => muted(money(margin(h) ?? undefined)), sort: margin, className: "tabular-nums" },
        { id: "auto", label: "Auto-setup", cell: (h) => (h.autoSetup ? "Yes" : muted("No")) },
        { id: "status", label: "Status", cell: (h) => STATUS[h.status], sort: (h) => h.status },
      ]}
      preview={(h) => (
        <div className="space-y-4">
          <p className="text-sm">{h.blurb}</p>
          <DetailList rows={[
            ["For", SEGMENTS[h.segment].label], ["Type", h.type], ["List price", money(h.listPrice)], ["Dealer (est.)", money(h.dealerPrice) ?? "—"],
            ["Redial price", money(h.redialPrice) ?? "Not set (site shows the list price as \"about\")"], ["Margin", money(margin(h) ?? undefined) ?? "—"],
            ["Auto-setup", h.autoSetup ? "Yes (Redial provisioning)" : "No"], ["Open source", h.openSource ?? "—"], ["Status", STATUS[h.status]],
          ]} />
          <p className="rounded-lg border bg-muted/30 p-3 text-sm">{h.staffNote}</p>
          <p className="text-xs text-muted-foreground">Prices and the lineup live in src/lib/redial/hardware.ts. Ask Claude to change them.</p>
        </div>
      )}
    />
  );
}

export function ResellerDirectory() {
  return (
    <CollectionView<Reseller>
      items={RESELLERS} getId={(r) => r.id} title={(r) => r.company} noun={["supplier", "suppliers"]} storageKey="admin-resellers" defaultView="table"
      media={() => <IconTile icon={Building2} />}
      subtitle={(r) => `${r.role} · ${r.carries}`}
      meta={(r) => [r.email, r.phone].filter(Boolean).join(" · ") || r.website.replace(/^https?:\/\//, "")}
      searchText={(r) => `${r.company} ${r.role} ${r.carries} ${r.notes}`}
      columns={[
        { id: "company", label: "Company", cell: (r) => <span className="font-medium">{r.company}</span>, sort: (r) => r.company },
        { id: "role", label: "Role", cell: (r) => r.role, sort: (r) => r.role },
        { id: "carries", label: "Carries", cell: (r) => r.carries },
        { id: "email", label: "Email", cell: (r) => (r.email ? <a href={`mailto:${r.email}`} onClick={(e) => e.stopPropagation()} className="hover:underline">{r.email}</a> : muted(null)) },
        { id: "phone", label: "Phone", cell: (r) => (r.phone ? <a href={`tel:${r.phone}`} onClick={(e) => e.stopPropagation()} className="tabular-nums hover:underline">{r.phone}</a> : muted(null)) },
        { id: "notes", label: "Notes", cell: (r) => <span className="text-muted-foreground">{r.notes}</span> },
      ]}
      preview={(r) => (
        <div className="space-y-4">
          <DetailList rows={[["Role", r.role], ["Carries", r.carries], ["Email", r.email ?? "—"], ["Phone", r.phone ?? "—"], ["Website", r.website.replace(/^https?:\/\//, "")], ["Notes", r.notes]]} />
          <div className="flex flex-wrap gap-2">
            {r.apply && <Button nativeButton={false} render={<a href={r.apply} target="_blank" rel="noreferrer" />}>Apply as a reseller</Button>}
            <Button variant="outline" nativeButton={false} render={<a href={r.website} target="_blank" rel="noreferrer" />}>Website</Button>
            {r.email && <Button variant="outline" nativeButton={false} render={<a href={`mailto:${r.email}`} />}><Mail /> Email</Button>}
            {r.phone && <Button variant="outline" nativeButton={false} render={<a href={`tel:${r.phone}`} />}><Phone /> Call</Button>}
          </div>
        </div>
      )}
    />
  );
}
