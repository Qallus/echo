import { Badge } from "@/components/ui/badge";

export function OrderStatusBadge({ status }: { status: string }) {
  const tone = status === "paid" ? "text-emerald-700 dark:text-emerald-400" : status.includes("refund") ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground";
  return <Badge variant="outline" className={`capitalize ${tone}`}>{status.replace("_", " ")}</Badge>;
}
