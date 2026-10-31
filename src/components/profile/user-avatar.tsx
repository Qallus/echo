import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export function initials(name: string | null | undefined, email: string) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length) return (parts[0][0] + (parts.length > 1 ? parts.at(-1)![0] : "")).toUpperCase();
  return (email[0] ?? "?").toUpperCase();
}

const SIZES = { xs: "size-6 text-[10px]", sm: "size-7 text-xs", md: "size-9 text-sm", lg: "size-12 text-base", xl: "size-20 text-2xl" };

// Profile photo with an initials fallback.
export function UserAvatar({ name, email, src, size = "sm", className }: {
  name: string | null | undefined; email: string; src: string | null | undefined;
  size?: keyof typeof SIZES; className?: string;
}) {
  return (
    <Avatar className={cn(SIZES[size], className)}>
      {src && <AvatarImage src={src} alt="" />}
      <AvatarFallback className="bg-muted font-medium">{initials(name, email)}</AvatarFallback>
    </Avatar>
  );
}
