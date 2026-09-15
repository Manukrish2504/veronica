import Link from "next/link";
import { Icon } from "@/components/mt/icon";
import { StatusPill } from "@/components/mt/pills";
import { deadlineLabel, relative } from "@/lib/format";
import { ACTIVE, band, daysUntil, excludedReason, needsYou, type AppView } from "@/lib/types";
import { cn } from "@/lib/utils";

/** MT_v2 Projects card, one per application. */
export function ApplicationCard({ app }: { app: AppView }) {
  const days = daysUntil(app.job.deadline);
  const needs = needsYou(app);
  const stage = ACTIVE.indexOf(app.status) + 1;
  const pct = stage > 0 ? Math.round((stage / ACTIVE.length) * 100) : 0;
  const approved = app.drafts.filter((d) => d.status === "approved").length;
  const last = app.timeline.at(-1);
  const why = app.fit && !app.included ? excludedReason(app.fit) : undefined;
  return (
    <Link href={`/jobs/${app.id}`} className="group rounded-2xl border border-outline-variant bg-card p-4 flex flex-col gap-3 hover:border-primary/40 transition no-underline">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[0.9375rem] font-medium truncate group-hover:underline">{app.job.title}</div>
          <div className="text-[0.75rem] text-muted-foreground truncate mt-0.5">{app.job.company} · {app.job.location}</div>
        </div>
        <StatusPill status={app.status} />
      </div>
      <div className="text-[0.6875rem] text-muted-foreground space-y-1">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5"><Icon name="date_range" size={13} /> {days === undefined ? "no deadline" : `closes ${deadlineLabel(days)}`}</span>
          {app.fit && !why && <span className="inline-flex items-center gap-1.5"><Icon name="fact_check" size={13} /> {app.fit.score} · {band(app.fit.score)}</span>}
        </div>
        {why && <div className="flex items-start gap-1.5 text-muted-foreground" title={why}><Icon name="block" size={13} className="mt-px shrink-0" /><span className="line-clamp-2">{why}</span></div>}
        {needs.length > 0 && (
          <div className="flex items-center gap-1.5 text-primary font-medium"><Icon name="notifications_active" size={13} filled /> {needs.join(" · ")}</div>
        )}
      </div>
      <div className="mt-auto space-y-1.5">
        <div className="h-2 rounded-full bg-surface-2 overflow-hidden">
          <span className={cn("block h-full", stage > 0 ? "bg-primary" : "bg-surface-4")} style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center justify-between text-[0.6875rem] text-muted-foreground tabular-nums">
          <span>{app.drafts.length ? `${approved}/${app.drafts.length} approved` : stage > 0 ? `stage ${stage} of ${ACTIVE.length}` : "closed"}</span>
          <span>{last ? `${relative(last.at)} · ${last.actor}` : ""}</span>
        </div>
      </div>
    </Link>
  );
}
