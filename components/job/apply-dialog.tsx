"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/mt/button";
import { Icon } from "@/components/mt/icon";
import { include, markSubmitted, openForm, reportProblem, retry, shortlist, startApply } from "@/lib/actions";
import { excludedReason, type AppView } from "@/lib/types";

/** The one primary button in the job header; its label follows the application state. */
export function PrimaryAction({ app }: { app: AppView }) {
  const [pending, start] = useTransition();
  const approved = app.drafts.filter((d) => d.status === "approved").length;
  const allApproved = app.drafts.length > 0 && approved === app.drafts.length;

  switch (app.status) {
    case "found":
      return <Button size="sm" icon="check" className="shadow-sm" disabled={pending} onClick={() => start(async () => { await shortlist(app.id); toast("Shortlisted"); })}>Shortlist</Button>;
    case "shortlisted":
      return <Button size="sm" variant="tonal" icon="progress_activity" disabled>Waiting for drafts</Button>;
    case "drafting":
      return <Button size="sm" variant="tonal" icon="progress_activity" disabled>Drafting…</Button>;
    case "review":
      return allApproved ? <ApplyDialog app={app} /> : <Button size="sm" icon="rate_review" className="shadow-sm" asChild><Link href={`/jobs/${app.id}?tab=cv`} className="no-underline"><Icon name="rate_review" size={16} />Review drafts</Link></Button>;
    case "applying":
      if (app.submission?.step === "your_turn") return <Button size="sm" icon="open_in_new" className="shadow-sm" disabled={pending} onClick={() => start(() => openForm(app.id))}>Your turn: show form</Button>;
      if (app.submission?.step === "failed") return <Button size="sm" icon="refresh" disabled={pending} onClick={() => start(() => retry(app.id))}>Retry</Button>;
      return <Button size="sm" variant="tonal" icon="progress_activity" disabled>Agent is filling the form</Button>;
    case "applied":
      return <Button size="sm" variant="outlined" asChild><Link href={`/jobs/${app.id}?tab=activity`} className="no-underline"><Icon name="schedule" size={16} />Log follow-up</Link></Button>;
    case "interview":
    case "offer":
      return <Button size="sm" className="shadow-sm" asChild><Link href={`/jobs/${app.id}?tab=prep`} className="no-underline"><Icon name="school" size={16} />Open prep</Link></Button>;
    case "dismissed":
      return <Button size="sm" variant="tonal" icon="undo" disabled={pending} onClick={() => start(async () => { await include(app.id); toast("Back in your inbox"); })}>{app.fit && !app.included && excludedReason(app.fit) ? "Include anyway" : "Back to inbox"}</Button>;
    default:
      return null;
  }
}

/** Why the agent excluded this posting, with the override. */
export function ExcludedLine({ app }: { app: AppView }) {
  const [pending, start] = useTransition();
  const why = app.status === "dismissed" && app.fit && !app.included ? excludedReason(app.fit) : undefined;
  if (!why) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-outline-variant bg-surface-1 px-4 py-2.5 text-[0.8125rem]">
      <Icon name="block" size={18} className="text-muted-foreground" />
      <span className="min-w-0 flex-1"><span className="font-medium">Excluded. </span>{why}</span>
      <Button size="sm" variant="outlined" icon="undo" disabled={pending} onClick={() => start(async () => { await include(app.id); toast("Back in your inbox"); })}>Include anyway</Button>
    </div>
  );
}

function ApplyDialog({ app }: { app: AppView }) {
  const [checked, setChecked] = useState(false);
  const [pending, start] = useTransition();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild><Button size="sm" icon="send" className="shadow-sm">Apply</Button></AlertDialogTrigger>
      <AlertDialogContent className="rounded-2xl border-outline-variant">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display font-medium">Apply to {app.job.company}</AlertDialogTitle>
          <AlertDialogDescription>The agent opens the posting, fills the form with your approved documents and answers, then hands back to you for the final submit.</AlertDialogDescription>
        </AlertDialogHeader>
        <dl className="grid grid-cols-[6rem_1fr] gap-y-2 text-[0.8125rem]">
          <dt className="text-muted-foreground">Where</dt><dd className="truncate font-mono">{app.job.url || "—"}</dd>
          <dt className="text-muted-foreground">Attach</dt><dd>{app.drafts.map((d) => `${d.kind === "cv" ? "CV" : "Cover letter"} v${d.version}`).join(" · ")}</dd>
        </dl>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="size-4 accent-[var(--primary)]" />
          I reviewed both documents
        </label>
        <AlertDialogFooter>
          <Button variant="text" size="sm" asChild><AlertDialogTrigger>Cancel</AlertDialogTrigger></Button>
          <Button size="sm" icon="rocket_launch" disabled={!checked || pending} onClick={() => start(async () => { await startApply(app.id); toast("Agent is filling the form"); })}>Start</Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Shown while an assisted apply is in flight. */
export function SubmissionCard({ app }: { app: AppView }) {
  const [problem, setProblem] = useState(false);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();
  const s = app.submission;
  if (!s) return null;

  if (s.step === "your_turn") {
    return (
      <div className="crm-detail flex gap-3 rounded-2xl border border-primary/25 bg-accent/50 p-4">
        <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><Icon name="send" size={18} filled /></span>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <div className="text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Your turn</div>
            <p className="text-[0.9375rem] leading-relaxed">The form is filled in Veronica’s browser window at <span className="font-mono text-[0.8125rem]">{s.url}</span>. Check every field there, press Submit on the site, then confirm here.</p>
            {s.note && <p className="mt-1 text-[0.75rem] text-muted-foreground">{s.note}</p>}
          </div>
          {s.answers && s.answers.length > 0 && (
            <details className="rounded-xl bg-card/70 px-3 py-2 text-[0.8125rem]">
              <summary className="cursor-pointer font-medium">{s.answers.length} answer{s.answers.length === 1 ? "" : "s"} the agent typed</summary>
              <ul className="mt-2 space-y-2">
                {s.answers.map((a, i) => <li key={i}><div className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">{a.question}</div><p className="whitespace-pre-wrap leading-relaxed">{a.answer}</p></li>)}
              </ul>
            </details>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" icon="open_in_new" className="shadow-sm" disabled={pending} onClick={() => start(() => openForm(app.id))}>Show form</Button>
            <Button size="sm" variant="text" asChild><a href={s.url} target="_blank" rel="noreferrer" className="no-underline">Open in my browser</a></Button>
            <Button size="sm" variant="tonal" icon="check" disabled={pending} onClick={() => start(async () => { await markSubmitted(app.id); toast("Marked as applied. Follow-up set for next week."); })}>Mark as submitted</Button>
            <Button size="sm" variant="text" icon="flag" onClick={() => setProblem((p) => !p)}>Something’s wrong</Button>
          </div>
          {problem && (
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (!note.trim()) return; start(async () => { await reportProblem(app.id, note.trim()); toast("Sent back to the agent"); }); setProblem(false); }}>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} autoFocus placeholder="What’s wrong with the filled form?" className="flex-1 rounded-xl border border-outline-variant bg-card px-3 py-2 text-sm outline-none focus:border-primary/40" />
              <Button size="sm" type="submit" icon="send" disabled={pending || !note.trim()}>Send</Button>
            </form>
          )}
        </div>
      </div>
    );
  }
  if (s.step === "filling") {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-outline-variant bg-card p-4 text-[0.8125rem]">
        <Icon name="progress_activity" size={20} className="animate-spin text-primary" />
        <div>
          <p className="font-medium">The agent is filling the form at <span className="font-mono">{s.url}</span>.</p>
          <p className="text-muted-foreground">You’ll be asked to review and submit when it’s done.{s.note ? ` Retrying with your note: “${s.note}”` : ""}</p>
        </div>
      </div>
    );
  }
  if (s.step === "failed") {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-card p-4 text-[0.8125rem] space-y-3">
        <p className="font-medium text-destructive flex items-center gap-1.5"><Icon name="error" size={18} filled />Apply failed</p>
        <p className="text-muted-foreground">{s.error ?? "The agent could not complete the form."}</p>
        <div className="flex gap-2">
          <Button size="sm" icon="refresh" disabled={pending} onClick={() => start(() => retry(app.id))}>Retry</Button>
          <Button size="sm" variant="outlined" disabled={pending} onClick={() => start(async () => { await markSubmitted(app.id, "applied manually"); toast("Marked as applied"); })}>Mark applied manually</Button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-outline-variant bg-card p-4 text-[0.8125rem]">
      <Icon name="task_alt" size={20} filled className="text-[var(--domain-opportunity)]" />
      <div><p className="font-medium">Submitted</p><p className="text-muted-foreground">{s.confirmation ?? "No confirmation captured."}{s.note && ` · ${s.note}`}</p></div>
    </div>
  );
}

/** Last agent failure on this application, with a Retry. */
export function ErrorLine({ app }: { app: AppView }) {
  const [pending, start] = useTransition();
  if (!app.error) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-[0.8125rem]">
      <Icon name="error" size={18} filled className="text-destructive" />
      <span className="min-w-0 flex-1"><span className="font-medium text-destructive">Agent error: </span>{app.error}</span>
      <Button size="sm" variant="outlined" icon="refresh" disabled={pending} onClick={() => start(async () => { await retry(app.id); toast("Retrying"); })}>Retry</Button>
    </div>
  );
}
