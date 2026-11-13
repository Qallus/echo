import { cn } from "@/lib/utils";

// Photo, or initials on a soft tile, with a green dot when available now.
const TINTS = ["bg-sky-500/15 text-sky-800 dark:text-sky-300", "bg-amber-500/15 text-amber-800 dark:text-amber-300", "bg-violet-500/15 text-violet-800 dark:text-violet-300", "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300", "bg-rose-500/15 text-rose-800 dark:text-rose-300"];

export function AgentAvatar({ name, url, online, size = "md" }: { name: string; url: string | null; online: boolean; size?: "md" | "lg" }) {
  const initials = name.replace(/\./g, "").split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  const tint = TINTS[[...name].reduce((n, c) => n + c.charCodeAt(0), 0) % TINTS.length];
  const box = size === "lg" ? "size-24 rounded-2xl text-3xl" : "size-14 rounded-xl text-lg";
  return (
    <div className="relative shrink-0">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className={cn(box, "object-cover")} />
      ) : (
        <div className={cn(box, tint, "flex items-center justify-center font-semibold")} aria-hidden>{initials}</div>
      )}
      {online && <span className="absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full border-2 border-background bg-emerald-500" title="Available now" />}
    </div>
  );
}
