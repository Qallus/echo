import { notFound } from "next/navigation";

// Temporary placeholder for sections built in later steps.
const upcoming: Record<string, string> = {
  search: "Search",
  templates: "Templates",
  explore: "Explore",
  billing: "Billing",
};

export function generateStaticParams() {
  return Object.keys(upcoming).map((section) => ({ section }));
}

export default async function Placeholder({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const title = upcoming[section];
  if (!title) notFound();
  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-10 space-y-2">
      <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground">Coming in a later step.</p>
    </div>
  );
}
