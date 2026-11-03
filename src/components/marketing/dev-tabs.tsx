"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type DevTab = { id: string; label: string; icon: React.ReactNode; content: React.ReactNode };

// Developers page tabs. Follows the URL hash (#mcp, #api, #webhooks), so links
// like "Read the API reference" open the right tab and tabs can be shared.
export function DevTabs({ tabs }: { tabs: DevTab[] }) {
  const [tab, setTab] = useState(tabs[0].id);

  useEffect(() => {
    const fromHash = () => {
      const id = window.location.hash.slice(1);
      if (tabs.some((t) => t.id === id)) {
        setTab(id);
        document.getElementById("docs")?.scrollIntoView({ block: "start" });
      }
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [tabs]);

  return (
    <Tabs id="docs" value={tab} onValueChange={(v) => { setTab(v as string); history.replaceState(null, "", `#${v}`); }} className="scroll-mt-24 gap-0 border-t pt-8">
      <TabsList variant="line" className="max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((t) => (
          <TabsTrigger key={t.id} value={t.id} className="gap-1.5">{t.icon}{t.label}</TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((t) => <TabsContent key={t.id} value={t.id}>{t.content}</TabsContent>)}
    </Tabs>
  );
}
