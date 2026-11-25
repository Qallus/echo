import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NumberPicker } from "@/components/numbers/number-picker";
import { requireUser } from "@/lib/data";

export const metadata = { title: "Add a number · Redial" };

// Pick another Redial number; checkout is the same store flow as the website.
export default async function NewNumberPage() {
  await requireUser();
  return (
    <div className="w-full space-y-6 px-4 py-6 sm:px-6 lg:px-8 2xl:px-10">
      <Button variant="ghost" size="sm" nativeButton={false} render={<Link href="/calls/numbers" />}><ArrowLeft /> Phone numbers</Button>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add another number</h1>
        <p className="text-sm text-muted-foreground">Search by area code, city or a word to spell. It&apos;s ready as soon as checkout finishes.</p>
      </div>
      <NumberPicker />
    </div>
  );
}
