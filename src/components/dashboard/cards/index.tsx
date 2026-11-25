"use client";

import type { DashboardData } from "@/lib/dashboard/data";
import type { Card } from "@/lib/dashboard/layout";
import { ChartCard } from "./charts";
import { GetStartedCard, WhatsNewCard } from "./info";
import { LiveCallCard, MyAgentsCard, NextUpCard, NotificationsCard, RecentCallsCard, RecentFilesCard, RecentTextsCard } from "./lists";
import { MiniCalendarCard, UpcomingCard } from "./schedule";
import { StatCard } from "./stats";
import { AllFeaturesCard, AskEchoCard, ClockCard, DialpadCard, InstallCard, NotepadCard, QuickLinksCard, RecorderCard, SearchCard, WeatherSlot } from "./tools";

export type CardCtx = {
  data: DashboardData;
  set: (patch: Record<string, unknown>) => void;
  openFeatures: () => void;
  /** Server-rendered pieces (the Redial setup progress). */
  slots: { setup?: React.ReactNode };
};

// One card type -> its component.
export function RenderCard({ card, ctx }: { card: Card; ctx: CardCtx }) {
  const { data, set } = ctx;
  const s = card.settings;
  switch (card.type) {
    case "get_started": return <GetStartedCard settings={s} set={set} />;
    case "whats_new": return <WhatsNewCard settings={s} set={set} />;
    case "setup_progress": return <>{ctx.slots.setup ?? null}</>;
    case "install_app": return <InstallCard />;
    case "search": return <SearchCard />;
    case "all_features": return <AllFeaturesCard open={ctx.openFeatures} />;
    case "clock": return <ClockCard />;
    case "weather": return <WeatherSlot data={data} />;
    case "dialpad": return <DialpadCard data={data} />;
    case "recorder": return <RecorderCard />;
    case "notepad": return <NotepadCard settings={s} set={set} />;
    case "ask_echo": return <AskEchoCard />;
    case "quick_links": return <QuickLinksCard />;
    case "notifications": return <NotificationsCard data={data} />;
    case "next_up": return <NextUpCard data={data} />;
    case "live_call": return <LiveCallCard data={data} />;
    case "recent_calls": return <RecentCallsCard data={data} />;
    case "recent_texts": return <RecentTextsCard data={data} />;
    case "recent_files": return <RecentFilesCard data={data} />;
    case "my_agents": return <MyAgentsCard data={data} />;
    case "mini_calendar": return <MiniCalendarCard data={data} />;
    case "upcoming": return <UpcomingCard data={data} />;
    case "chart_calls": case "chart_texts": case "chart_recordings": case "chart_outcomes": return <ChartCard type={card.type} data={data} />;
    default: return <StatCard type={card.type} data={data} />;
  }
}
