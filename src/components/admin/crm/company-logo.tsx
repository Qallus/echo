import { Building2 } from "lucide-react";
import { cn } from "@/lib/utils";

// A client's logo, or a building icon when there isn't one.
export function CompanyLogo({ src, size = "sm", className }: { src?: string | null; size?: "sm" | "md" | "lg"; className?: string }) {
  const box = size === "lg" ? "size-14 rounded-xl" : size === "md" ? "size-10 rounded-lg" : "size-7 rounded-md";
  return (
    <span className={cn("grid shrink-0 place-items-center overflow-hidden border bg-muted", box, className)}>
      {src
        // eslint-disable-next-line @next/next/no-img-element -- small data URLs and outside links
        ? <img src={src} alt="" className="size-full object-contain p-0.5" referrerPolicy="no-referrer" />
        : <Building2 className={cn("text-muted-foreground", size === "lg" ? "size-6" : "size-4")} />}
    </span>
  );
}
