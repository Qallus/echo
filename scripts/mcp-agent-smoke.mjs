// Checks an AI agent key against the Redial MCP server:
//   MCP_AGENT_KEY=rdk_... npm run mcp:agent-smoke
// Optional: MCP_URL (default http://localhost:3000/api/mcp).
// Use a test agent (Admin -> AI -> Agents) with the Backlog area allowed and
// not read-only. It adds one backlog item ("Agent smoke test"), marks it won't
// do, and asks to delete it, which must wait for a person's approval (decline
// it in Admin -> AI -> Agents afterwards).

const URL_ = process.env.MCP_URL ?? "http://localhost:3000/api/mcp";
const KEY = process.env.MCP_AGENT_KEY;
let nextId = 1;
let failures = 0;

async function rpc(method, params, token = KEY) {
  const res = await fetch(URL_, {
    method: "POST",
    headers: {
      "Content-Type": "application/json", Accept: "application/json, text/event-stream", "MCP-Protocol-Version": "2025-06-18",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: nextId++, method, params }),
  });
  const body = await res.text();
  if (!res.ok) return { status: res.status, body };
  const json = body.trimStart().startsWith("{") ? JSON.parse(body) : JSON.parse(body.split("\n").filter((l) => l.startsWith("data:")).at(-1).slice(5));
  return { status: res.status, json };
}

async function call(name, args = {}) {
  const r = await rpc("tools/call", { name, arguments: args });
  if (r.json?.error) return { ok: false, data: r.json.error.message };
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
  if (!KEY?.startsWith("rdk_")) { console.log("Set MCP_AGENT_KEY to an rdk_ agent key."); process.exitCode = 1; return; }
  const bad = await rpc("tools/list", {}, `${KEY.slice(0, -4)}xxxx`);
  check("A wrong key is refused (401)", bad.status === 401, bad.status);

  await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "redial-agent-smoke", version: "1" } });
  const list = await rpc("tools/list", {});
  const names = (list.json?.result?.tools ?? []).map((t) => t.name);
  check(`Tools listed (${names.length})`, names.length > 0, list);

  const me = await call("agent_whoami");
  check("agent_whoami answers", me.ok && typeof me.data === "object", me.data);
  console.log("      agent:", JSON.stringify(me.data).slice(0, 400));

  const found = await call("tool_search", { query: "backlog" });
  check("tool_search works", found.ok, found.data);

  const read = await call("echo_dev_request_list", { limit: 1 });
  check("A read tool runs", read.ok, read.data);

  const made = await call("echo_dev_request_create", { title: "Agent smoke test (safe to delete)", kind: "task", area: "other", priority: "low", details: "Made by scripts/mcp-agent-smoke.mjs." });
  const id = made.data?.request?.id ?? made.data?.item?.id ?? made.data?.id;
  check("A write tool runs and is audited", made.ok && Boolean(id), made.data);

  if (id) {
    const upd = await call("echo_dev_request_update", { request_id: id, status: "wont_do" });
    check("An update runs", upd.ok, upd.data);
    const del = await call("echo_dev_request_delete", { request_id: id, confirm: true });
    check("A delete waits for a person (needs_approval)", del.ok && del.data?.needs_approval === true, del.data);
    if (del.data?.approval_id) {
      const st = await call("approval_status", { approval_id: del.data.approval_id });
      check("approval_status shows it pending", st.ok && /pending/i.test(JSON.stringify(st.data)), st.data);
    }
  }

  console.log(`\n${failures ? `${failures} failed` : "All passed"}. Decline the delete request in Admin -> AI -> Agents.`);
  process.exitCode = failures ? 1 : 0;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
