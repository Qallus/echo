import { Mail, MapPin, Phone } from "lucide-react";
import { COMPANY } from "@/lib/company";
import { ContactForm } from "./contact-form";

export const metadata = {
  title: "Contact · Echo",
  description: "Questions about Echo, sales, partnerships or support. We reply within one business day.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-10 px-4 py-16 sm:px-6 md:grid-cols-[1fr_1.2fr]">
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Talk to us</h1>
          <p className="text-muted-foreground">Questions about Echo, pricing for your team, partnerships or support. A real person replies within one business day.</p>
        </div>
        <ul className="space-y-3 text-sm">
          <li className="flex items-center gap-3"><Mail className="size-4 text-muted-foreground" /><a href={`mailto:${COMPANY.email}`} className="hover:underline">{COMPANY.email}</a></li>
          <li className="flex items-center gap-3"><Phone className="size-4 text-muted-foreground" /><a href={COMPANY.phoneHref} className="hover:underline">{COMPANY.phone}</a></li>
          <li className="flex items-start gap-3"><MapPin className="mt-0.5 size-4 text-muted-foreground" />{COMPANY.address}</li>
        </ul>
      </div>
      <ContactForm />
    </div>
  );
}
