"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background, BackgroundVariant, Controls, MiniMap, ReactFlow, useReactFlow,
  type Connection, type Edge, type EdgeChange, type NodeChange, applyNodeChanges,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useTheme } from "next-themes";
import { DRAG_TYPE } from "@/components/flows/block-library";
import { FlowBlockNode, type BlockNode } from "@/components/flows/flow-node";
import type { Issue, BlockType, Flow, FlowNode } from "@/lib/flows/schema";

// The Call Tree canvas. The flow JSON is the only state: blocks and
// connections are drawn from it, and every change is written back to it.

const NODE_TYPES = { block: FlowBlockNode };

export function FlowCanvas({ flow, issues, selected, focus, path, onSelect, onChange, onDropBlock }: {
  flow: Flow; issues: Issue[]; selected: string | null; focus: string | null;
  path: { nodes: Set<string>; edges: Set<string> } | null;
  onSelect: (id: string | null) => void;
  onChange: (update: (f: Flow) => Flow) => void;
  onDropBlock: (type: BlockType, pos: [number, number]) => void;
}) {
  const { resolvedTheme } = useTheme();
  // The server can't know the theme, so the first render is light (matching the
  // server HTML) and dark mode applies after mount. Colors come from the tokens.
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- switch to the real theme after hydration
  useEffect(() => setMounted(true), []);
  const rf = useReactFlow();
  const [edgeSel, setEdgeSel] = useState<string | null>(null);
  // Block sizes React Flow measured (the minimap and fit-to-view need them).
  const [sizes, setSizes] = useState<Record<string, { width: number; height: number }>>({});

  // Bring a newly added block into view.
  useEffect(() => {
    const n = focus ? flow.nodes.find((x) => x.id === focus) : null;
    if (n) void rf.setCenter(n.pos[0] + 128, n.pos[1] + 70, { zoom: Math.max(rf.getZoom(), 0.75), duration: 300 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when a new block is focused
  }, [focus]);

  const nodes = useMemo<BlockNode[]>(() => flow.nodes.map((n) => {
    const mine = issues.filter((i) => i.node === n.id);
    return {
      id: n.id, type: "block", position: { x: n.pos[0], y: n.pos[1] }, selected: n.id === selected, deletable: n.id !== flow.start, measured: sizes[n.id],
      data: { node: n, start: n.id === flow.start, visited: path ? path.nodes.has(n.id) : undefined, issue: mine.some((i) => i.level === "error") ? "error" : mine.length ? "warning" : undefined },
    };
  }), [flow, issues, selected, sizes, path]);

  const edges = useMemo<Edge[]>(() => flow.nodes.flatMap((n) => Object.entries(n.next).map(([out, to]) => ({
    id: `${n.id}:${out}`, source: n.id, sourceHandle: out, target: to, type: "smoothstep",
    selected: `${n.id}:${out}` === edgeSel, animated: Boolean(path?.edges.has(`${n.id}:${out}`)),
    style: path ? { strokeWidth: path.edges.has(`${n.id}:${out}`) ? 2.5 : 1, opacity: path.edges.has(`${n.id}:${out}`) ? 1 : 0.25 } : { strokeWidth: 1.5 },
  }))), [flow, edgeSel, path]);

  const onNodesChange = useCallback((changes: NodeChange<BlockNode>[]) => {
    const measured = changes.flatMap((c) => (c.type === "dimensions" && c.dimensions ? [[c.id, c.dimensions] as const] : []));
    if (measured.length) setSizes((s) => ({ ...s, ...Object.fromEntries(measured) }));
    const moved = applyNodeChanges(changes.filter((c) => c.type === "position" || c.type === "remove"), nodes);
    const removed = new Set(changes.flatMap((c) => (c.type === "remove" ? [c.id] : [])));
    if (removed.has(flow.start)) removed.delete(flow.start);
    const picked = changes.find((c) => c.type === "select" && c.selected);
    if (picked && picked.type === "select") onSelect(picked.id);
    if (!changes.some((c) => c.type === "position" || c.type === "remove")) return;
    const pos = new Map(moved.map((m) => [m.id, [Math.round(m.position.x), Math.round(m.position.y)] as [number, number]]));
    onChange((f) => ({
      ...f,
      nodes: f.nodes.filter((n) => !removed.has(n.id)).map((n): FlowNode => ({
        ...n,
        pos: pos.get(n.id) ?? n.pos,
        next: Object.fromEntries(Object.entries(n.next).filter(([, to]) => !removed.has(to))),
      })),
    }));
    if (selected && removed.has(selected)) onSelect(null);
  }, [nodes, flow.start, onChange, onSelect, selected]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    for (const c of changes) if (c.type === "select") setEdgeSel(c.selected ? c.id : null);
    const gone = changes.flatMap((c) => (c.type === "remove" ? [c.id] : []));
    if (!gone.length) return;
    onChange((f) => ({
      ...f,
      nodes: f.nodes.map((n) => ({ ...n, next: Object.fromEntries(Object.entries(n.next).filter(([out]) => !gone.includes(`${n.id}:${out}`))) })),
    }));
  }, [onChange]);

  // One connection per output: connecting again replaces it.
  const onConnect = useCallback((c: Connection) => {
    if (!c.source || !c.target || !c.sourceHandle || c.target === c.source || c.target === flow.start) return;
    onChange((f) => ({ ...f, nodes: f.nodes.map((n) => (n.id === c.source ? { ...n, next: { ...n.next, [c.sourceHandle!]: c.target! } } : n)) }));
  }, [onChange, flow.start]);

  return (
    <div className="flow-canvas h-full w-full" onDragOver={(e) => { if (e.dataTransfer.types.includes(DRAG_TYPE)) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; } }}
      onDrop={(e) => {
        const type = e.dataTransfer.getData(DRAG_TYPE) as BlockType;
        if (!type) return;
        e.preventDefault();
        const p = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
        onDropBlock(type, [Math.round(p.x - 128), Math.round(p.y - 30)]);
      }}>
      <ReactFlow<BlockNode, Edge>
        nodes={nodes} edges={edges} nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
        onPaneClick={() => { onSelect(null); setEdgeSel(null); }}
        colorMode={mounted && resolvedTheme === "dark" ? "dark" : "light"}
        snapToGrid snapGrid={[8, 8]} minZoom={0.25} maxZoom={2} fitView fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
        deleteKeyCode={["Backspace", "Delete"]} proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <Controls showInteractive={false} position="bottom-left" />
        <MiniMap position="bottom-right" pannable zoomable nodeColor="var(--muted-foreground)" nodeStrokeColor="var(--muted-foreground)" nodeBorderRadius={6} maskColor="color-mix(in oklch, var(--muted) 60%, transparent)" className="!hidden lg:!block" />
      </ReactFlow>
    </div>
  );
}
