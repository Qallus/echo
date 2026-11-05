import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { mobileToken } from "@/lib/mobile/context";
import { readDetails } from "@/lib/profile-details";
import { readSpeakers } from "@/lib/speakers";
import { isVisual, readDates, readItems } from "@/lib/visuals";
import type {
  ActionGroup, CalendarEvent, Folder, PersonCard, SummarySection, Profile, Recording, RecordingDetail, Summary, Workspace, WorkspaceRole,
} from "@/lib/types";

export const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

// All reads go through the signed-in user's client, so RLS decides access.
// cache() dedupes calls within one request (layout + page).

export const getUser = cache(async () => {
  const supabase = await createClient();
  const token = mobileToken();
  const { data } = token ? await supabase.auth.getClaims(token) : await supabase.auth.getClaims();
  if (!data?.claims) return null;
  return { id: data.claims.sub as string, email: (data.claims.email as string | undefined) ?? "" };
});

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

// Suspended by Super Admin (RLS already blocks their workspace data).
export async function isSuspended() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("am_i_suspended");
  return data === true;
}

// Every workspace the user belongs to: Business ones (A–Z), then Personal.
export const listWorkspaces = cache(async (): Promise<Workspace[]> => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_members")
    .select("role, workspaces!inner(id, name, is_personal)")
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  return data
    .map((m) => {
      const ws = m.workspaces as unknown as { id: string; name: string; is_personal: boolean };
      return { id: ws.id, name: ws.name, isPersonal: ws.is_personal, role: m.role as WorkspaceRole };
    })
    .sort((a, b) => Number(a.isPersonal) - Number(b.isPersonal) || a.name.localeCompare(b.name));
});

// App-wide Super Admin (platform_admins); separate from workspace roles.
export const isSuperAdmin = cache(async (): Promise<boolean> => {
  await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.rpc("am_i_super_admin");
  return data === true;
});

// The user's private workspace (created at sign-up).
export const getPersonalWorkspace = cache(async (): Promise<Workspace> => {
  const ws = (await listWorkspaces()).find((w) => w.isPersonal);
  if (!ws) throw new Error("No personal workspace for user");
  return ws;
});

type RecordingRow = {
  id: string; workspace_id: string; created_by: string | null; title: string; source: Recording["source"];
  status: Recording["status"]; duration_sec: number; created_at: string; folder_id: string | null; deleted_at: string | null;
};
export const EVENT_COLS = "id, workspace_id, recording_id, kind, title, starts_at, ends_at, all_day, location, notes, attendees, created_by";
type EventRow = { id: string; workspace_id: string; recording_id: string | null; kind: CalendarEvent["kind"]; title: string; starts_at: string; ends_at: string;
  all_day: boolean; location: string | null; notes: string | null; attendees: unknown; created_by: string | null };
export const toEvent = (e: EventRow): CalendarEvent => ({
  id: e.id, workspaceId: e.workspace_id, recordingId: e.recording_id, kind: e.kind, title: e.title, startsAt: e.starts_at, endsAt: e.ends_at,
  allDay: e.all_day, location: e.location, notes: e.notes, attendees: Array.isArray(e.attendees) ? e.attendees.filter((a): a is string => typeof a === "string") : [],
  createdBy: e.created_by,
});

// Calendar events in every workspace the user belongs to (RLS).
export async function listCalendarEvents(from: string, to: string): Promise<CalendarEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("calendar_events").select(EVENT_COLS).lt("starts_at", to).gte("ends_at", from).order("starts_at").limit(2000);
  if (error) throw new Error(error.message);
  return (data as EventRow[]).map(toEvent);
}

const RECORDING_COLS = "id, workspace_id, created_by, title, source, status, duration_sec, created_at, folder_id, deleted_at";
const toRecording = (r: RecordingRow): Recording => ({
  id: r.id, workspaceId: r.workspace_id, createdBy: r.created_by, title: r.title, source: r.source, status: r.status,
  durationSec: r.duration_sec, createdAt: r.created_at, folderId: r.folder_id, deletedAt: r.deleted_at,
});

// Every recording in every workspace the user belongs to (RLS limits the rows),
// trash included (sidebar counts need both).
export const listRecordings = cache(async (): Promise<Recording[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recordings").select(RECORDING_COLS)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as RecordingRow[]).map(toRecording);
});

export const listFolders = cache(async (): Promise<Folder[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("folders").select("id, workspace_id, name").order("name");
  if (error) throw new Error(error.message);
  return data.map((f) => ({ id: f.id, workspaceId: f.workspace_id, name: f.name }));
});

export type Member = PersonCard & { role: WorkspaceRole; joinedAt: string };
export type Invite = { id: string; email: string; role: WorkspaceRole; token: string; expiresAt: string };

type MemberRow = {
  user_id: string; email: string; full_name: string | null; role: WorkspaceRole; joined_at: string;
  avatar_url: string | null; job_title: string | null; company: string | null; phone: string | null;
  timezone: string | null; location: string | null; details: unknown;
};

export async function listMembers(workspaceId: string): Promise<Member[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_workspace_members", { ws: workspaceId });
  if (error) throw new Error(error.message);
  return (data as MemberRow[]).map((m) => ({
    id: m.user_id, email: m.email, fullName: m.full_name, role: m.role, joinedAt: m.joined_at,
    avatarUrl: m.avatar_url, jobTitle: m.job_title, company: m.company, phone: m.phone,
    timezone: m.timezone, location: m.location, details: readDetails(m.details),
  }));
}

// Filters by user: staff can also read others' notifications (admin log).
export async function countUnreadNotifications(): Promise<number> {
  const user = await requireUser();
  const supabase = await createClient();
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true })
    .eq("user_id", user.id).is("read_at", null).eq("show_in_app", true);
  return count ?? 0;
}

type ProfileRow = {
  full_name: string | null; avatar_url: string | null; job_title: string | null; company: string | null;
  phone: string | null; phone_visible: boolean; timezone: string | null; location: string | null;
  bio: string | null; website: string | null; linkedin: string | null; details: unknown;
};

// Your own profile, phone included. The phone column isn't readable through
// the table, so this goes through get_my_profile().
export const getMyProfile = cache(async (): Promise<Profile> => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_profile").maybeSingle<ProfileRow>();
  if (error) throw new Error(error.message);
  return {
    id: user.id, email: user.email,
    fullName: data?.full_name ?? null, avatarUrl: data?.avatar_url ?? null,
    jobTitle: data?.job_title ?? null, company: data?.company ?? null,
    phone: data?.phone ?? null, phoneVisible: data?.phone_visible ?? false,
    timezone: data?.timezone ?? null, location: data?.location ?? null,
    bio: data?.bio ?? null, website: data?.website ?? null,
    linkedin: data?.linkedin ?? null, details: readDetails(data?.details),
  };
});

// Open invites (owners/admins only; RLS returns nothing to members).
export async function listInvites(workspaceId: string): Promise<Invite[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_invites").select("id, email, role, token, expires_at")
    .eq("workspace_id", workspaceId).is("accepted_at", null).gt("expires_at", new Date().toISOString())
    .order("created_at");
  if (error) throw new Error(error.message);
  return data.map((i) => ({ id: i.id, email: i.email, role: i.role as WorkspaceRole, token: i.token, expiresAt: i.expires_at }));
}

export async function getRecordingDetail(id: string): Promise<RecordingDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const [rec, segs, hls, sum, items, evs] = await Promise.all([
    supabase.from("recordings").select(`${RECORDING_COLS}, speakers`).eq("id", id).maybeSingle(),
    supabase.from("transcript_segments").select("speaker, start_sec, text").eq("recording_id", id).order("position"),
    supabase.from("highlights").select("id, start_sec, text, kind, title, bullets").eq("recording_id", id).order("start_sec"),
    supabase.from("summaries").select("template, model, overview, key_points, mind_map, title, sections, language, updated_at, dates, visual").eq("recording_id", id).maybeSingle(),
    supabase.from("action_items").select("id, owner_name, owner_role, text, done").eq("recording_id", id).order("position"),
    supabase.from("calendar_events").select(EVENT_COLS).eq("recording_id", id).order("starts_at"),
  ]);
  if (!rec.data) return null;
  const createdBy = (rec.data as RecordingRow).created_by;
  const { data: prof } = createdBy ? await supabase.from("profiles").select("full_name, avatar_url").eq("id", createdBy).maybeSingle() : { data: null };

  let summary: Summary | null = null;
  if (sum.data) {
    const groups = new Map<string, ActionGroup>();
    for (const it of items.data ?? []) {
      const owner = it.owner_name ?? "Unassigned";
      if (!groups.has(owner)) groups.set(owner, { owner, role: it.owner_role, items: [] });
      groups.get(owner)!.items.push({ id: it.id, text: it.text, done: it.done });
    }
    const mm = (sum.data.mind_map ?? {}) as { root?: string; branches?: string[]; items?: unknown };
    summary = {
      template: sum.data.template,
      model: sum.data.model,
      overview: sum.data.overview,
      keyPoints: (sum.data.key_points ?? []) as string[],
      actionGroups: [...groups.values()],
      mindMap: { root: mm.root ?? rec.data.title, branches: mm.branches ?? [], items: readItems(mm.items) },
      dates: readDates(sum.data.dates),
      visual: isVisual(sum.data.visual) ? sum.data.visual : null,
      title: sum.data.title,
      sections: (sum.data.sections ?? []) as SummarySection[],
      language: sum.data.language,
      updatedAt: sum.data.updated_at,
    };
  }

  return {
    recording: toRecording(rec.data as RecordingRow),
    speakers: readSpeakers((rec.data as { speakers?: unknown }).speakers),
    owner: prof?.full_name ? { name: prof.full_name, avatarUrl: prof.avatar_url, userId: createdBy } : null,
    events: (evs.data ?? []).map(toEvent),
    segments: (segs.data ?? []).map((s) => ({ speaker: s.speaker, startSec: s.start_sec, text: s.text })),
    highlights: (hls.data ?? []).map((h) => ({ id: h.id, startSec: h.start_sec, text: h.text, kind: h.kind, title: h.title, bullets: (h.bullets ?? []) as string[] })),
    summary,
  };
}

// ---------------------------------------------------------------------------
// Billing (written by the Stripe webhook; RLS: your own rows)
// ---------------------------------------------------------------------------
export type OrderItem = { id: string; description: string; quantity: number; unitAmount: number | null; amount: number; interval: string | null; priceKey: string | null };
export type Order = {
  id: string; number: number; status: string; kind: string; email: string | null; currency: string;
  subtotal: number; discount: number; tax: number; total: number; receiptUrl: string | null; invoicePdf: string | null;
  createdAt: string; items: OrderItem[];
};
export type Subscription = { id: string; status: string; items: { price_key: string | null; quantity: number }[]; currentPeriodEnd: string | null; cancelAtPeriodEnd: boolean };

const ORDER_COLUMNS = "id, number, status, kind, email, currency, subtotal, discount, tax, total, receipt_url, invoice_pdf, created_at, order_items(id, description, quantity, unit_amount, amount, interval, price_key)";

type OrderRow = {
  id: string; number: number; status: string; kind: string; email: string | null; currency: string;
  subtotal: number; discount: number; tax: number; total: number; receipt_url: string | null; invoice_pdf: string | null; created_at: string;
  order_items: { id: string; description: string; quantity: number; unit_amount: number | null; amount: number; interval: string | null; price_key: string | null }[];
};

const toOrder = (o: OrderRow): Order => ({
  id: o.id, number: o.number, status: o.status, kind: o.kind, email: o.email, currency: o.currency,
  subtotal: o.subtotal, discount: o.discount, tax: o.tax, total: o.total, receiptUrl: o.receipt_url, invoicePdf: o.invoice_pdf, createdAt: o.created_at,
  items: o.order_items.map((i) => ({ id: i.id, description: i.description, quantity: i.quantity, unitAmount: i.unit_amount, amount: i.amount, interval: i.interval, priceKey: i.price_key })),
});

export async function listOrders(limit = 50): Promise<Order[]> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("orders").select(ORDER_COLUMNS).eq("user_id", user.id)
    .order("created_at", { ascending: false }).limit(limit);
  if (error) throw new Error(error.message);
  return (data as unknown as OrderRow[]).map(toOrder);
}

export async function getOrder(id: string): Promise<Order | null> {
  if (!isUuid(id)) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.from("orders").select(ORDER_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toOrder(data as unknown as OrderRow) : null;
}

export async function listSubscriptions(): Promise<Subscription[]> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("subscriptions").select("id, status, items, current_period_end, cancel_at_period_end")
    .eq("user_id", user.id).order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data.map((s) => ({ id: s.id, status: s.status, items: s.items, currentPeriodEnd: s.current_period_end, cancelAtPeriodEnd: s.cancel_at_period_end }));
}

// ---------------------------------------------------------------------------
// Summary designs (Summary Builder). RLS: yours, plus ones shared with a
// Business workspace you belong to.
// ---------------------------------------------------------------------------
export type DesignRow = { id: string; name: string; config: unknown; isDefault: boolean; workspaceId: string | null; mine: boolean; updatedAt: string };

export async function listDesigns(): Promise<DesignRow[]> {
  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase.from("summary_designs").select("id, name, config, is_default, workspace_id, user_id, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data.map((d) => ({ id: d.id, name: d.name, config: d.config, isDefault: d.is_default && d.user_id === user.id, workspaceId: d.workspace_id, mine: d.user_id === user.id, updatedAt: d.updated_at }));
}

export async function getDesign(id: string): Promise<DesignRow | null> {
  if (!isUuid(id)) return null;
  return (await listDesigns()).find((d) => d.id === id) ?? null;
}
