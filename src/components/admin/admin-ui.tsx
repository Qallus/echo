import { cn } from "@/lib/utils";

// Shared pieces for Super Admin pages.

export function AdminPage({ title, description, actions, children, className }: {
  title: string; description?: string; actions?: React.ReactNode; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn("w-full space-y-5 py-4 sm:py-8 px-4 sm:px-6 lg:px-8 2xl:px-10 md:space-y-8", className)}>
      {/* Phones: no title or description (the top bar names the area); the
          heading stays for screen readers and the actions slide sideways. */}
      <div className={cn("flex flex-wrap items-end justify-between gap-3", !actions && "max-md:sr-only")}>
        <div className="space-y-1 max-md:sr-only">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="slide-row flex min-w-0 items-center gap-2 max-md:w-full">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function StatCard({ label, value, hint, icon: Icon }: { label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="stat-card space-y-1 rounded-xl border bg-card p-4">
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">{Icon && <Icon className="size-3.5" />}{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Section({ title, description, actions, children }: { title: string; description?: string; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="slide-row flex min-w-0 max-w-full items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}
