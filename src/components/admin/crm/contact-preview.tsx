"use client";

import Link from "next/link";
import { ExternalLink, GitBranchPlus, Mail, MessageSquare, Pencil, Phone } from "lucide-react";
import { UserAvatar } from "@/components/profile/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailList } from "@/components/collection/kit";
import { LEAD_STATUSES, contactName, ownerName, type Contact, type StaffOption } from "@/lib/crm/types";

// Shared by Contacts and Leads (CollectionView): the row's photo or logo,
// and the side-sheet preview with call/text/email and the next steps.

export const contactAvatar = (c: Contact, size: "sm" | "md" | "lg" = "md") => (
  <UserAvatar name={contactName(c)} email={c.email ?? ""} src={c.photo ?? c.logo ?? null} size={size} />
);

export const contactWhere = (c: Contact) => [c.city, c.state].filter(Boolean).join(", ");

export function ContactPreview({ c, staff, badge, openLabel = "Open record", onPipeline, onEdit, pending }: {
  c: Contact; staff: StaffOption[]; badge: React.ReactNode; openLabel?: string;
  onPipeline?: () => void; onEdit?: () => void; pending?: boolean;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-1">
        {badge}
        {c.lead_status && <Badge variant="outline">{LEAD_STATUSES.find((s) => s.id === c.lead_status)?.label}</Badge>}
        {c.tags.map((t) => <Badge key={t} variant="outline">{t}</Badge>)}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Button variant="outline" size="sm" disabled={!c.phone} nativeButton={false} render={<a href={c.phone ? `tel:${c.phone}` : undefined} />}><Phone /> Call</Button>
        <Button variant="outline" size="sm" disabled={!c.phone} nativeButton={false} render={<a href={c.phone ? `sms:${c.phone}` : undefined} />}><MessageSquare /> Text</Button>
        <Button variant="outline" size="sm" disabled={!c.email} nativeButton={false} render={<a href={c.email ? `mailto:${c.email}` : undefined} />}><Mail /> Email</Button>
      </div>
      <DetailList rows={[
        ["Business", c.company_name ?? c.company?.name ?? "—"],
        ["Title", c.title ?? "—"],
        ["Email", c.email ?? "—"],
        ["Phone", c.phone ? `${c.phone}${c.phone_ext ? ` ext. ${c.phone_ext}` : ""}` : "—"],
        ["Address", [c.address, c.address2, contactWhere(c), c.zip].filter(Boolean).join(", ") || "—"],
        ["Interest", c.interest ?? "—"],
        ["Source", c.source ?? "—"],
        ["Owner", ownerName(staff, c.owner_id) ?? "Unassigned"],
        ["Added", new Date(c.created_at).toLocaleDateString()],
      ]} />
      {c.notes && <p className="rounded-lg border bg-muted/30 p-3 text-sm whitespace-pre-wrap">{c.notes}</p>}
      <div className="flex flex-wrap gap-2">
        <Button className="flex-1" nativeButton={false} render={<Link href={`/admin/contacts/${c.id}`} />}><ExternalLink /> {openLabel}</Button>
        {onPipeline && <Button variant="outline" disabled={pending} onClick={onPipeline}><GitBranchPlus /> Pipeline</Button>}
        {onEdit && <Button variant="outline" onClick={onEdit}><Pencil /> Edit</Button>}
      </div>
    </div>
  );
}
