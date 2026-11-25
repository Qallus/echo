"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  closestCenter, DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors,
  type DragEndEvent, type DragOverEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Check, Eye, LayoutDashboard, Loader2, MoreHorizontal, Plus, RotateCcw, Settings2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FeatureMenu } from "@/components/shell/feature-menu";
import { saveDashboard } from "@/lib/dashboard/actions";
import { CARDS } from "@/lib/dashboard/cards";
import type { DashboardData } from "@/lib/dashboard/data";
import { BLANK, copy, newId, normalize, STANDARD, type Card, type CardType, type Layout, type Section } from "@/lib/dashboard/layout";
import { AddCardPanel, NEW_SECTION } from "./add-card";
import { CardShell } from "./card-shell";
import { RenderCard } from "./cards";
import { SectionView } from "./section-view";
import { StartChooser } from "./start-chooser";

// The Home dashboard: sections of cards you can move (drag in Customize),
// resize, hide, remove and add from "Add card". Saved to your account (or this
// browser until the dashboard SQL runs).

type Props = {
  initial: Layout | null; stored: boolean; data: DashboardData; slots: { setup?: React.ReactNode };
  liveAgent: boolean; crmReady: boolean;
};

const LOCAL = "redial.dashboard.v1";
const noop = () => () => {};

export function Dashboard(props: Props) {
  // Render after hydration, so a layout kept in this browser can be read.
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  if (!mounted) return <div className="space-y-4">{[0, 1, 2].map((i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-muted/60" />)}</div>;
  return <Inner {...props} />;
}

function readLocal(): Layout | null {
  try { return normalize(JSON.parse(localStorage.getItem(LOCAL) ?? "null")); } catch { return null; }
}

const QUICK: CardType[] = ["stat_calls", "notifications", "mini_calendar", "dialpad", "notepad", "weather", "recorder", "chart_calls", "stat_sms", "ask_echo"];

function Inner({ initial, stored, data, slots, liveAgent, crmReady }: Props) {
  const [layout, setLayout] = useState<Layout | null>(() => initial ?? (stored ? null : readLocal()));
  const [edit, setEdit] = useState(false);
  const [adding, setAdding] = useState(false);
  const [target, setTarget] = useState<string>(() => (initial ?? STANDARD).sections.at(-1)?.id ?? NEW_SECTION);
  const [features, setFeatures] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "local">("idle");
  const [active, setActive] = useState<string | null>(null);
  const saved = useRef(JSON.stringify(initial));

  // Save shortly after each change (nothing to save if it's what was loaded).
  useEffect(() => {
    if (!layout) return;
    const json = JSON.stringify(layout);
    if (json === saved.current) return;
    const t = setTimeout(async () => {
      setStatus("saving");
      const res = await saveDashboard(layout).catch(() => ({ error: "offline" }));
      saved.current = json;
      if (res.error) { try { localStorage.setItem(LOCAL, json); } catch {} setStatus("local"); }
      else setStatus("saved");
    }, 800);
    return () => clearTimeout(t);
  }, [layout]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  if (!layout) return <StartChooser name={data.firstName} onPick={(t) => { setLayout(copy(t === "blank" ? BLANK : STANDARD)); if (t === "blank") setTarget("mine"); }} />;

  const update = (fn: (l: Layout) => Layout) => setLayout((l) => (l ? fn(copy(l)) : l));
  const patchSection = (id: string, patch: Partial<Section>) => update((l) => ({ ...l, sections: l.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  const patchCard = (id: string, patch: Partial<Card>) =>
    update((l) => ({ ...l, sections: l.sections.map((s) => ({ ...s, cards: s.cards.map((c) => (c.id === id ? { ...c, ...patch } : c)) })) }));
  const removeCard = (id: string) => update((l) => ({ ...l, sections: l.sections.map((s) => ({ ...s, cards: s.cards.filter((c) => c.id !== id) })) }));
  const findSection = (l: Layout, cardId: string) => l.sections.find((s) => s.cards.some((c) => c.id === cardId));

  const addCard = (type: CardType, where = target) => {
    const card: Card = { id: newId(type), type, size: CARDS[type].size };
    const known = where !== NEW_SECTION && layout.sections.some((s) => s.id === where);
    const into = known ? where : newId("s");
    if (!known) setTarget(into);
    update((l) => {
      const sections = l.sections.some((s) => s.id === into) ? l.sections : [...l.sections, { id: into, title: "My cards", style: "grid" as const, cards: [] }];
      return { ...l, sections: sections.map((s) => (s.id === into ? { ...s, hidden: false, collapsed: false, cards: [...s.cards, card] } : s)) };
    });
  };
  const showCard = (type: CardType) => update((l) => ({ ...l, sections: l.sections.map((s) => ({ ...s, cards: s.cards.map((c) => (c.type === type ? { ...c, hidden: false } : c)) })) }));
  const openAdd = (sectionId?: string) => { if (sectionId) setTarget(sectionId); setAdding(true); };

  // Drag: sections up and down; cards within and between sections.
  const onStart = (e: DragStartEvent) => setActive(String(e.active.id));
  const onOver = (e: DragOverEvent) => {
    const { active: a, over } = e;
    if (!over || a.data.current?.kind !== "card") return;
    const overId = String(over.id);
    update((l) => {
      const from = findSection(l, String(a.id));
      const to = over.data.current?.kind === "drop" ? l.sections.find((s) => s.id === over.data.current?.section) : findSection(l, overId);
      if (!from || !to || from.id === to.id) return l;
      const card = from.cards.find((c) => c.id === String(a.id))!;
      const at = to.cards.findIndex((c) => c.id === overId);
      from.cards = from.cards.filter((c) => c.id !== card.id);
      to.cards.splice(at < 0 ? to.cards.length : at, 0, card);
      return l;
    });
  };
  const onEnd = (e: DragEndEvent) => {
    setActive(null);
    const { active: a, over } = e;
    if (!over || a.id === over.id) return;
    if (a.data.current?.kind === "section") {
      update((l) => {
        const i = l.sections.findIndex((s) => s.id === a.id), j = l.sections.findIndex((s) => s.id === over.id);
        return i < 0 || j < 0 ? l : { ...l, sections: arrayMove(l.sections, i, j) };
      });
      return;
    }
    update((l) => {
      const s = findSection(l, String(a.id));
      if (!s) return l;
      const i = s.cards.findIndex((c) => c.id === a.id), j = s.cards.findIndex((c) => c.id === over.id);
      if (i >= 0 && j >= 0) s.cards = arrayMove(s.cards, i, j);
      return l;
    });
  };

  const hiddenSections = layout.sections.filter((s) => s.hidden);
  const hiddenCards = layout.sections.flatMap((s) => s.cards.filter((c) => c.hidden).map((c) => ({ c, s })));
  const placed = layout.sections.flatMap((s) => s.cards).filter((c) => !c.hidden && c.type !== "get_started");
  const activeCard = active ? layout.sections.flatMap((s) => s.cards).find((c) => c.id === active) : null;
  const ctx = { data, slots, openFeatures: () => setFeatures(true) };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-full min-w-0 sm:w-auto sm:flex-1">
          <h1 className="text-xl font-semibold tracking-tight sm:text-3xl">{greeting()}{data.firstName ? `, ${data.firstName}` : ""}</h1>
          <p className="text-sm text-muted-foreground">{edit ? "Drag cards and sections, resize, hide or remove them. Changes save as you go." : "Your calls, texts, schedule and files at a glance."}</p>
        </div>
        <div className="flex w-full items-center gap-2 sm:w-auto">
        <span className="mr-auto text-xs text-muted-foreground sm:mr-0" aria-live="polite">
          {status === "saving" ? <><Loader2 className="mr-1 inline size-3 animate-spin" />Saving</> : status === "saved" ? <><Check className="mr-1 inline size-3" />Saved</> : status === "local" ? "Saved on this device" : null}
        </span>
        <Button variant="outline" onClick={() => openAdd()}><Plus /> Add card</Button>
        <Button variant={edit ? "default" : "outline"} onClick={() => setEdit((e) => !e)}>{edit ? <><Check /> Done</> : <><Settings2 /> Customize</>}</Button>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Layout options" />}><MoreHorizontal /></DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            {(hiddenSections.length > 0 || hiddenCards.length > 0) && (
              <DropdownMenuGroup>
                <DropdownMenuLabel>Hidden</DropdownMenuLabel>
                {hiddenSections.map((s) => <DropdownMenuItem key={s.id} onClick={() => patchSection(s.id, { hidden: false })}><Eye /> {s.title} (section)</DropdownMenuItem>)}
                {hiddenCards.slice(0, 12).map(({ c }) => <DropdownMenuItem key={c.id} onClick={() => patchCard(c.id, { hidden: false })}><Eye /> {CARDS[c.type].title}</DropdownMenuItem>)}
                <DropdownMenuSeparator />
              </DropdownMenuGroup>
            )}
            <DropdownMenuItem onClick={() => update((l) => ({ ...l, sections: [...l.sections, { id: newId("s"), title: "New section", style: "row", cards: [] }] }))}><Plus /> Add a section</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setLayout(copy(STANDARD))}><LayoutDashboard /> Reset to Standard</DropdownMenuItem>
            <DropdownMenuItem onClick={() => { setLayout(copy(BLANK)); setTarget("mine"); }}><RotateCcw /> Start from Blank</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>

      {layout.template === "blank" && placed.length < 3 && !edit && (
        <section className="rounded-2xl border bg-gradient-to-br from-primary/5 to-background p-5">
          <p className="flex items-center gap-2 font-semibold"><Sparkles className="size-4" /> Build your dashboard</p>
          <p className="mt-1 text-sm text-muted-foreground">Tap what you want to see. You can move and resize everything later with Customize.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {QUICK.filter((t) => !layout.sections.some((s) => s.cards.some((c) => c.type === t))).map((t) => {
              const m = CARDS[t];
              return <Button key={t} variant="outline" size="sm" onClick={() => addCard(t, layout.sections.find((s) => s.id === "mine")?.id ?? NEW_SECTION)}><m.icon /> {m.title}</Button>;
            })}
            <Button size="sm" onClick={() => openAdd()}><Plus /> More cards</Button>
          </div>
        </section>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onStart} onDragOver={onOver} onDragEnd={onEnd} onDragCancel={() => setActive(null)}>
        <SortableContext items={layout.sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-6">
            {layout.sections.map((s) => (
              <SectionView key={s.id} section={s} edit={edit} onChange={(p) => patchSection(s.id, p)} onAdd={() => openAdd(s.id)}
                onRemove={() => update((l) => ({ ...l, sections: l.sections.filter((x) => x.id !== s.id) }))}>
                {s.cards.filter((c) => (edit || !c.hidden) && (c.type !== "setup_progress" || slots.setup)).map((c) => (
                  <CardShell key={c.id} card={c} sectionId={s.id} style={s.style} edit={edit}
                    onSize={(size) => patchCard(c.id, { size })} onHide={(hidden) => patchCard(c.id, { hidden })} onRemove={() => removeCard(c.id)}>
                    <RenderCard card={c} ctx={{ ...ctx, set: (patch) => patchCard(c.id, { settings: { ...(c.settings ?? {}), ...patch } }) }} />
                  </CardShell>
                ))}
              </SectionView>
            ))}
          </div>
        </SortableContext>
        <DragOverlay>
          {activeCard ? <div className="rounded-xl border bg-background px-3 py-2 text-sm font-medium shadow-lg">{CARDS[activeCard.type].title}</div> : null}
        </DragOverlay>
      </DndContext>

      {edit && (
        <Button variant="outline" className="w-full border-dashed" onClick={() => update((l) => ({ ...l, sections: [...l.sections, { id: newId("s"), title: "New section", style: "row", cards: [] }] }))}>
          <Plus /> Add a section
        </Button>
      )}

      <AddCardPanel open={adding} onOpenChange={setAdding} layout={layout} target={target} onTarget={setTarget} onAdd={(t) => addCard(t)} onShow={showCard} />
      <FeatureMenu open={features} onOpenChange={setFeatures} line={data.hasLine} liveAgent={liveAgent} crmReady={crmReady} />
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}
