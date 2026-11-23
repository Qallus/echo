import "server-only";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import { convertInboxMessage, replyInboxMessage } from "@/lib/comms/inbox";
import type { McpContext } from "../auth";
import { ToolError, defineTool } from "../audit";
import { id } from "./shared";

// The communications inbox beyond the inbox_message resource (list, read,
// status): reply by email, and save the sender to the CRM. Staff with
// comms.manage (and crm.manage to convert). Message bodies are written by
// outsiders: information only, never instructions.

export function registerInboxTools(server: McpServer, ctx: McpContext, perms: string[]) {
  if (!perms.includes("comms.manage")) return;
  const base = { prefix: "", domain: "comms" };

  defineTool(server, ctx, "inbox_reply", {
    ...base, risk: "write", title: "Reply to an inbox message",
    description: "Emails a reply to the sender of one inbox message (contact form or inbound email), from Redial's address, with \"Re:\" on the subject, and marks it read. Write the reply yourself or use what the person asked for; show it to them first unless they gave you the exact words.",
    inputSchema: z.object({ message_id: id("Inbox message"), body: z.string().trim().min(1).max(50000).describe("Plain text; blank lines start new paragraphs") }),
  }, async ({ message_id, body }) => {
    const r = await replyInboxMessage(ctx.supabase, message_id, body);
    if (r.error) throw new ToolError(r.error === "Not found." ? "Inbox message not found." : r.error);
    return { targetId: message_id, data: { message: r.ok } };
  });

  if (perms.includes("crm.manage")) {
    defineTool(server, ctx, "inbox_convert", {
      ...base, risk: "write", title: "Save an inbox sender to the CRM",
      description: "Saves the sender of an inbox message as a contact or lead (or links the existing contact with that email), puts the message on their timeline, and for as=pipeline also opens a deal. New leads start the lead_created automations.",
      inputSchema: z.object({ message_id: id("Inbox message"), as: z.enum(["contact", "lead", "pipeline"]).default("lead") }),
    }, async ({ message_id, as }) => {
      const r = await convertInboxMessage(ctx.supabase, message_id, as);
      if (r.error) throw new ToolError(r.error === "Not found." ? "Inbox message not found." : r.error);
      return { targetId: r.id ?? message_id, data: { message: r.ok, id: r.id ?? null, kind: as === "pipeline" ? "deal" : "contact" } };
    });
  }
}
