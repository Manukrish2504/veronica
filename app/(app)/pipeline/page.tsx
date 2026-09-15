import Link from "next/link";
import { ApplicationCard } from "@/components/jobs/application-card";
import { EmptyState, Eyebrow, StatTile } from "@/components/mt/panel";
import { Icon } from "@/components/mt/icon";
import { read } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ACTIVE, CLOSED, STATUS_LABEL, join, needsYou, type Status } from "@/lib/types";
import { cn } from "@/lib/utils";

export default async function PipelinePage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const closedView = view === "closed";
  const user = await requireUser();
  const apps = join(read(user.id));
  const active = apps.filter((a) => ACTIVE.includes(a.status));
  const closed = apps.filter((a) => CLOSED.includes(a.status));
  const shown = closedView ? closed : active;
  const order: Status[] = closedView ? CLOSED : ACTIVE;
  const groups = order.map((s) => ({ status: s, rows: shown.filter((r) => r.status === s) })).filter((g) => g.rows.length);
  const needs = active.filter((a) => needsYou(a).length).length;

  return (
    <div className="max-w-5xl mx-auto px-6 md:px-10 py-8 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 style={{ fontSize: "var(--text-headline-md)" }}>Pipeline</h1>
          <p className="text-sm text-muted-foreground max-w-prose">Every application from shortlist to offer. The agent moves things forward until it needs your approval.</p>
        </div>
        <div className="inline-flex items-center rounded-full bg-surface-2 p-0.5">
          {[{ v: false, label: "Active", n: active.length }, { v: true, label: "Closed", n: closed.length }].map((t) => (
            <Link key={t.label} href={t.v ? "/pipeline?view=closed" : "/pipeline"} className={cn("state-layer inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[0.8125rem] font-medium transition no-underline", closedView === t.v ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              {t.label}<span className="font-mono text-[0.6875rem] text-muted-foreground tabular-nums">{t.n}</span>
            </Link>
          ))}
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="In progress" value={active.length} note="shortlisted to offer" />
        <StatTile label="Needs you" value={needs} note="approvals and follow-ups" tone={needs ? "primary" : undefined} />
        <StatTile label="Applied" value={apps.filter((a) => a.appliedAt).length} note="submitted with your approval" />
        <StatTile label="Interviews" value={apps.filter((a) => a.status === "interview" || a.status === "offer").length} note="prep packs ready" tone="opportunity" />
      </div>

      {shown.length === 0 ? (
        <EmptyState icon="view_kanban" title={closedView ? "Nothing closed yet" : "Nothing in progress"}>
          {closedView ? "Rejected, withdrawn and dismissed applications land here." : "Shortlist a posting from the inbox and the agent starts tailoring."}
        </EmptyState>
      ) : (
        groups.map((g) => (
          <section key={g.status} className="space-y-3">
            <div className="flex items-center gap-2">
              <Eyebrow>{STATUS_LABEL[g.status]} · {g.rows.length}</Eyebrow>
              {g.status === "review" && <Icon name="notifications_active" size={13} filled className="text-primary" />}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {g.rows.map((a) => <ApplicationCard key={a.id} app={a} />)}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
