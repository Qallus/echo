import {
  CircleDot, Clock, Contact, GitBranch, Headset, Keyboard, ListOrdered, Mail, PhoneForwarded, PhoneIncoming, PhoneOff, PhoneOutgoing,
  Sparkles, Split, UserPen, Variable, Volume2, Webhook, type LucideIcon,
} from "lucide-react";
import { BLOCKS, type BlockType } from "@/lib/flows/schema";

// Lucide components for the icon names in BLOCKS.
const ICONS: Record<string, LucideIcon> = {
  "phone-incoming": PhoneIncoming, "volume-2": Volume2, keyboard: Keyboard, split: Split, clock: Clock, "phone-forwarded": PhoneForwarded,
  sparkles: Sparkles, headset: Headset, "list-ordered": ListOrdered, "circle-dot": CircleDot, "phone-outgoing": PhoneOutgoing,
  "git-branch": GitBranch, "phone-off": PhoneOff, variable: Variable, webhook: Webhook, contact: Contact, "user-pen": UserPen, mail: Mail,
};

export function BlockIcon({ type, className }: { type: BlockType; className?: string }) {
  const Icon = ICONS[BLOCKS[type].icon] ?? Volume2;
  return <Icon className={className} />;
}
