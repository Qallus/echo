"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowLeft, Ban, Briefcase, CalendarClock, Check, CheckSquare, ChevronRight, CircleAlert, Mail, MessageSquare, Phone, Plus, Settings2, StickyNote, Trash2, Trophy } from "lucide-react";
import { UserAvatar } from "@/components/profile/user-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { moveDeal } from "@/lib/admin/actions/crm";
import { addDealStep, toggleDealStep, updateDeal } from "@/lib/admin/actions/crm-pipeline";
import { updateContact, type ContactPatch } from "@/lib/admin/actions/crm-people";
import { money } from "@/lib/billing/catalog";
import { OPPORTUNITY_TYPES, PIPELINE_PATH, STAGES, STAGE_ORDER, daysSince, isClosed, needsNextStep, weighted, type DealStage } from "@/lib/crm/deals";
import { blockingSteps, resolveStage, stepsFor, type StageConfig } from "@/lib/crm/guidance";
import { CONTACT_ROLES, contactName, formatDay, ownerName, type Activity, type Contact, type Deal, type DealHistory, type StaffOption } from "@/lib/crm/types";
import { cn } from "@/lib/utils";
import { DetailRow, Editable, Panel, StageBadge } from "./crm-kit";
import { AddFieldDialog, BlockedDialog, CloseDialog, NextStepDialog } from "./opportunity-dialogs";
import { ComposeDialog } from "@/components/admin/comms/compose-dialog";
import { StageConfigDialog } from "./stage-config-dialog";
import { LogDialog, TimelinePanel, type LogKind } from "./timeline";

const fmtWhen = (iso: string) => new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

// The opportunity workspace (Channel-Cast's opportunity-detail): stage path
// gated by required Next Steps, click-to-edit fields, guidance, the activity
// timeline, and close won / lost.
export function OpportunityWorkspace({ deal, contact, staff, history, activities, stageConfig, readOnly }: {
  deal: Deal; contact: Contact | null; staff: StaffOption[]; history: DealHistory[]; activities: Activity[]; stageConfig: StageConfig; readOnly: boolean;
}) {
  const [blocked, setBlocked] = useState<string[] | null>(null);
  const [closing, setClosing] = useState<"won" | "lost" | null>(null);
  const [dialog, setDialog] = useState<"next" | "field" | "stages" | null>(null);
  const [log, setLog] = useState<LogKind | null>(null);
  const [composing, setComposing] = useState(false);
  const [stepLabel, setStepLabel] = useState("");
  const [msg, setMsg] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok?: string; error?: string }>) => start(async () => setMsg(await fn()));

  const closed = isClosed(deal.stage);
  const idx = PIPELINE_PATH.indexOf(deal.stage);
  const nextStage = idx >= 0 && idx < PIPELINE_PATH.length - 1 ? PIPELINE_PATH[idx + 1] : null;
  const guide = resolveStage(deal.stage, stageConfig, deal);
  const steps = stepsFor(deal, stageConfig);
  const save = (patch: Parameters<typeof updateDeal>[1]) => run(() => updateDeal(deal.id, patch));
  const saveContact = (patch: ContactPatch) => contact && run(() => updateContact(contact.id, patch));
  const owners = [{ value: "", label: "Unassigned" }, ...staff.map((s) => ({ value: s.user_id, label: s.name }))];
  const counts = (kinds: string[]) => activities.filter((a) => kinds.includes(a.kind)).length;
  const target = { deal_id: deal.id, ...(deal.contact_id ? { contact_id: deal.contact_id } : {}) };

  const setStage = (next: DealStage) => {
    if (readOnly || next === deal.stage) return;
    if (next === "closed_won" || next === "closed_lost") { setClosing(next === "closed_won" ? "won" : "lost"); return; }
    if (PIPELINE_PATH.indexOf(next) > idx && idx >= 0) {
      const missing = blockingSteps(deal, stageConfig);
      if (missing.length) { setBlocked(missing.map((m) => m.label)); return; }
    }
    run(() => moveDeal(deal.id, next));
  };

  const actions: { key: string; label: string; icon: typeof Phone; run: () => void }[] = [
    { key: "call", label: "Call", icon: Phone, run: () => { if (contact?.phone) window.open(`tel:${contact.phone}`); setLog("call"); } },
    { key: "email", label: "Email", icon: Mail, run: () => setComposing(true) },
    { key: "sms", label: "Text", icon: MessageSquare, run: () => { if (contact?.phone) window.open(`sms:${contact.phone}`); setLog("sms"); } },
    { key: "meeting", label: "Meeting", icon: CalendarClock, run: () => setLog("meeting") },
    { key: "note", label: "Note", icon: StickyNote, run: () => setLog("note") },
    { key: "task", label: "Task", icon: CheckSquare, run: () => setLog("task") },
  ];

  return (
    <div className="mx-auto w-full max-w-[96rem] space-y-4 px-4 py-6 sm:px-6">
      <Link href="/admin/pipeline" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Back to pipeline</Link>

      {/* Record header */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Briefcase className="size-5" /></span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Opportunity</p>
              <h1 className="text-xl font-semibold">{readOnly ? deal.title : <Editable value={deal.title} align="left" onSave={(v) => save({ title: v })} />}</h1>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {needsNextStep(deal) && <Badge variant="outline" className="gap-1 border-amber-500/40 text-amber-700 dark:text-amber-300"><CircleAlert className="size-3" /> No next step</Badge>}
            {!readOnly && !closed && <Button size="sm" variant="outline" onClick={() => setClosing("won")}><Trophy /> Closed Won</Button>}
            {!readOnly && !closed && <Button size="sm" variant="outline" onClick={() => setClosing("lost")}><Ban /> Closed Lost</Button>}
          </div>
        </div>

        {!readOnly && (
          <div className="mt-3 -mx-1 flex flex-nowrap gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
            {actions.map((a) => <Button key={a.key} size="sm" variant="outline" className="shrink-0" onClick={a.run}><a.icon /> {a.label}</Button>)}
          </div>
        )}

        <div className="mt-4 grid gap-x-6 border-t pt-3 sm:grid-cols-2 lg:grid-cols-5">
          <DetailRow label="Client">{deal.company ? <Link href={`/admin/clients/${deal.company.id}`} className="hover:underline">{deal.company.name}</Link> : null}</DetailRow>
          <DetailRow label="Close date">{readOnly ? (deal.expected_close && formatDay(deal.expected_close)) :
            <Editable value={deal.expected_close} type="date" onSave={(v) => save({ expected_close: v || null })} format={formatDay} placeholder="Set a date" />}</DetailRow>
          <DetailRow label="Amount">{readOnly ? money(deal.value_cents) :
            <Editable value={deal.value_cents / 100} type="number" onSave={(v) => save({ value: v })} format={(v) => money(Math.round(Number(v) * 100))} />}</DetailRow>
          <DetailRow label="Owner">{readOnly ? ownerName(staff, deal.owner_id) :
            <Editable value={deal.owner_id ?? ""} type="select" options={owners} onSave={(v) => save({ owner_id: v || null })} format={(v) => ownerName(staff, v)} placeholder="Unassigned" />}</DetailRow>
          <DetailRow label="Stage">{readOnly ? <StageBadge stage={deal.stage} /> :
            <Editable value={deal.stage} type="select" options={STAGE_ORDER.map((s) => ({ value: s, label: STAGES[s].label }))} onSave={(v) => setStage(v as DealStage)} format={(v) => <StageBadge stage={v as DealStage} />} />}</DetailRow>
        </div>
      </div>

      {/* Stage path */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div role="tablist" aria-label="Sales stage" className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
            {PIPELINE_PATH.map((s, i) => {
              const done = idx >= 0 && i < idx;
              const active = s === deal.stage;
              return (
                <button key={s} type="button" role="tab" aria-selected={active} disabled={readOnly} onClick={() => setStage(s)}
                  className={cn("flex min-w-28 flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2.5 text-xs font-semibold transition-colors",
                    active ? "bg-primary text-primary-foreground" : done ? "bg-primary/15 text-primary hover:bg-primary/25" : "bg-muted text-muted-foreground hover:text-foreground")}>
                  {done && <Check className="size-3.5 shrink-0" />}<span className="truncate">{STAGES[s].label}</span>
                </button>
              );
            })}
            {(deal.stage === "closed_lost" || deal.stage === "nurture") && (
              <span className={cn("flex shrink-0 items-center rounded-md px-3 py-2.5 text-xs font-semibold", deal.stage === "closed_lost" ? "bg-destructive text-white" : "bg-secondary")}>{STAGES[deal.stage].label}</span>
            )}
          </div>
          {!readOnly && !closed && nextStage && <Button size="sm" onClick={() => setStage(nextStage)} disabled={pending}><Check /> Mark stage complete</Button>}
        </div>
        {msg.error && <p className="mt-2 text-sm text-destructive">{msg.error}</p>}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,300px)_minmax(0,1fr)_minmax(0,300px)]">
        {/* Left: who this is */}
        <div className="space-y-4">
          <Panel title="Contact details">
            {contact ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <UserAvatar name={contactName(contact)} email={contact.email ?? ""} src={null} size="md" />
                  <div className="min-w-0"><p className="truncate text-sm font-semibold">{contactName(contact)}</p><p className="truncate text-xs text-muted-foreground">{contact.title || "—"}</p></div>
                </div>
                <div>
                  {([["First name", "first_name"], ["Last name", "last_name"], ["Title", "title"], ["Email", "email"], ["Phone", "phone"], ["Website", "website"], ["City", "city"], ["State", "state"]] as const).map(([label, key]) => (
                    <DetailRow key={key} label={label}>{readOnly ? contact[key] : <Editable value={contact[key]} placeholder={`Add ${label.toLowerCase()}`} onSave={(v) => saveContact({ [key]: v })} />}</DetailRow>
                  ))}
                  <DetailRow label="Role">{readOnly ? CONTACT_ROLES.find((r) => r.id === contact.role)?.label :
                    <Editable value={contact.role} type="select" options={CONTACT_ROLES.map((r) => ({ value: r.id, label: r.label }))} onSave={(v) => saveContact({ role: v })}
                      format={(v) => CONTACT_ROLES.find((r) => r.id === v)?.label} />}</DetailRow>
                </div>
                <Link href={`/admin/contacts/${contact.id}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">Open contact <ChevronRight className="size-3" /></Link>
              </div>
            ) : <p className="text-sm text-muted-foreground">No contact linked yet. Edit the deal from the pipeline to link one.</p>}
          </Panel>

          <Panel title="Opportunity information">
            <DetailRow label="Type">{readOnly ? deal.opportunity_type :
              <Editable value={deal.opportunity_type} type="select" placeholder="Pick a type" options={[{ value: "", label: "None" }, ...OPPORTUNITY_TYPES.map((t) => ({ value: t, label: t }))]} onSave={(v) => save({ opportunity_type: v || null })} />}</DetailRow>
            <DetailRow label="Probability">{readOnly ? `${deal.probability}%` :
              <Editable value={deal.probability} type="number" onSave={(v) => save({ probability: Number(v) })} format={(v) => `${v}%`} />}</DetailRow>
            <DetailRow label="Weighted value">{money(weighted(deal))}</DetailRow>
            <DetailRow label="Lead source">{readOnly ? deal.source : <Editable value={deal.source} placeholder="Add a source" onSave={(v) => save({ source: v })} />}</DetailRow>
            <DetailRow label="Days open">{daysSince(deal.created_at, deal.closed_at)}</DetailRow>
            <DetailRow label="Days in stage">{daysSince(deal.stage_entered_at)}</DetailRow>
            {deal.lost_reason && <DetailRow label="Lost reason">{deal.lost_reason}</DetailRow>}
            {deal.won_summary && <DetailRow label="Won summary">{deal.won_summary}</DetailRow>}
          </Panel>
        </div>

        {/* Centre: key fields, guidance, next steps, activity */}
        <div className="min-w-0 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Panel title="Key fields" action={!readOnly && <Button size="sm" variant="ghost" onClick={() => setDialog("field")}><Plus /> Add field</Button>}>
              <DetailRow label="Next step">
                {deal.next_step ? (
                  <button type="button" disabled={readOnly} onClick={() => setDialog("next")} className="inline-flex max-w-full items-baseline gap-2 rounded px-1 py-0.5 hover:bg-muted/60">
                    <span className="min-w-0 truncate">{deal.next_step}</span>{deal.next_step_due && <span className="shrink-0 text-xs text-muted-foreground">{formatDay(deal.next_step_due)}</span>}
                  </button>
                ) : !readOnly ? (
                  <Button size="sm" variant="outline" onClick={() => setDialog("next")} className="h-7 gap-1.5 border-amber-500/40 px-2 text-xs text-amber-700 dark:text-amber-300"><CalendarClock /> Set a next step</Button>
                ) : null}
              </DetailRow>
              <DetailRow label="Last activity">{activities[0] ? fmtWhen(activities[0].occurred_at) : "None yet"}</DetailRow>
              <DetailRow label="Products">{readOnly ? deal.products.join(", ") || null :
                <Editable value={deal.products.join(", ")} placeholder="Add products" onSave={(v) => save({ products: v.split(",").map((p) => p.trim()).filter(Boolean) })} />}</DetailRow>
              <DetailRow label="Competitor">{readOnly ? deal.competitor : <Editable value={deal.competitor} placeholder="Add a competitor" onSave={(v) => save({ competitor: v })} />}</DetailRow>
              {deal.custom_fields.map((f) => (
                <DetailRow key={f.id} label={f.label}>
                  <span className="group flex items-center justify-end gap-1">
                    {readOnly ? f.value : <Editable value={f.value} type={f.type} placeholder={`Add ${f.label.toLowerCase()}`} format={f.type === "date" ? formatDay : undefined}
                      onSave={(v) => save({ custom_fields: deal.custom_fields.map((x) => (x.id === f.id ? { ...x, value: v } : x)) })} />}
                    {!readOnly && <Button size="icon-xs" variant="ghost" aria-label={`Remove ${f.label}`} className="sm:opacity-0 sm:group-hover:opacity-100"
                      onClick={() => save({ custom_fields: deal.custom_fields.filter((x) => x.id !== f.id) })}><Trash2 /></Button>}
                  </span>
                </DetailRow>
              ))}
            </Panel>

            <Panel title="Guidance for success">
              <p className="text-sm font-medium">{guide.goal}</p>
              <ul className="mt-2 space-y-1.5">
                {guide.actions.map((a, i) => <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />{a}</li>)}
              </ul>
            </Panel>
          </div>

          <Panel title={`Next Steps · ${steps.filter((s) => s.done).length}/${steps.length}`} action={!readOnly && (
            <div className="flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={() => setDialog("stages")}><Settings2 /> Configure stages</Button>
              {!closed && nextStage && <Button size="sm" variant="outline" onClick={() => setStage(nextStage)}><Check /> Mark complete</Button>}
            </div>
          )}>
            <div className="space-y-1.5">
              {steps.length === 0 && <p className="text-sm text-muted-foreground">No steps for this stage yet.</p>}
              {steps.map(({ step, done, automatic, custom }) => (
                <div key={step.id} className="group flex items-center gap-1">
                  <button type="button" disabled={readOnly || automatic || pending} title={automatic ? "Ticked automatically from the record" : undefined}
                    onClick={() => run(() => toggleDealStep(deal.id, `${deal.stage}:${step.id}`, !done))}
                    className={cn("flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-1.5 py-1 text-left text-sm", !(readOnly || automatic) && "hover:bg-muted/50")}>
                    <span className={cn("flex size-4 shrink-0 items-center justify-center rounded border", done ? "border-primary bg-primary/15 text-primary" : "border-border")}>{done && <Check className="size-3" />}</span>
                    <span className={cn("min-w-0", done ? "text-foreground" : "text-muted-foreground")}>{step.label}</span>
                    {step.required && !done && <span className="ml-auto shrink-0 text-[10px] font-semibold tracking-wide text-amber-700 uppercase dark:text-amber-300">Required</span>}
                  </button>
                  {custom && !readOnly && (
                    <Button size="icon-xs" variant="ghost" aria-label="Remove step" className="sm:opacity-0 sm:group-hover:opacity-100"
                      onClick={() => save({ extra_steps: deal.extra_steps.filter((e) => e.id !== step.id) })}><Trash2 /></Button>
                  )}
                </div>
              ))}
              {!readOnly && (
                <form className="flex items-center gap-1.5 pt-1.5" onSubmit={(e) => { e.preventDefault(); const l = stepLabel; setStepLabel(""); run(() => addDealStep(deal.id, l)); }}>
                  <Input value={stepLabel} onChange={(e) => setStepLabel(e.target.value)} placeholder={`Add a step for ${STAGES[deal.stage].label}…`} className="h-8 text-sm" />
                  <Button type="submit" size="sm" variant="outline" disabled={!stepLabel.trim()}><Plus /> Add</Button>
                </form>
              )}
            </div>
          </Panel>

          <TimelinePanel activities={activities} staff={staff} target={target} readOnly={readOnly} seenKey={deal.id} />
        </div>

        {/* Right: related */}
        <div className="space-y-4">
          <Panel title={`Products (${deal.products.length})`}>
            {deal.products.length ? (
              <ul className="space-y-1.5">{deal.products.map((p) => <li key={p} className="rounded-md border px-2.5 py-1.5 text-sm">{p}</li>)}</ul>
            ) : <p className="text-sm text-muted-foreground">No plans or add-ons yet.</p>}
          </Panel>
          <Panel title="Stage history">
            {history.length ? (
              <ol className="space-y-2">
                {history.map((h, i) => (
                  <li key={h.id} className="flex items-start gap-2 text-xs">
                    <span className={cn("mt-1 size-1.5 shrink-0 rounded-full", i === 0 ? "bg-primary" : "bg-muted-foreground/40")} />
                    <span className="min-w-0">
                      <span className="block font-medium">{h.kind === "stage" && h.stage ? STAGES[h.stage]?.label ?? h.stage : `Owner: ${ownerName(staff, h.owner_id) ?? "Unassigned"}`}</span>
                      <span className="block text-muted-foreground">{fmtWhen(h.created_at)}{h.actor ? ` · ${ownerName(staff, h.actor)}` : ""}</span>
                    </span>
                  </li>
                ))}
              </ol>
            ) : <p className="text-sm text-muted-foreground">No stage changes recorded.</p>}
          </Panel>
          <Panel title="Activity summary">
            <dl className="space-y-1.5 text-sm">
              {([["Calls", ["call", "voicemail"]], ["Texts", ["sms"]], ["Emails", ["email"]], ["Notes", ["note"]], ["Meetings", ["meeting"]], ["Tasks", ["task"]]] as const).map(([label, kinds]) => (
                <div key={label} className="flex justify-between"><dt className="text-muted-foreground">{label}</dt><dd className="font-medium tabular-nums">{counts([...kinds])}</dd></div>
              ))}
            </dl>
          </Panel>
        </div>
      </div>

      {blocked && <BlockedDialog items={blocked} onClose={() => setBlocked(null)} />}
      {closing && <CloseDialog deal={deal} outcome={closing} onClose={() => setClosing(null)} />}
      {dialog === "next" && <NextStepDialog deal={deal} onClose={() => setDialog(null)} />}
      {dialog === "field" && <AddFieldDialog deal={deal} onClose={() => setDialog(null)} />}
      {dialog === "stages" && <StageConfigDialog open onOpenChange={(o) => !o && setDialog(null)} initial={stageConfig} startStage={deal.stage} />}
      {log && <LogDialog initial={log} target={target} onClose={() => setLog(null)} />}
      {composing && <ComposeDialog dealId={deal.id} initial={contact ? [{ id: contact.id, name: contactName(contact), email: contact.email }] : []} onClose={() => setComposing(false)} />}
    </div>
  );
}
