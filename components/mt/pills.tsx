import { STATUS_LABEL, band, excludedReason, type Fit, type Status } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Icon } from "./icon";

/** Uppercase status pill (MT_v2 Projects STATUS_TONE). */
const STATUS_TONE: Record<Status, string> = {
  found: "bg-surface-2 text-foreground",
  shortlisted: "bg-primary-container text-primary-container-foreground",
  drafting: "bg-primary-container text-primary-container-foreground",
  review: "bg-primary text-primary-foreground",
  applying: "bg-primary text-primary-foreground",
  applied: "bg-tertiary-container text-tertiary-container-foreground",
  interview: "bg-[var(--domain-opportunity)] text-white",
  offer: "bg-[var(--domain-opportunity)] text-white",
  rejected: "bg-surface-2 text-muted-foreground",
  withdrawn: "bg-surface-2 text-muted-foreground",
  dismissed: "bg-surface-2 text-muted-foreground",
};

export function StatusPill({ status, className }: { status: Status; className?: string }) {
  return <span className={cn("shrink-0 px-2 h-6 inline-flex items-center rounded-full text-[0.625rem] font-semibold uppercase tracking-[0.06em] whitespace-nowrap", STATUS_TONE[status], className)}>{STATUS_LABEL[status]}</span>;
}

const BAND_TONE = {
  Strong: "bg-[var(--domain-opportunity-container)] text-[var(--domain-opportunity)]",
  Good: "bg-primary-container text-primary-container-foreground",
  Moderate: "bg-[var(--domain-revenue-container)] text-[var(--domain-revenue)]",
  Weak: "bg-surface-2 text-muted-foreground",
  Poor: "bg-surface-2 text-muted-foreground",
} as const;

/** Fit score pill: number in display face + band; gate failures read as a muted reason. */
export function ScorePill({ fit, error, included, size = "md", className }: { fit?: Fit; error?: string; included?: boolean; size?: "sm" | "md" | "lg"; className?: string }) {
  const h = size === "lg" ? "h-9 px-3 text-[0.9375rem]" : size === "sm" ? "h-6 px-2 text-[0.75rem]" : "h-7 px-2.5 text-[0.8125rem]";
  if (!fit && error) return <span title={error} className={cn("inline-flex items-center gap-1 rounded-full bg-destructive/10 text-destructive font-medium", h, className)}><Icon name="error" size={14} />Failed</span>;
  if (!fit) return <span className={cn("inline-flex items-center gap-1 rounded-full bg-surface-2 text-muted-foreground font-medium", h, className)}><Icon name="progress_activity" size={14} className="animate-spin" />Evaluating</span>;
  const why = included ? undefined : excludedReason(fit);
  if (why) return <span title={why} className={cn("inline-flex max-w-full items-center gap-1 rounded-full bg-surface-2 text-muted-foreground font-medium whitespace-nowrap", h, className)}><Icon name="block" size={14} className="shrink-0" /><span className="truncate">{why.split(":")[0]}</span></span>;
  const b = band(fit.score);
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full font-medium tabular-nums", BAND_TONE[b], h, className)}>
      <span className="font-display font-semibold">{fit.score}</span>
      <span className="opacity-80">{b}</span>
    </span>
  );
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="text-[0.625rem] font-mono px-1.5 py-0.5 rounded bg-card border border-outline-variant text-muted-foreground">{children}</kbd>;
}
