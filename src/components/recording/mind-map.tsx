// Simple horizontal mind map: one root, curved links to each branch.
const COLORS = ["#f59e0b", "#10b981", "#0ea5e9", "#8b5cf6", "#ec4899", "#84cc16", "#14b8a6", "#f97316"];

export function MindMap({ root, branches }: { root: string; branches: string[] }) {
  const rowH = 30;
  const height = Math.max(120, branches.length * rowH + 20);
  const rootX = 16, rootY = height / 2, bx = 300;

  return (
    <svg viewBox={`0 0 640 ${height}`} className="w-full" role="img" aria-label={`Mind map: ${root}`}>
      <text x={rootX} y={rootY - 8} className="fill-foreground text-[12px] font-medium">
        {root.length > 34 ? root.slice(0, 33) + "…" : root}
      </text>
      <line x1={rootX} x2={rootX + 230} y1={rootY} y2={rootY} stroke="#f59e0b" strokeWidth={2} />
      {branches.map((b, i) => {
        const y = 20 + i * rowH;
        const c = COLORS[i % COLORS.length];
        return (
          <g key={i}>
            <path d={`M ${rootX + 230} ${rootY} C ${rootX + 265} ${rootY}, ${bx - 35} ${y}, ${bx} ${y}`} fill="none" stroke={c} strokeWidth={1.5} />
            <line x1={bx} x2={630} y1={y} y2={y} stroke={c} strokeWidth={1.5} />
            <circle cx={630} cy={y} r={3.5} fill={c} />
            <text x={bx + 4} y={y - 5} className="fill-foreground text-[11px]">{b}</text>
          </g>
        );
      })}
    </svg>
  );
}
