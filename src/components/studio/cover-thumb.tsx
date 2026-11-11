import { AudioLines } from "lucide-react";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: "size-8 rounded-md",
  md: "size-10 rounded-md",
  lg: "size-12 rounded-lg",
};

// Square cover for a recording; falls back to a waveform tile.
export function CoverThumb({ image, alt, size = "md", className }: { image?: string | null; alt?: string; size?: keyof typeof SIZES; className?: string }) {
  const base = cn("shrink-0 overflow-hidden border", SIZES[size], className);
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt={alt || "Recording cover"} className={cn(base, "object-cover")} />;
  }
  return (
    <span className={cn(base, "flex items-center justify-center bg-muted text-muted-foreground")}>
      <AudioLines className="size-1/2" />
    </span>
  );
}
