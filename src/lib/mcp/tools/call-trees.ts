import "server-only";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { publishCallTree } from "@/lib/flows/publish";
import { validateFlow, type Flow } from "@/lib/flows/schema";
import { GEMINI_VOICES, XAI_VOICES } from "@/lib/flows/voices";
import { saveStudioFile } from "@/lib/studio/save";
import { synthesize } from "@/lib/studio/tts";
import { AI_PER_DAY, MAX_SCRIPT, STUDIO_KINDS } from "@/lib/studio/types";
import type { McpContext } from "../auth";
import { ToolError, defineTool } from "../audit";
import { confirmable, prepare } from "../confirm";
import { check, id } from "./shared";

// Call Tree and Recording Studio for Claude, as the signed-in person (RLS).
// call_tree_list / _get: the trees, their draft and published versions, the
// lines they answer and any problems. call_tree_update_block: change a block's
// words, label or settings; call_tree_set_voice: the AI voice (xAI or
// Gemini). call_tree_publish (confirm): goes live on the chosen lines and
// makes the voice clips. call_tree_calls: recent calls with every step.
// studio_voice_generate: a new Recording Studio clip in an AI voice. Clips
// themselves are the studio_clip resource; extensions are redial_extension.

const VOICE_IDS = [...XAI_VOICES.map((v) => `xai:${v.id}`), ...GEMINI_VOICES.map((v) => `gemini:${v}`)] as [string, ...string[]];

async function loadTree(ctx: McpContext, flowId: string) {
  const { data, error } = await ctx.supabase.from("call_flows").select("id, name, owner_id, draft, draft_rev, published_version_id, updated_at").eq("id", flowId).maybeSingle();
  check(error);
  if (!data) throw new ToolError("Call tree not found.");
  return data;
}

async function saveDraft(ctx: McpContext, flowId: string, rev: number, draft: Flow) {
  const { data, error } = await ctx.supabase.from("call_flows").update({ draft, name: draft.name }).eq("id", flowId).eq("draft_rev", rev).select("draft_rev").maybeSingle();
  check(error);
  if (!data) throw new ToolError("Someone changed this call tree at the same moment. Read it again with call_tree_get and retry.");
}

confirmable("call_tree_publish", async (ctx, p) => {
  const r = await publishCallTree(ctx.supabase, ctx.user.id, String(p.flow_id), String(p.note ?? ""), (p.line_ids as string[]) ?? []);
  if (r.error && !r.version) throw new ToolError(r.error);
  return { targetId: String(p.flow_id), data: { version: r.version, voice_clips_made: r.voiced ?? 0, warning: r.error ?? null } };
});

export function registerCallTreeTools(server: McpServer, ctx: McpContext) {
  const base = { prefix: "", domain: "call_tree" };

  defineTool(server, ctx, "call_tree_list", {
    ...base, risk: "read", title: "List call trees",
    description: "Your call trees (IVRs): name, whether it's published and which version, the lines it answers, its AI voice and when it changed.",
    inputSchema: z.object({}),
  }, async () => {
    const { data, error } = await ctx.supabase.from("call_flows").select("id, name, published_version_id, draft, updated_at, version:call_flow_versions!call_flows_published_version_fk(version), lines:call_flow_lines(line:redial_lines(id, label, number))").order("updated_at", { ascending: false }).limit(100);
    check(error);
    return {
      data: {
        call_trees: (data ?? []).map((f) => ({
          id: f.id, name: f.name, published_version: (f.version as unknown as { version: number } | null)?.version ?? null,
          voice: (f.draft as Flow | null)?.settings?.voice ?? null, blocks: (f.draft as Flow | null)?.nodes?.length ?? 0, updated_at: f.updated_at,
          lines: ((f.lines as unknown as { line: { id: string; label: string; number: string } | null }[]) ?? []).map((l) => l.line).filter(Boolean),
        })),
      },
    };
  });

  defineTool(server, ctx, "call_tree_get", {
    ...base, risk: "read", title: "Get a call tree",
    description: "A call tree's draft (every block: id, type, label, settings and where each output goes), its problems (errors block publishing), and the published version number. Block types: say, gather (menu), connect (ring someone), directory (dial by name), ai (AI receptionist), voicemail, callback, hours, split, set, http, crm_lookup, crm_update, message (text/email), flow, hangup.",
    inputSchema: z.object({ flow_id: id("Call tree") }),
  }, async ({ flow_id }) => {
    const f = await loadTree(ctx, flow_id);
    const { flow, issues } = validateFlow(f.draft);
    return { targetId: flow_id, data: { id: f.id, name: f.name, published: Boolean(f.published_version_id), draft: flow ?? f.draft, issues } };
  });

  defineTool(server, ctx, "call_tree_update_block", {
    ...base, risk: "write", title: "Change a call tree block",
    description: "Change one block in a call tree's draft. text: what the caller hears (say, gather menu, voicemail, directory and hangup prompts). label: the block's name. config: other settings merged into the block (e.g. directory {connecting, notFound}, connect {ringSeconds, whisper}, message {to, body, enabled}, ai {instructions, maxMinutes}). Changes are a draft until call_tree_publish.",
    inputSchema: z.object({
      flow_id: id("Call tree"), block_id: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
      text: z.string().trim().max(1000).optional(), label: z.string().trim().max(80).optional(), config: z.record(z.string(), z.unknown()).optional(),
    }),
  }, async ({ flow_id, block_id, text, label, config }) => {
    const f = await loadTree(ctx, flow_id);
    const draft = f.draft as Flow;
    const node = draft.nodes?.find((n) => n.id === block_id);
    if (!node) throw new ToolError(`No block "${block_id}" in this call tree. call_tree_get lists the blocks.`);
    const cfg = { ...(node.config as Record<string, unknown>), ...(config ?? {}) };
    if (text !== undefined) cfg.prompt = { ...((cfg.prompt as Record<string, unknown>) ?? {}), text, audioId: undefined };
    const next = { ...draft, nodes: draft.nodes.map((n) => (n.id === block_id ? { ...n, label: label ?? n.label, config: cfg } : n)) };
    const { flow, issues } = validateFlow(next);
    if (!flow) throw new ToolError(`That change isn't valid: ${issues.filter((i) => i.level === "error").map((i) => i.message).slice(0, 3).join("; ")}`);
    await saveDraft(ctx, flow_id, f.draft_rev, flow);
    return { targetId: flow_id, data: { updated: block_id, issues, note: "Saved to the draft. Publish with call_tree_publish." } };
  });

  defineTool(server, ctx, "call_tree_set_voice", {
    ...base, risk: "write", title: "Set a call tree's AI voice",
    description: "The AI voice every greeting, menu and phrase is spoken in. xai:ara|eve|leo|rex|sal are the xAI voices your AI receptionist uses; gemini:<Name> are Gemini voices (e.g. gemini:Despina). none = the standard phone voice. Clips are made when the call tree is published.",
    inputSchema: z.object({ flow_id: id("Call tree"), voice: z.enum([...VOICE_IDS, "none"] as [string, ...string[]]) }),
  }, async ({ flow_id, voice }) => {
    const f = await loadTree(ctx, flow_id);
    const draft = f.draft as Flow;
    const [provider, vid] = voice.split(":");
    const next = { ...draft, settings: { ...draft.settings, voice: voice === "none" ? undefined : { provider: provider as "xai" | "gemini", id: vid } } };
    const { flow } = validateFlow(next);
    if (!flow) throw new ToolError("Couldn't set that voice.");
    await saveDraft(ctx, flow_id, f.draft_rev, flow);
    return { targetId: flow_id, data: { voice: flow.settings.voice ?? null, note: "Publish to make the clips in this voice." } };
  });

  defineTool(server, ctx, "call_tree_publish", {
    ...base, risk: "high", previewOnly: true, title: "Publish a call tree",
    description: "Make the draft live on the chosen lines (a line runs one call tree; choosing it here takes it from any other tree). With an AI voice, the greetings, menus and phrases are made into clips first (a few seconds each). Returns a preview and confirmation_id; only after a clear yes call confirm_action.",
    inputSchema: z.object({ flow_id: id("Call tree"), line_ids: z.array(z.uuid()).max(50).optional().describe("Lines that should answer with it. Omit to keep the lines it already answers."), note: z.string().trim().max(300).optional() }),
  }, async ({ flow_id, line_ids, note }) => {
    const f = await loadTree(ctx, flow_id);
    const { flow, issues } = validateFlow(f.draft);
    const errors = issues.filter((i) => i.level === "error");
    if (!flow || errors.length) throw new ToolError(`Fix these first: ${errors.map((i) => i.message).slice(0, 5).join("; ")}`);
    let lines = line_ids;
    if (!lines) { const { data } = await ctx.supabase.from("call_flow_lines").select("line_id").eq("flow_id", flow_id); lines = (data ?? []).map((r) => r.line_id); }
    const { data: named } = lines.length ? await ctx.supabase.from("redial_lines").select("id, label, number").in("id", lines) : { data: [] };
    return prepare(ctx, "call_tree_publish", { flow_id, line_ids: lines, note: note ?? "" },
      `Publish "${f.name}" on ${(named ?? []).map((l) => l.number).join(", ") || "no lines"}${flow.settings.voice ? ` in the ${flow.settings.voice.id} voice` : ""}`,
      { lines: named, voice: flow.settings.voice ?? null, warnings: issues.filter((i) => i.level !== "error").map((i) => i.message) });
  });

  defineTool(server, ctx, "call_tree_calls", {
    ...base, risk: "read", title: "Calls through a call tree",
    description: "The last calls that went through a call tree, newest first, with every step: which block, what the caller pressed or said, and where they went.",
    inputSchema: z.object({ flow_id: id("Call tree"), limit: z.number().int().min(1).max(50).default(10) }),
  }, async ({ flow_id, limit }) => {
    const { data: runs, error } = await ctx.supabase.from("call_flow_runs").select("id, from_number, status, started_at, ended_at").eq("flow_id", flow_id).order("started_at", { ascending: false }).limit(limit);
    check(error);
    const { data: steps } = runs?.length ? await ctx.supabase.from("call_flow_run_steps").select("run_id, seq, node_id, node_type, transition, data").in("run_id", runs.map((r) => r.id)).order("seq") : { data: [] };
    return { targetId: flow_id, data: { calls: (runs ?? []).map((r) => ({ ...r, steps: (steps ?? []).filter((s) => s.run_id === r.id).map((s) => ({ seq: s.seq, block: s.node_id, type: s.node_type, went: s.transition, data: s.data })) })) } };
  });

  defineTool(server, ctx, "studio_voice_generate", {
    ...base, domain: "studio", risk: "write", title: "Make a Recording Studio clip with an AI voice",
    description: `Turn a script into a clip in your Recording Studio library (greetings, menus, hold and voicemail messages). voice: xai:ara|eve|leo|rex|sal or gemini:<Name> (e.g. gemini:Despina). Up to ${AI_PER_DAY} a day. Use the clip in a call tree by setting a block's prompt audioId.`,
    inputSchema: z.object({
      script: z.string().trim().min(1).max(MAX_SCRIPT), name: z.string().trim().min(1).max(120),
      voice: z.enum(VOICE_IDS), kind: z.enum(STUDIO_KINDS.map((k) => k.id) as [string, ...string[]]).default("greeting"),
      extension: z.string().trim().max(40).optional().describe("The extension or person it's for, e.g. 101 or Sales"),
    }),
  }, async ({ script, name, voice, kind, extension }) => {
    const { count } = await ctx.supabase.from("studio_audio").select("id", { count: "exact", head: true }).eq("source", "ai").gte("created_at", new Date(Date.now() - 864e5).toISOString());
    if ((count ?? 0) >= AI_PER_DAY) throw new ToolError(`You've made ${AI_PER_DAY} AI clips in the last day. Try again tomorrow.`);
    const [provider, vid] = voice.split(":") as ["xai" | "gemini", string];
    const tts = await synthesize(provider, { script, voice: vid, speed: 1 });
    if ("error" in tts) throw new ToolError(`The voice service couldn't make it: ${tts.error}`);
    const saved = await saveStudioFile(ctx.supabase, ctx.user.id, { bytes: tts.buffer, mime: tts.mime, name, source: "ai", kind: kind as never, description: script, aiProvider: provider, aiVoice: vid });
    if ("error" in saved) throw new ToolError(saved.error);
    if (extension) await ctx.supabase.from("studio_audio").update({ extension }).eq("id", saved.id);
    return { targetId: saved.id, data: { clip: { id: saved.id, name: saved.name, voice: vid, seconds: saved.duration_seconds } } };
  });
}
