import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";

/** Card with an uppercase eyebrow title (MT_v2 ProjectPage Panel). */
export function Panel({ title, action, className, children }: { title?: ReactNode; action?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={cn("rounded-2xl border border-outline-variant bg-card p-4 space-y-3", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

/** KPI tile (MT_v2 analytics/StatTile): tiny label, display numeral, one-line note. */
export function StatTile({ label, value, note, tone, className }: { label: string; value: ReactNode; note?: ReactNode; tone?: "primary" | "opportunity" | "revenue" | "destructive"; className?: string }) {
  const color = tone === "primary" ? "text-primary" : tone === "opportunity" ? "text-[var(--domain-opportunity)]" : tone === "revenue" ? "text-[var(--domain-revenue)]" : tone === "destructive" ? "text-destructive" : "";
  return (
    <div className={cn("flex flex-col gap-2 rounded-2xl bg-card border border-outline-variant p-4", className)}>
      <span className="text-[0.75rem] text-muted-foreground">{label}</span>
      <span className={cn("text-[1.75rem] leading-none font-medium tracking-tight font-display", color)}>{value}</span>
      {note && <span className="text-[0.6875rem] text-muted-foreground">{note}</span>}
    </div>
  );
}

/** Violet-tinted insight banner (MT_v2 Outreach "Who's in your list"). */
export function Insight({ icon = "lightbulb", eyebrow, children, className }: { icon?: string; eyebrow: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex gap-3 rounded-2xl border border-primary/15 bg-accent/50 p-4", className)}>
      <span className="mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><Icon name={icon} size={16} filled /></span>
      <div className="min-w-0 space-y-1">
        <div className="text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{eyebrow}</div>
        <div className="text-[0.9375rem] leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon: string; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-outline-variant bg-card py-14 px-6 text-center space-y-3">
      <Icon name={icon} size={28} className="text-muted-foreground" />
      <p className="text-[0.9375rem] font-medium">{title}</p>
      {children && <p className="text-sm text-muted-foreground max-w-md mx-auto">{children}</p>}
      {action && <div className="pt-1">{action}</div>}
    </div>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground", className)}>{children}</div>;
}
