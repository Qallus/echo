// End-to-end check of the Echo MCP tools: create -> read -> update -> delete in
// every area, then cleans up after itself (everything it makes is in Personal).
//   MCP_TEST_TOKEN=<Supabase access token> npm run mcp:smoke
// Optional: MCP_URL (default http://localhost:3000/api/mcp).
// Get a token by connecting MCP Inspector (npx @modelcontextprotocol/inspector)
// and copying the access token from its Authentication panel.

const URL_ = process.env.MCP_URL ?? "http://localhost:3000/api/mcp";
const TOKEN = process.env.MCP_TEST_TOKEN;
let nextId = 1;
let failures = 0;

async function rpc(method, params, token = TOKEN) {
  const res = await fetch(URL_, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
      "MCP-Protocol-Version": "2025-06-18",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
  });
  const body = await res.text();
  if (!res.ok) return { status: res.status, headers: res.headers, body };
  // JSON body, or an SSE stream whose last data: line carries the response.
  const json = body.trimStart().startsWith("{")
    ? JSON.parse(body)
    : JSON.parse(body.split("\n").filter((l) => l.startsWith("data:")).at(-1).slice(5));
  return { status: res.status, json };
}

// Tools are echo_<name>; the automation tools have plain names (pass raw).
async function call(name, args = {}, raw = false) {
  const r = await rpc("tools/call", { name: raw ? name : `echo_${name}`, arguments: args });
  if (r.json?.error) throw new Error(`${name}: ${r.json.error.message}`);
  const result = r.json?.result;
  const text = result?.content?.[0]?.text ?? "";
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { ok: !result?.isError, data };
}

function check(label, cond, detail) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${!cond && detail ? `  -> ${JSON.stringify(detail).slice(0, 300)}` : ""}`);
  if (!cond) failures++;
}

async function main() {
  const anon = await rpc("tools/list", {}, null);
  check("401 without a token, with WWW-Authenticate", anon.status === 401 && /resource_metadata=/.test(anon.headers?.get("www-authenticate") ?? ""));
  if (!TOKEN) {
    console.log("\nSet MCP_TEST_TOKEN to run the signed-in checks.");
    process.exitCode = failures ? 1 : 0;
    return;
  }

  await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "echo-smoke", version: "1" } });
  const list = await rpc("tools/list", {});
  const names = (list.json?.result?.tools ?? []).map((t) => t.name);
  const plain = /^(tool_search|confirm_|resource_|agent_|approval_|crm_|bookings_|plans?_|document_|reports_|analytics_|waitlist_)/;
  check(`tools/list (${names.length} tools)`, names.length >= 35 && names.every((n) => n.startsWith("echo_") || plain.test(n)), names);
  const tools = list.json?.result?.tools ?? [];
  check("every tool has a risk hint", tools.every((t) => typeof t.annotations?.readOnlyHint === "boolean"));

  const me = await call("whoami");
  check("whoami", me.ok && me.data.workspace?.is_personal, me.data);
  const wss = await call("workspace_list");
  check("workspace_list", wss.ok && wss.data.workspaces.some((w) => w.kind === "personal"), wss.data);
  check("member_list", (await call("member_list")).ok);

  // Folders
  const folder = await call("folder_create", { name: "MCP smoke test" });
  check("folder_create", folder.ok, folder.data);
  const fid = folder.data.folder?.id;
  check("folder_update", (await call("folder_update", { folder_id: fid, name: "MCP smoke test (renamed)" })).ok);
  const folders = await call("folder_list");
  check("folder_list", folders.ok && folders.data.folders.some((f) => f.id === fid && f.name.endsWith("(renamed)")));

  // Recordings + transcript
  const rec = await call("recording_create", {
    title: "MCP smoke test zebracorn", source: "meeting", folder_id: fid,
    transcript_text: "[00:00] Ana: Kickoff for the zebracorn launch.\n[00:15] Ben: Budget is approved.\n[00:40] Ana: Ship on Friday.",
  });
  check("recording_create with transcript", rec.ok && rec.data.transcript_segments === 3, rec.data);
  const rid = rec.data.recording?.id;
  const got = await call("recording_get", { recording_id: rid, include_transcript: true });
  check("recording_get (transcript)", got.ok && got.data.transcript?.total === 3 && got.data.transcript.segments[1].speaker === "Ben", got.data);
  const listed = await call("recording_list", { folder_id: fid });
  check("recording_list (folder filter)", listed.ok && listed.data.recordings.length === 1);
  const found = await call("search", { query: "zebracorn" });
  check("search", found.ok && found.data.results.some((r) => r.recording_id === rid), found.data);
  check("recording_update", (await call("recording_update", { recording_id: rid, title: "MCP smoke test zebracorn (edited)", status: "processing" })).ok);
  check("segment_update", (await call("segment_update", { recording_id: rid, position: 1, text: "Budget is approved for Q4." })).ok);
  const segPreview = await call("segment_delete", { recording_id: rid, position: 2 });
  check("segment_delete preview without confirm", segPreview.ok && segPreview.data.preview === true);
  check("segment_delete confirm", (await call("segment_delete", { recording_id: rid, position: 2, confirm: true })).ok);
  const replaced = await call("transcript_replace", { recording_id: rid, segments: [{ speaker: "Ana", start_sec: 0, text: "Replaced transcript." }] });
  check("transcript_replace", replaced.ok && replaced.data.segments === 1, replaced.data);
  const after = await call("recording_get", { recording_id: rid, include_transcript: true });
  check("transcript replaced (1 segment left)", after.data.transcript?.total === 1, after.data.transcript);

  // Highlights
  const hl = await call("highlight_create", { recording_id: rid, text: "Launch date set", start_sec: 40 });
  check("highlight_create", hl.ok);
  check("highlight_update", (await call("highlight_update", { highlight_id: hl.data.highlight.id, text: "Launch date: Friday" })).ok);
  check("highlight_delete", (await call("highlight_delete", { highlight_id: hl.data.highlight.id, confirm: true })).ok);

  // Summary + action items
  const sum = await call("summary_upsert", { recording_id: rid, overview: "Kickoff; budget approved; ship Friday.", key_points: ["Budget approved"] });
  check("summary_upsert", sum.ok, sum.data);
  const ai = await call("action_item_create", { recording_id: rid, text: "Book launch call", owner_name: "Ana" });
  check("action_item_create", ai.ok);
  const ais = await call("action_item_list", { owner: "Ana", recording_id: rid });
  check("action_item_list (owner filter)", ais.ok && ais.data.action_items.length === 1, ais.data);
  check("action_item_update (done)", (await call("action_item_update", { action_item_id: ai.data.action_item.id, done: true })).ok);
  check("action_item_delete", (await call("action_item_delete", { action_item_id: ai.data.action_item.id, confirm: true })).ok);
  check("summary_delete", (await call("summary_delete", { recording_id: rid, confirm: true })).ok);

  // Backlog
  const req = await call("dev_request_create", { title: "MCP smoke test item", area: "mcp", priority: "high", source: "claude_code" });
  check("dev_request_create", req.ok, req.data);
  const qid = req.data.item?.id;
  check("dev_request_list", (await call("dev_request_list", { area: "mcp" })).data.items?.some((i) => i.id === qid));
  check("dev_request_update (status)", (await call("dev_request_update", { request_id: qid, status: "in_progress" })).ok);
  check("dev_request_comment", (await call("dev_request_comment", { request_id: qid, body: "Started.", author_label: "Claude Code" })).ok);
  const one = await call("dev_request_get", { request_id: qid });
  check("dev_request_get (with comment)", one.ok && one.data.comments.length === 1);
  check("dev_request_delete", (await call("dev_request_delete", { request_id: qid, confirm: true })).ok);

  // Purge rules, then clean up
  const early = await call("recording_purge", { recording_id: rid, confirm: true });
  check("recording_purge refuses a recording not in Trash", !early.ok);
  check("recording_trash", (await call("recording_trash", { recording_id: rid })).ok);
  check("recording_restore", (await call("recording_restore", { recording_id: rid })).ok);
  await call("recording_trash", { recording_id: rid });
  const pp = await call("recording_purge", { recording_id: rid });
  check("recording_purge preview without confirm", pp.ok && pp.data.preview === true);
  check("recording_purge confirm", (await call("recording_purge", { recording_id: rid, confirm: true })).ok);
  check("recording gone", !(await call("recording_get", { recording_id: rid })).ok);
  const fp = await call("folder_delete", { folder_id: fid });
  check("folder_delete preview", fp.ok && fp.data.preview === true);
  check("folder_delete confirm", (await call("folder_delete", { folder_id: fid, confirm: true })).ok);

  // Automation tools: search, resources, and delete via confirm_action.
  const searched = await call("tool_search", { query: "delete" }, true);
  check("tool_search finds delete tools", searched.ok && searched.data.tools.some((t) => t.name === "resource_delete" && t.risk === "high"), searched.data);
  const types = await call("resource_types", {}, true);
  check("resource_types includes calendar_event", types.ok && types.data.resources.some((r) => r.resource === "calendar_event"), types.data);
  const start = new Date(Date.now() + 864e5).toISOString();
  const ev = await call("resource_create", { resource: "calendar_event", data: { title: "MCP smoke test event", starts_at: start, ends_at: start } }, true);
  check("resource_create calendar_event", ev.ok && ev.data.created?.id, ev.data);
  const eid = ev.data.created?.id;
  check("resource_create rejects unknown fields", !(await call("resource_create", { resource: "calendar_event", data: { title: "x", starts_at: start, ends_at: start, bogus: 1 } }, true)).ok);
  const evl = await call("resource_list", { resource: "calendar_event", q: "smoke test" }, true);
  check("resource_list search", evl.ok && evl.data.rows.some((r) => r.id === eid), evl.data);
  check("resource_update", (await call("resource_update", { resource: "calendar_event", id: eid, data: { location: "Room 1" } }, true)).data.updated?.location === "Room 1");
  const del = await call("resource_delete", { resource: "calendar_event", id: eid }, true);
  check("resource_delete only prepares", del.ok && del.data.needs_confirmation && del.data.confirmation_id, del.data);
  check("record still there before confirm", (await call("resource_get", { resource: "calendar_event", id: eid }, true)).ok);
  check("confirm_status pending", (await call("confirm_status", { confirmation_id: del.data.confirmation_id }, true)).data.status === "pending");
  check("confirm_action deletes", (await call("confirm_action", { confirmation_id: del.data.confirmation_id }, true)).ok);
  check("confirm_action can't be reused", !(await call("confirm_action", { confirmation_id: del.data.confirmation_id }, true)).ok);
  check("record gone after confirm", !(await call("resource_get", { resource: "calendar_event", id: eid }, true)).ok);

  // CRM and operations (staff only).
  if (names.includes("crm_pipeline_stages")) {
    const stages = await call("crm_pipeline_stages", {}, true);
    check("crm_pipeline_stages", stages.ok && stages.data.stages.length === 9, stages.data);
    check("resource_list contact", (await call("resource_list", { resource: "contact", limit: 1 }, true)).ok);
    check("resource_update can't move a deal stage", !(await call("resource_update", { resource: "deal", id: "00000000-0000-4000-8000-000000000000", data: { stage: "closed_won" } }, true)).ok);
    if (names.includes("reports_run")) {
      const rep = await call("reports_run", { kind: "pipeline_by_stage", range: "90d" }, true);
      check("reports_run", rep.ok && Array.isArray(rep.data.rows), rep.data);
      const series = await call("analytics_series", { metrics: ["signups"], range: "7d" }, true);
      check("analytics_series", series.ok && series.data.series[0].points.length === 7, series.data);
    }
    const plan = await call("plans_create", { name: "MCP smoke test plan", template: "simple" }, true);
    check("plans_create", plan.ok && plan.data.plan_id, plan.data);
    if (plan.ok) {
      const got = await call("plan_get", { plan_id: plan.data.plan_id }, true);
      check("plan_get has the template's groups", got.ok && got.data.groups.length > 0, got.data);
      const del = await call("resource_delete", { resource: "plan", id: plan.data.plan_id }, true);
      check("plan deleted after confirm", del.ok && (await call("confirm_action", { confirmation_id: del.data.confirmation_id }, true)).ok);
    }
  }

  const audit = await call("audit_log_list", { limit: 100 });
  check("audit_log_list has this run's calls", audit.ok && audit.data.activity.some((a) => a.tool === "echo_folder_delete"));

  console.log(`\n${failures ? `${failures} check(s) failed` : "All checks passed"}.`);
  process.exitCode = failures ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
