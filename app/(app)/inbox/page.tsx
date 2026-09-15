import { AddJobDialog } from "@/components/add-job-dialog";
import { JobRow } from "@/components/jobs/job-row";
import { Button } from "@/components/mt/button";
import { EmptyState, Insight, StatTile } from "@/components/mt/panel";
import { read } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { runSearchNow } from "@/lib/actions";
import { daysUntil, isExcluded, join } from "@/lib/types";

export default async function InboxPage() {
  const user = await requireUser();
  const db = read(user.id);
  const rows = join(db).filter((a) => a.status === "found").sort((a, b) => (b.fit?.score ?? -1) - (a.fit?.score ?? -1));
  const strong = rows.filter((a) => (a.fit?.score ?? 0) >= 75);
  const closing = rows.filter((a) => { const d = daysUntil(a.job.deadline); return d !== undefined && d <= 7; });
  const excluded = join(db).filter((a) => a.status === "dismissed" && isExcluded(a)).sort((a, b) => b.job.foundAt.localeCompare(a.job.foundAt));
  const today = new Date().toISOString().slice(0, 10);
  const fresh = rows.filter((a) => a.job.foundAt.slice(0, 10) === today).length;

  return (
    <div className="max-w-5xl mx-auto px-6 md:px-10 py-8 space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 style={{ fontSize: "var(--text-headline-md)" }}>Inbox</h1>
          <p className="text-sm text-muted-foreground max-w-prose">What the agent found, scored against your profile. Shortlist what you want tailored; dismiss the rest.</p>
        </div>
        <div className="flex items-center gap-2">
          <form action={runSearchNow}><Button type="submit" variant="outlined" size="sm" icon="travel_explore">Run search</Button></form>
          <AddJobDialog><Button size="sm" icon="add" className="shadow-sm">Add job</Button></AddJobDialog>
        </div>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="To triage" value={rows.length} note={fresh ? `${fresh} new today` : "since last run"} />
        <StatTile label="Strong fits" value={strong.length} note="score 75 and up" tone="opportunity" />
        <StatTile label="Closing this week" value={closing.length} note="deadline within 7 days" tone={closing.length ? "revenue" : undefined} />
        <StatTile label="Excluded" value={excluded.length} note="not eligible, wrong timing or place · Pipeline › Closed" />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon="inbox" title="Nothing to triage" action={<form action={runSearchNow}><Button variant="outlined" size="sm" icon="travel_explore">Run search now</Button></form>}>
          The agent searches your sources on its schedule. Paste a posting on the home screen to evaluate one right now.
        </EmptyState>
      ) : (
        <>
          {strong.length > 0 && (
            <Insight eyebrow="Worth your attention" icon="auto_awesome">
              {strong.length === 1
                ? <>{strong[0].job.company} is a strong fit for <strong>{strong[0].job.title}</strong>{daysUntil(strong[0].job.deadline) !== undefined ? ` and closes in ${daysUntil(strong[0].job.deadline)} days` : ""}. Shortlist it and the agent starts tailoring.</>
                : <>{strong.length} strong fits are waiting{closing.length ? `, ${closing.length} closing within a week` : ""}. Start with the top of the list.</>}
            </Insight>
          )}
          <div className="rounded-2xl border border-outline-variant bg-card divide-y divide-outline-variant/60 overflow-hidden">
            {rows.map((a) => <JobRow key={a.id} app={a} />)}
          </div>
        </>
      )}

      {excluded.length > 0 && (
        <details className="group rounded-2xl border border-outline-variant bg-card overflow-hidden">
          <summary className="state-layer flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-[0.8125rem] font-medium">
            <span className="msr text-[18px] text-muted-foreground transition group-open:rotate-90">chevron_right</span>
            Excluded · {excluded.length}
            <span className="font-normal text-muted-foreground">not eligible, wrong timing or place. Hover a row and press Include to pull one back.</span>
          </summary>
          <div className="divide-y divide-outline-variant/60 border-t border-outline-variant">
            {excluded.slice(0, 60).map((a) => <JobRow key={a.id} app={a} excluded />)}
          </div>
        </details>
      )}
    </div>
  );
}
