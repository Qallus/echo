"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CARDS } from "@/lib/dashboard/cards";
import type { DashboardData, DayPoint } from "@/lib/dashboard/data";
import { AMBER, Empty, Frame, MINT, ROSE, SKY } from "../kit";

// Charts (Recharts, styled like shadcn charts): calls and texts by day,
// recordings by week, and how this month's calls ended.

const short = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric" });
const axis = { fontSize: 11, fill: "var(--muted-foreground)" };
const tip = { contentStyle: { background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12, color: "var(--popover-foreground)" }, cursor: { fill: "var(--muted)", opacity: 0.4 } };

function TwoSeries({ points, a, b, kind }: { points: DayPoint[]; a: string; b?: string; kind: "area" | "bar" }) {
  const data = points.map((p) => ({ day: short(p.day), [a]: p.a, ...(b ? { [b]: p.b } : {}) }));
  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        {kind === "area" ? (
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <defs>
              <linearGradient id="dash-a" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={SKY} stopOpacity={0.35} /><stop offset="100%" stopColor={SKY} stopOpacity={0} /></linearGradient>
              <linearGradient id="dash-b" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={MINT} stopOpacity={0.35} /><stop offset="100%" stopColor={MINT} stopOpacity={0} /></linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="day" tick={axis} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip {...tip} />
            <Area type="monotone" dataKey={a} stroke={SKY} strokeWidth={2} fill="url(#dash-a)" />
            {b && <Area type="monotone" dataKey={b} stroke={MINT} strokeWidth={2} fill="url(#dash-b)" />}
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          </AreaChart>
        ) : (
          <BarChart data={data} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="day" tick={axis} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip {...tip} />
            <Bar dataKey={a} stackId="x" fill={SKY} radius={b ? [0, 0, 4, 4] : [4, 4, 4, 4]} />
            {b && <Bar dataKey={b} stackId="x" fill={MINT} radius={[4, 4, 0, 0]} />}
            <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

export function ChartCard({ type, data }: { type: "chart_calls" | "chart_texts" | "chart_recordings" | "chart_outcomes"; data: DashboardData }) {
  const meta = CARDS[type];
  if (type === "chart_calls") {
    return <Frame title={meta.title} icon={meta.icon} href="/calls?tab=phone">
      {data.calls ? <TwoSeries points={data.calls.series} a="Inbound" b="Outbound" kind="area" /> : <Empty>Needs a Redial line.</Empty>}
    </Frame>;
  }
  if (type === "chart_texts") {
    return <Frame title={meta.title} icon={meta.icon} href="/sms">
      {data.texts ? <TwoSeries points={data.texts.series} a="Sent" b="Received" kind="bar" /> : <Empty>Texts show here once SMS is on.</Empty>}
    </Frame>;
  }
  if (type === "chart_recordings") {
    return <Frame title={meta.title} icon={meta.icon} href="/library/all">
      <TwoSeries points={data.recordings.series} a="Recordings" kind="bar" />
    </Frame>;
  }
  const slices = data.calls?.outcomes ?? [];
  const colors = [SKY, MINT, AMBER, ROSE, "oklch(0.6 0.15 300)"];
  return (
    <Frame title={meta.title} icon={meta.icon} href="/calls?tab=phone">
      {!slices.length ? <Empty>No calls this month yet.</Empty> : (
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={slices} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="85%" paddingAngle={2} stroke="var(--card)">
                {slices.map((s, i) => <Cell key={s.name} fill={colors[i % colors.length]} />)}
              </Pie>
              <Tooltip {...tip} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </Frame>
  );
}
