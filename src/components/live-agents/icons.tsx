import { createElement } from "react";
import {
  BadgeCheck, CalendarCheck, Contact, CreditCard, Filter, House, Languages, LifeBuoy, Mail, Moon, PhoneForwarded, PhoneIncoming, PhoneOutgoing,
  Scale, ShieldCheck, ShoppingBag, Sparkles, Star, Stethoscope, Wrench, Zap, CircleDot, PcCase, Laptop, Tablet, Monitor, Headset, Headphones,
  Webcam, Smartphone, Phone, Cable, Wifi, BatteryCharging, Building2, Users, DoorClosed, LampDesk, VolumeX, type LucideIcon,
} from "lucide-react";
import { BADGES, type Skill } from "@/lib/live-agents/types";
import { cn } from "@/lib/utils";

// Skills and badges store a lucide icon name; these are the ones in use.
const ICONS: Record<string, LucideIcon> = {
  "phone-incoming": PhoneIncoming, "phone-forwarded": PhoneForwarded, "phone-outgoing": PhoneOutgoing, "calendar-check": CalendarCheck,
  languages: Languages, "life-buoy": LifeBuoy, filter: Filter, "shopping-bag": ShoppingBag, moon: Moon, stethoscope: Stethoscope, scale: Scale,
  wrench: Wrench, house: House, home: House, "credit-card": CreditCard, contact: Contact, mail: Mail,
  "badge-check": BadgeCheck, "shield-check": ShieldCheck, zap: Zap, star: Star, sparkles: Sparkles,
  "pc-case": PcCase, laptop: Laptop, tablet: Tablet, monitor: Monitor, headset: Headset, headphones: Headphones, webcam: Webcam,
  smartphone: Smartphone, phone: Phone, cable: Cable, wifi: Wifi, "battery-charging": BatteryCharging, "building-2": Building2, users: Users,
  "door-closed": DoorClosed, "lamp-desk": LampDesk, "volume-x": VolumeX,
};

// A lucide icon by its stored name (a dot when the name isn't mapped).
export function IconByName({ name, className }: { name: string; className?: string }) {
  return createElement(ICONS[name] ?? CircleDot, { className });
}

export function SkillChip({ skill, className }: { skill: Skill; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs text-muted-foreground", className)}>
      <IconByName name={skill.icon} className="size-3.5" /> {skill.label}
    </span>
  );
}

export function AgentBadges({ badges, demo }: { badges: string[]; demo: boolean }) {
  if (!badges.length && !demo) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {demo && <span className="inline-flex items-center rounded-md bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-800 dark:text-amber-300">Demo profile</span>}
      {badges.filter((b) => BADGES[b]).map((b) => (
        <span key={b} className="inline-flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
          <IconByName name={BADGES[b].icon} className="size-3.5" /> {BADGES[b].label}
        </span>
      ))}
    </div>
  );
}
