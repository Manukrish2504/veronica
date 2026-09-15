"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/mt/button";
import { Icon } from "@/components/mt/icon";
import { Panel } from "@/components/mt/panel";
import { approveDraft, rejectDraft, requestChanges, saveDraft } from "@/lib/actions";
import { relative } from "@/lib/format";
import type { Draft } from "@/lib/types";
import { cn } from "@/lib/utils";

const KIND = { cv: "CV", cover: "Cover letter" } as const;

export function DraftPanel({ draft }: { draft?: Draft }) {
  const [content, setContent] = useState(draft?.content ?? "");
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");
  const [pending, start] = useTransition();

  if (!draft) {
    return (
      <div className="rounded-2xl border border-dashed border-outline-variant bg-card py-14 px-6 text-center space-y-2">
        <Icon name="edit_document" size={28} className="text-muted-foreground" />
        <p className="text-[0.9375rem] font-medium">No draft yet</p>
        <p className="text-sm text-muted-foreground">Shortlist the job and the agent starts tailoring from your master CV.</p>
      </div>
    );
  }
  if (draft.status === "drafting") {
    return (
      <div className="rounded-2xl border border-dashed border-outline-variant bg-card py-14 px-6 text-center space-y-2">
        <Icon name="progress_activity" size={28} className="text-primary animate-spin" />
        <p className="text-[0.9375rem] font-medium">The agent is drafting the {KIND[draft.kind].toLowerCase()}</p>
        {draft.userNote && <p className="text-sm text-muted-foreground">Your note: “{draft.userNote}”</p>}
      </div>
    );
  }

  const dirty = content !== draft.content;
  const locked = draft.status === "approved" || draft.status === "rejected";
  const act = (fn: () => Promise<void>, msg: string) => start(async () => { await fn(); toast(msg); });
  const statusLabel = draft.status === "approved" ? `Approved · v${draft.version}` : draft.status === "rejected" ? "Rejected" : draft.status === "edited" ? "Edited by you" : "Ready for review";

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
      <Panel
        title={KIND[draft.kind]}
        action={
          <span className="flex items-center gap-2">
            <span className={cn("px-2 h-6 inline-flex items-center rounded-full text-[0.625rem] font-semibold uppercase tracking-[0.06em]", draft.status === "approved" ? "bg-[var(--domain-opportunity)] text-white" : draft.status === "rejected" ? "bg-surface-2 text-muted-foreground" : "bg-primary-container text-primary-container-foreground")}>{statusLabel}</span>
            <span className="font-mono text-[0.6875rem] text-muted-foreground">{relative(draft.updatedAt)}</span>
            <a href={`/api/docs/${draft.applicationId}/${draft.kind}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[0.75rem] text-primary no-underline hover:underline"><Icon name="picture_as_pdf" size={15} />PDF</a>
          </span>
        }
      >
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          readOnly={locked}
          spellCheck={false}
          className="w-full min-h-[540px] resize-y rounded-xl border border-outline-variant bg-surface-1 px-4 py-3 font-mono text-[0.8125rem] leading-6 outline-none focus:border-primary/40 read-only:text-muted-foreground"
        />
        {!locked && (
          <div className="sticky bottom-4 flex flex-wrap items-center gap-2 rounded-full border border-outline-variant bg-card/95 p-1.5 pl-4 shadow-lg backdrop-blur">
            <span className="text-[0.8125rem] text-muted-foreground">{dirty ? "You edited this draft." : `Approve this ${KIND[draft.kind].toLowerCase()}?`}</span>
            <div className="ml-auto flex items-center gap-1.5">
              {dirty && <Button size="sm" variant="tonal" icon="save" disabled={pending} onClick={() => act(() => saveDraft(draft.id, content), "Edits saved")}>Save edits</Button>}
              <Button size="sm" variant="text" icon="close" disabled={pending} onClick={() => act(() => rejectDraft(draft.id), "Draft rejected")}>Reject</Button>
              <Button size="sm" variant="outlined" icon="rate_review" disabled={pending} onClick={() => setAsking((a) => !a)}>Request changes</Button>
              <Button size="sm" icon="check" disabled={pending || dirty} title={dirty ? "Save your edits first" : undefined} onClick={() => act(() => approveDraft(draft.id), `${KIND[draft.kind]} approved`)}>Approve</Button>
            </div>
            {asking && (
              <form className="flex w-full gap-2 px-2 pb-1 pt-1" onSubmit={(e) => { e.preventDefault(); if (!note.trim()) return; act(() => requestChanges(draft.id, note.trim()), "Sent back to the agent"); setAsking(false); }}>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} autoFocus placeholder="What should change?" className="flex-1 rounded-xl border border-outline-variant bg-card px-3 py-2 text-sm outline-none focus:border-primary/40" />
                <Button size="sm" type="submit" icon="send" disabled={pending || !note.trim()}>Send</Button>
              </form>
            )}
          </div>
        )}
      </Panel>
      <Panel title="What changed vs master" className="h-fit">
        {draft.changes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No changes recorded.</p>
        ) : (
          <ul className="space-y-4">
            {draft.changes.map((c, i) => (
              <li key={i} className="text-[0.8125rem] space-y-1">
                <div className="text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{c.section}</div>
                <div className="text-muted-foreground line-through decoration-muted-foreground/50">{c.before}</div>
                <div>{c.after}</div>
                <div className="flex gap-1.5 text-[0.75rem] text-primary"><Icon name="subdirectory_arrow_right" size={14} className="shrink-0 mt-px" />{c.reason}</div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
