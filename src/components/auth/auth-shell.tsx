import { AudioLines } from "lucide-react";

// The centered card used by sign in, sign up and password pages.
export function AuthShell({ title, subtitle, children, footer }: {
  title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-muted/40 px-4 py-10">
      <div className="w-full max-w-sm space-y-6 rounded-xl border bg-background p-8 shadow-sm">
        <div className="space-y-2 text-center">
          <div className="flex items-center justify-center gap-2">
            <AudioLines className="size-5" />
            <span className="text-lg font-semibold tracking-[0.2em]">ECHO</span>
          </div>
          <h1 className="pt-2 text-base font-semibold">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
        {children}
      </div>
      {footer && <div className="text-sm text-muted-foreground">{footer}</div>}
    </div>
  );
}
