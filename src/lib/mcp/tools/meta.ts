import "server-only";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { McpContext } from "../auth";
import { defineTool } from "../audit";
import { confirmationStatus, runConfirmed } from "../confirm";
import { id } from "./shared";

// Finding tools, and confirming high-risk actions.
export function registerMetaTools(server: McpServer, ctx: McpContext) {
  defineTool(server, ctx, "tool_search", {
    prefix: "", domain: "meta", risk: "read", title: "Find tools",
    description: "Search the tools you can use by keyword (e.g. \"contact\", \"email\", \"delete\") or by domain. Each result says its risk: read (changes nothing), write (changes something), high (needs confirm_action).",
    inputSchema: z.object({
      query: z.string().trim().max(100).optional().describe("Words to look for in tool names and descriptions"),
      domain: z.string().max(40).optional(), risk: z.enum(["read", "write", "high"]).optional(),
    }),
  }, async ({ query, domain, risk }) => {
    const words = (query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
    const hits = ctx.catalog
      .filter((t) => (!domain || t.domain === domain) && (!risk || t.risk === risk))
      .map((t) => {
        const hay = `${t.name} ${t.title} ${t.description}`.toLowerCase();
        return { t, score: words.reduce((n, w) => n + (t.name.includes(w) ? 3 : hay.includes(w) ? 1 : 0), 0) };
      })
      .filter((x) => !words.length || x.score > 0)
      .sort((a, b) => b.score - a.score || a.t.name.localeCompare(b.t.name))
      .slice(0, 25)
      .map(({ t }) => ({ name: t.name, title: t.title, risk: t.risk, domain: t.domain, description: t.description.slice(0, 240) }));
    return { data: { tools: hits, domains: [...new Set(ctx.catalog.map((t) => t.domain))].sort() } };
  });

  defineTool(server, ctx, "confirm_action", {
    prefix: "", domain: "meta", risk: "high", title: "Confirm an action",
    description: "Runs a high-risk action that a tool prepared (it returned needs_confirmation and a confirmation_id). Only call this after showing the person what will happen and getting a clear yes. Each id works once, for 15 minutes, for the person and app that asked.",
    inputSchema: z.object({ confirmation_id: id("Confirmation") }),
  }, ({ confirmation_id }) => runConfirmed(ctx, confirmation_id));

  defineTool(server, ctx, "confirm_status", {
    prefix: "", domain: "meta", risk: "read", title: "Check a confirmation",
    description: "Whether a prepared action is still waiting (pending), was carried out (used) or expired.",
    inputSchema: z.object({ confirmation_id: id("Confirmation") }),
  }, async ({ confirmation_id }) => ({ targetId: confirmation_id, data: await confirmationStatus(ctx, confirmation_id) }));
}
