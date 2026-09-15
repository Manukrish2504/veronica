"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Icon } from "@/components/mt/icon";
import { Button, IconButton } from "@/components/mt/button";
import { ScorePill } from "@/components/mt/pills";
import { dismiss, include, shortlist } from "@/lib/actions";
import { deadlineLabel } from "@/lib/format";
import { daysUntil, excludedReason, type AppView } from "@/lib/types";
import { cn } from "@/lib/utils";

const SOURCE_ICON: Record<string, string> = { linkedin: "group", seek: "search", websearch: "language", careers: "corporate_fare", greenhouse: "corporate_fare", lever: "corporate_fare", ashby: "corporate_fare", workday: "corporate_fare", manual: "content_paste" };

/** One inbox row; in `excluded` mode it shows the reason and an Include button instead of Shortlist / Dismiss. */
export function JobRow({ app, excluded = false }: { app: AppView; excluded?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const days = daysUntil(app.job.deadline);
  const why = excluded && app.fit ? excludedReason(app.fit) : undefined;
  const g = app.fit?.gates;
  const flags = [g?.eligibility.result === "flag" && { label: "Rights?", note: g.eligibility.note }, g?.timing?.result === "flag" && { label: "Timing?", note: g.timing.note }, g?.language.result === "flag" && { label: "Language?", note: g.language.note }, app.fit?.locationNote.startsWith("Flag:") && { label: "Travel?", note: app.fit.locationNote }].filter((f): f is { label: string; note: string } => Boolean(f));
  const act = (e: React.MouseEvent, fn: () => Promise<void>, msg: string) => { e.stopPropagation(); start(async () => { await fn(); toast(msg); }); };
  return (
    <div
      role="link"
      tabIndex={0}
      onClick={() => router.push(`/jobs/${app.id}`)}
      onKeyDown={(e) => { if (e.key === "Enter") router.push(`/jobs/${app.id}`); }}
      className={cn("group flex items-center gap-4 px-4 py-3 transition hover:bg-surface-1 cursor-pointer", pending && "opacity-50")}
    >
      <div className="w-[128px] shrink-0 flex flex-col items-start gap-1">
        <ScorePill fit={app.fit} error={app.error} included={app.included} />
        {flags.length > 0 && <span title={flags.map((f) => f.note).join("\n")} className="inline-flex items-center gap-1 rounded-full bg-[var(--domain-revenue-container)] px-2 h-5 text-[0.625rem] font-semibold uppercase tracking-[0.06em] text-[var(--domain-revenue)]"><Icon name="warning" size={12} filled />{flags.map((f) => f.label).join(" · ")}</span>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[0.9375rem] font-medium truncate group-hover:underline">{app.job.title}</div>
        <div className="mt-0.5 flex items-center gap-3 text-[0.75rem] text-muted-foreground min-w-0">
          <span className="shrink-0">{app.job.company}</span>
          <span className="inline-flex items-center gap-1 truncate"><Icon name="location_on" size={13} className="shrink-0" />{app.job.location}{app.job.remote && !/remote/i.test(app.job.location) ? " · remote ok" : ""}</span>
        </div>
        {why && <div className="mt-1 truncate text-[0.75rem] text-muted-foreground" title={why}>{why}</div>}
      </div>
      <span className="hidden md:inline-flex w-[170px] shrink-0 items-center gap-1.5 h-7 px-2.5 rounded-lg bg-surface-1 text-[0.75rem] text-muted-foreground whitespace-nowrap overflow-hidden"><Icon name={SOURCE_ICON[app.job.source] ?? "public"} size={14} />{app.job.sourceLabel}</span>
      <span className={cn("w-20 shrink-0 text-right font-mono text-[0.75rem] tabular-nums", days !== undefined && days < 7 ? "text-destructive" : "text-muted-foreground")}>{days === undefined ? "—" : deadlineLabel(days)}</span>
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
        {excluded ? (
          <Button size="sm" variant="tonal" icon="undo" disabled={pending} onClick={(e) => act(e, () => include(app.id), `${app.job.company} is back in your inbox`)}>Include</Button>
        ) : (
          <>
            <Button size="sm" icon="check" disabled={pending} onClick={(e) => act(e, () => shortlist(app.id), `Shortlisted ${app.job.company}`)}>Shortlist</Button>
            <IconButton icon="close" label="Dismiss" size={32} disabled={pending} onClick={(e) => act(e, () => dismiss(app.id), `Dismissed ${app.job.company}`)} />
          </>
        )}
      </div>
    </div>
  );
}
