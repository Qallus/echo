import { AskHome } from "@/components/chat/ask-home";

export default async function AskPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = ((await searchParams).q ?? "").trim().slice(0, 2000);
  return <AskHome initial={q || undefined} />;
}
