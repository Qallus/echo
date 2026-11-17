import { NumberPicker } from "@/components/numbers/number-picker";

export const metadata = {
  title: "Pick your number · Redial",
  description: "Search real local and toll-free phone numbers by area code, digits or a word, and pick the one you want for your Redial line.",
  alternates: { canonical: "/numbers" },
};

// Search and pick a phone number before signing up. The number is bought
// after payment (see /api/numbers/search).
export default function NumbersPage() {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <header className="max-w-2xl">
        <p className="text-sm font-medium text-muted-foreground">Your Redial number</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">Pick a number you&apos;ll love giving out.</h1>
        <p className="mt-4 text-lg text-muted-foreground">Search real numbers available right now: a local area code, a toll-free number, or one that spells a word.</p>
      </header>
      <div className="mt-10"><NumberPicker /></div>
    </div>
  );
}
