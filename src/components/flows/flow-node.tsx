"use client";

import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { AlertTriangle } from "lucide-react";
import { BlockIcon } from "@/components/flows/block-icon";
import { BLOCKS, outputsOf, type FlowNode as FlowBlock } from "@/lib/flows/schema";
import { cn } from "@/lib/utils";

// One block on the Call Tree canvas: an input handle on top, a short
// summary, and an output chip (with its own handle) for each transition.

export type BlockNodeData = { node: FlowBlock; issue?: "error" | "warning"; start: boolean };
export type BlockNode = Node<BlockNodeData, "block">;

const OUT_LABEL: Record<string, string> = {
  next: "Next", noInput: "No input", noMatch: "No match", open: "Open", closed: "Closed", holiday: "Holiday", connected: "Connected",
  noAnswer: "No answer", busy: "Busy", failed: "Failed", handoff: "Hand off", hungUp: "Hung up", error: "Error", none: "None",
  answered: "Answered", timedOut: "Timed out", pressed: "Pressed key", recorded: "Recorded", saved: "Saved", success: "Success",
  found: "Found", notFound: "Not found", sent: "Sent",
};

export function outLabel(n: FlowBlock, out: string): string {
  const c = n.config as { options?: { out: string; key?: string; speech?: string[] }[]; rules?: { out: string; variable: string; op: string; value: string }[]; intents?: { out: string; label: string }[] };
  const opt = c.options?.find((o) => o.out === out);
  if (opt) return opt.key ? `Pressed ${opt.key}` : `Said "${opt.speech?.[0] ?? out}"`;
  const rule = c.rules?.find((r) => r.out === out);
  if (rule) return `${rule.variable} ${rule.op} ${rule.value}`.trim();
  const intent = c.intents?.find((i) => i.out === out);
  if (intent) return intent.label;
  return OUT_LABEL[out] ?? out;
}

function summary(n: FlowBlock): string {
  const c = n.config as Record<string, unknown> & { prompt?: { text?: string; audioId?: string }; targets?: unknown[]; tz?: string; url?: string; instructions?: string; flowId?: string; maxSeconds?: number };
  if (c.prompt?.audioId) return "Plays a Studio recording";
  if (c.prompt?.text) return `“${c.prompt.text}”`;
  switch (n.type) {
    case "trigger.call": return "Calls to the lines this flow runs on";
    case "connect": return c.targets?.length ? `Rings ${c.targets.length} ${c.targets.length === 1 ? "destination" : "destinations"}` : "Choose who to ring";
    case "hours": return c.tz ? `Hours in ${c.tz}` : "Set the hours";
    case "http": return c.url ?? "";
    case "ai": return c.instructions ? String(c.instructions).slice(0, 80) : "Your assistant takes the call";
    case "voicemail": return `Up to ${c.maxSeconds ?? 120} seconds`;
    case "hangup": return "Ends the call";
    default: return BLOCKS[n.type].label;
  }
}

function BlockNodeView({ data, selected }: NodeProps<BlockNode>) {
  const { node, issue, start } = data;
  const outs = outputsOf(node);
  return (
    <div className={cn("w-64 rounded-xl border bg-card text-card-foreground shadow-sm transition-shadow", selected ? "border-foreground ring-2 ring-foreground/15" : "hover:shadow-md", issue === "error" && !selected && "border-destructive/60")}>
      {!start && <Handle type="target" position={Position.Top} className="!size-2.5 !border-2 !border-background !bg-muted-foreground" />}
      <div className="flex items-center gap-2.5 border-b px-3 py-2.5">
        <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", start ? "bg-foreground text-background" : "bg-muted")}><BlockIcon type={node.type} className="size-3.5" /></span>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold">{node.label || BLOCKS[node.type].label}</p>
        {issue && <AlertTriangle className={cn("size-3.5 shrink-0", issue === "error" ? "text-destructive" : "text-amber-500")} aria-label={issue === "error" ? "Has errors" : "Has warnings"} />}
      </div>
      <p className="line-clamp-2 px-3 pt-2 text-xs leading-snug text-muted-foreground">{summary(node)}</p>
      {outs.length > 0 ? (
        <div className="flex flex-wrap gap-1.5 px-3 pt-2 pb-3">
          {outs.map((out) => {
            const linked = Boolean(node.next[out]);
            return (
              <span key={out} className={cn("relative rounded-md border px-1.5 py-0.5 text-[10px] font-medium", linked ? "bg-muted text-foreground" : "border-dashed text-muted-foreground")}>
                {outLabel(node, out)}
                <Handle type="source" id={out} position={Position.Bottom} className="!-bottom-[5px] !size-2.5 !border-2 !border-background !bg-foreground" />
              </span>
            );
          })}
        </div>
      ) : <div className="pb-3" />}
    </div>
  );
}

export const FlowBlockNode = memo(BlockNodeView);
