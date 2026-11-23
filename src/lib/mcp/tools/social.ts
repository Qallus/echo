import "server-only";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { adminAudit } from "@/lib/admin/audit";
import { getPost, listAccounts, savePost } from "@/lib/social/posts";
import { publishPost } from "@/lib/social/publish";
import { POST_STATUSES, PROVIDER_LABEL, postProblems, type SocialPost, type SocialPostStatus } from "@/lib/social/types";
import type { McpContext } from "../auth";
import { ToolError, defineTool } from "../audit";
import { confirmable, prepare } from "../confirm";
import { check, id } from "./shared";

// Admin -> Social through the connector (social.manage): list accounts and
// posts, draft and schedule posts (they go out at their time from the
// scheduled job), and publish right away, which always asks a person first.

const SETUP = "Social posting isn't set up yet: run supabase/migrations/20261124110000_social_posting.sql in Supabase.";
const brief = (p: SocialPost) => ({
  id: p.id, status: p.status, body: p.body, image_url: p.image_url, link_url: p.link_url, account_ids: p.account_ids, campaign: p.campaign,
  scheduled_at: p.scheduled_at, published_at: p.published_at, results: p.results.map((r) => ({ account: r.name, ok: r.ok, url: r.url ?? null, error: r.error ?? null })),
});
const postArgs = {
  body: z.string().trim().min(1).max(5000).describe("The post text. LinkedIn up to 3,000 characters, Instagram 2,200."),
  account_ids: z.array(z.uuid()).min(1).max(20).describe("From social_accounts_list"),
  image_url: z.string().url().max(1000).optional().describe("https link to an image (Instagram needs one)"),
  link_url: z.string().url().max(1000).optional().describe("Links to redial.si get campaign tags automatically"),
  campaign: z.string().max(80).optional(),
};

confirmable("social_post_publish", async (ctx, p) => {
  const postId = String(p.post_id);
  const r = await publishPost(ctx.supabase, postId);
  await adminAudit(ctx.supabase, "social.post.publish", { type: "social_post", id: postId }, { status: r.status, via: "mcp" });
  if (r.status === "failed") throw new ToolError(r.error ?? "Couldn't publish.");
  return { targetId: postId, data: { status: r.status, results: r.results.map((x) => ({ account: x.name, ok: x.ok, url: x.url ?? null, error: x.error ?? null })) } };
});

export function registerSocialTools(server: McpServer, ctx: McpContext, perms: string[]) {
  if (!perms.includes("social.manage")) return;
  const base = { prefix: "", domain: "social" } as const;

  defineTool(server, ctx, "social_accounts_list", {
    ...base, risk: "read", title: "Social accounts",
    description: "Redial's connected LinkedIn, Facebook Page and Instagram accounts you can post to, with their status (reconnect when not active).",
    inputSchema: z.object({}),
  }, async () => {
    const { accounts, setup } = await listAccounts(ctx.supabase);
    if (!setup) throw new ToolError(SETUP);
    return { data: { accounts: accounts.map((a) => ({ id: a.id, network: PROVIDER_LABEL[a.provider], kind: a.kind, name: a.name, status: a.status, expires_at: a.expires_at })),
      note: accounts.length ? undefined : "Nothing connected yet: a person clicks Connect LinkedIn / Connect Facebook in Admin -> Social." } };
  });

  defineTool(server, ctx, "social_post_list", {
    ...base, risk: "read", title: "Social posts",
    description: "Posts in Admin -> Social, newest first: drafts, scheduled, published (with links) and failed.",
    inputSchema: z.object({ status: z.enum(POST_STATUSES.map((s) => s.id) as [SocialPostStatus, ...SocialPostStatus[]]).optional(), limit: z.number().int().min(1).max(100).default(25) }),
  }, async ({ status, limit }) => {
    let q = ctx.supabase.from("social_posts").select("*").order("created_at", { ascending: false }).limit(limit);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error && /does not exist|schema cache/i.test(error.message)) throw new ToolError(SETUP);
    check(error);
    return { data: { posts: ((data ?? []) as SocialPost[]).map(brief) } };
  });

  defineTool(server, ctx, "social_post_create", {
    ...base, risk: "write", title: "Draft or schedule a social post",
    description: "Saves a post in Admin -> Social as a draft, or scheduled for scheduled_at (ISO time, in the future), when the scheduled job publishes it. Nothing goes out now. Write in Redial's voice: plain words, one idea, no hype.",
    inputSchema: z.object({ ...postArgs, scheduled_at: z.iso.datetime().optional().describe("Leave out for a draft") }),
  }, async ({ body, account_ids, image_url, link_url, campaign, scheduled_at }) => {
    const r = await savePost(ctx.supabase, null, { body, account_ids, image_url, link_url, campaign, status: scheduled_at ? "scheduled" : "draft", scheduled_at: scheduled_at ?? null }, "mcp");
    if (r.error) throw new ToolError(r.error);
    return { targetId: r.id ?? null, data: { post_id: r.id, status: scheduled_at ? "scheduled" : "draft", message: r.ok } };
  });

  defineTool(server, ctx, "social_post_schedule", {
    ...base, risk: "write", title: "Schedule a draft",
    description: "Schedules an existing draft (or failed post) for scheduled_at, or moves a scheduled post back to draft with scheduled_at omitted.",
    inputSchema: z.object({ post_id: id("Post"), scheduled_at: z.iso.datetime().optional() }),
  }, async ({ post_id, scheduled_at }) => {
    const p = await getPost(ctx.supabase, post_id);
    if (!p) throw new ToolError("Post not found.");
    const r = await savePost(ctx.supabase, post_id, { body: p.body, image_url: p.image_url, link_url: p.link_url, campaign: p.campaign, account_ids: p.account_ids, status: scheduled_at ? "scheduled" : "draft", scheduled_at: scheduled_at ?? null }, "mcp");
    if (r.error) throw new ToolError(r.error);
    return { targetId: post_id, data: { status: scheduled_at ? "scheduled" : "draft", message: r.ok } };
  });

  defineTool(server, ctx, "social_post_publish", {
    ...base, risk: "high", previewOnly: true, title: "Publish a post now",
    description: "Publishes a draft or scheduled post to its accounts right now. Nothing goes out yet: this returns a preview and a confirmation_id. Show the person the text and accounts, and only after a clear yes call confirm_action.",
    inputSchema: z.object({ post_id: id("Post") }),
  }, async ({ post_id }) => {
    const p = await getPost(ctx.supabase, post_id);
    if (!p) throw new ToolError("Post not found.");
    if (!["draft", "scheduled", "failed", "partly_published"].includes(p.status)) throw new ToolError(`This post is ${p.status}.`);
    const { accounts } = await listAccounts(ctx.supabase);
    const chosen = accounts.filter((a) => p.account_ids.includes(a.id));
    const problems = postProblems(p, chosen);
    if (problems.length) throw new ToolError(problems.join(" "));
    return prepare(ctx, "social_post_publish", { post_id }, `Publish to ${chosen.map((a) => `${a.name} (${PROVIDER_LABEL[a.provider]})`).join(", ")} now`, {
      text: p.body, image_url: p.image_url, link_url: p.link_url, accounts: chosen.map((a) => a.name),
    });
  });
}
