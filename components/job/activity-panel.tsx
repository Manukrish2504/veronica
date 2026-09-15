import { Button } from "@/components/mt/button";
import { Icon } from "@/components/mt/icon";
import { Panel } from "@/components/mt/panel";
import { SubmissionCard } from "@/components/job/apply-dialog";
import { addNote, setFollowUp } from "@/lib/actions";
import { fmtDate } from "@/lib/format";
import type { AppView } from "@/lib/types";

export function ActivityPanel({ app }: { app: AppView }) {
  const events = [...app.timeline].reverse();
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4">
      <div className="space-y-4">
        {app.status !== "applying" && <SubmissionCard app={app} />}
        <Panel title="Timeline">
          <ol className="space-y-3">
            {events.map((e, i) => (
              <li key={i} className="flex gap-3 text-[0.8125rem]">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-muted-foreground"><Icon name={e.actor === "agent" ? "smart_toy" : "person"} size={14} filled={e.actor === "agent"} /></span>
                <div>
                  <p>{e.event}</p>
                  <p className="font-mono text-[0.6875rem] text-muted-foreground">{fmtDate(e.at)} · {new Date(e.at).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })} · {e.actor}</p>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
      <div className="space-y-4">
        <Panel title="Follow-up">
          <form action={setFollowUp.bind(null, app.id)} className="flex gap-2">
            <input type="date" name="date" defaultValue={app.followUpAt ?? ""} aria-label="Follow-up date" className="h-9 flex-1 rounded-full border border-outline-variant bg-card px-4 font-mono text-[0.8125rem] outline-none focus:border-primary/40" />
            <Button size="sm" variant="tonal" type="submit" icon="event_available">Set</Button>
          </form>
        </Panel>
        <Panel title="Notes">
          {app.notes && <p className="whitespace-pre-wrap rounded-xl bg-surface-1 p-3 text-[0.8125rem] leading-relaxed">{app.notes}</p>}
          <form action={addNote.bind(null, app.id)} className="space-y-2">
            <textarea name="note" rows={3} placeholder="Add a note" className="w-full rounded-xl border border-outline-variant bg-card px-3 py-2 text-sm outline-none focus:border-primary/40" />
            <Button size="sm" variant="outlined" type="submit" icon="add">Add note</Button>
          </form>
        </Panel>
      </div>
    </div>
  );
}
