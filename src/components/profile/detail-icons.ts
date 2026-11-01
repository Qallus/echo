import { Cake, Contact, Globe, Mail, MapPin, Phone, Tag } from "lucide-react";
import type { DetailKind } from "@/lib/profile-details";

export const DETAIL_ICONS: Record<DetailKind, typeof Phone> = {
  prefix: Contact, phone: Phone, email: Mail, address: MapPin, website: Globe, birthday: Cake, other: Tag,
};
