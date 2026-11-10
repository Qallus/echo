# AI agents

AI agents can run parts of the business through the Redial MCP. Examples: Paperclip, Hermes, OpenClaw and Herdr on Coolify, or a ChatGPT automation.

Each agent has its own key and its own permissions and limits, which you set in **Admin → AI → Agents**. Everything an agent does is logged. Anything risky waits for you to approve it.

The plan this is part of: `docs/REDIAL_GROWTH_AND_AUTOMATION_PLAN.md` (Track C).

## How it works

**Each agent is an account.**
- The agent is a real user, `agent-<handle>@agents.redial.si`, with the staff role `agent`. The admin page creates it; nobody signs up for it.
- Its **key** is `rdk_<handle>_<secret>`. The secret is that account's password. The key is shown once when it's made and never stored.

**How it connects.**
- The agent calls `https://echo.redial.si/api/mcp` with the header `Authorization: Bearer <key>`.
- The MCP signs the agent in with its key (`src/lib/mcp/agents.ts`), so every call runs **as the agent, under RLS**. No service-role key is involved.
- The session is reused until it's about to expire.

**What it can reach.**
- An agent's staff permissions are the ones picked for it. They can never be more than the permissions of the person who made it (`admin_agent_save`).
- An active agent counts as two-step verified (`private.mfa_verified`), because its key is the credential.
- It can also use its own account's data, like any user.

**Checks on every call.** Each request rereads the agent's row and is refused (HTTP 401) if:
- the agent is paused;
- the key has expired;
- the key was replaced after this session signed in;
- the request comes from an IP address that isn't on the allowlist.

## Limits (checked before every tool call)

The checks are in `src/lib/mcp/agent-gate.ts`.

| Setting | Effect |
|---|---|
| Permissions | Which admin data it can read and change (the database enforces these) |
| Areas | Limit it to tool areas: records, recordings, email, backlog, account. None picked means all |
| Read only | Only read tools |
| Changes per 24 hours | Cap on write and high-risk calls |
| High-risk actions per 24 hours | Cap on high-risk calls |
| Always ask before | Tool names that wait for your approval, on top of the high-risk ones |
| IP allowlist | Only from these addresses (for example, the Coolify server) |
| Key expires | The key stops working after this date |
| Pause | Turns the key off right away. **Pause all agents** stops every one of them |

## Approvals

These actions wait for a person:
- every **high-risk** action: deletes, bulk sends, money, access changes, and `confirm_action`;
- any tool listed under "Always ask before".

**What happens:**
1. The tool doesn't run. The agent gets `needs_approval` and an `approval_id`.
2. You get a notification ("Agent approval requests" in your notification settings), and the request shows at the top of **Admin → AI → Agents** with the exact request. Approve or decline it there.
3. The agent checks `approval_status`. Once it's approved, the agent calls `approval_run`, which runs the exact request once.
4. A request expires after 24 hours. An approved one stays usable for at least an hour.

**Previews don't need approval.** Tools that only prepare something (`resource_delete`, `email_send_prepare`) run straight away. What the agent then needs your approval for is the `confirm_action` that actually does it.

**One catch:** a prepared confirmation lasts 15 minutes. If you approve after that, `approval_run` fails and the agent has to prepare it again and ask again.

**Tools only agents get:**
- `agent_whoami`: its permissions, limits and usage today;
- `approval_list`;
- `approval_status`;
- `approval_run`.

## Audit

- Every call is written to `mcp_audit_log` under the agent's user. A request held for approval is logged as `approval_request`.
- Admin changes are written to `admin_audit_log`: `agent.create`, `agent.update`, `agent.remove`, `agent.approval.approve` and `agent.approval.decline`.
- Admin → AI → Agents shows calls and failures in the last 24 hours.

## Setting up an agent (Jeremy)

1. Go to Admin → AI → Agents and click **New agent**. Name it, pick where it runs, and choose its permissions, areas and limits. Start narrow and widen it later.
2. Copy the key and the example configuration. The key isn't shown again.
3. In the harness, add an MCP server. The URL is `https://echo.redial.si/api/mcp`, and the header is `Authorization: Bearer <key>`. Most harnesses accept this JSON:

   ```json
   { "mcpServers": { "redial": { "type": "http", "url": "https://echo.redial.si/api/mcp", "headers": { "Authorization": "Bearer rdk_..." } } } }
   ```

4. Tell the agent to call `agent_whoami` first.
5. If all its calls come from your Coolify server, add the server's IP address to the allowlist.
6. To change the key, click **New key**. The old key stops working on its next call.
7. **Remove** deletes the agent's account and key.

## Rules for the code

- **People** keep using OAuth (`docs/MCP_CONNECTOR.md`). Agents never get OAuth tokens, and people never use `rdk_` keys.
- **Agents aren't staff people.** They're hidden from the staff and team lists, and the staff role picker refuses `@agents.redial.si` accounts.
- **The service-role key** is only used in `src/lib/admin/actions/agents.ts`, to create, re-key and delete an agent's account. That happens after `requireStaff("staff.manage")`, alongside the audited `admin_agent_save` / `admin_agent_remove` calls. This is the Super Admin auth exception in `CLAUDE.md`.
- **Tests:** `supabase/tests/agents_rls.sql` (21 checks).
