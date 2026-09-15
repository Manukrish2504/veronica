"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Icon } from "@/components/mt/icon";
import { PillChip } from "@/components/mt/chip";
import { addJob, runSearchNow } from "@/lib/actions";
import { cn } from "@/lib/utils";

const EXAMPLES = [
  "Paste a job URL to evaluate it against your profile",
  "Paste the full posting text if the page is behind a login",
  "https://boards.greenhouse.io/…/jobs/…",
];

/** MT_v2 Composer, repurposed: a posting in, an evaluated application out. */
export function Composer({ pending: needs }: { pending: { drafts: number; yourTurn: number; followUps: number; interviews: number } }) {
  const [text, setText] = useState("");
  const [isPending, start] = useTransition();
  const ref = useRef<HTMLTextAreaElement>(null);
  const example = EXAMPLES[new Date().getDate() % EXAMPLES.length];

  const submit = () => {
    const value = text.trim();
    if (!value || isPending) return;
    const fd = new FormData();
    fd.set("text", value);
    start(async () => {
      await addJob(fd);
      setText("");
      toast("Added to your inbox. Veronica evaluates it next run.");
    });
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-center gap-1.5 overflow-x-auto pb-0.5 mb-2.5">
        <PillChip icon="content_paste" onClick={() => ref.current?.focus()}>Paste a posting</PillChip>
        <PillChip icon="travel_explore" onClick={() => start(async () => { await runSearchNow(); toast("Search started"); })}>Run search</PillChip>
        <Link href="/pipeline" className="no-underline"><PillChip icon="rate_review">Review drafts{needs.drafts ? ` · ${needs.drafts}` : ""}</PillChip></Link>
        {needs.yourTurn > 0 && <Link href="/pipeline" className="no-underline"><PillChip icon="send" className="border-primary/30 text-primary">Your turn · {needs.yourTurn}</PillChip></Link>}
        <Link href="/pipeline?view=active" className="no-underline"><PillChip icon="schedule">Follow-ups{needs.followUps ? ` · ${needs.followUps}` : ""}</PillChip></Link>
        <Link href="/pipeline" className="no-underline"><PillChip icon="school">Interview prep{needs.interviews ? ` · ${needs.interviews}` : ""}</PillChip></Link>
      </div>

      <div className="relative rounded-3xl transition-all">
        <div className="composer-border relative rounded-3xl bg-card transition-all shadow-sm">
          <div className="relative">
            <textarea
              ref={ref}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
              rows={2}
              aria-label="Job URL or posting"
              className="w-full resize-none bg-transparent px-6 pt-5 pb-3 text-[1.0625rem] leading-relaxed outline-none placeholder:text-transparent min-h-[92px] max-h-[320px]"
              placeholder={example}
              spellCheck={false}
            />
            {!text && <span className="pointer-events-none absolute left-6 right-6 top-5 truncate text-[1.0625rem] leading-relaxed text-muted-foreground">{example}</span>}
          </div>
          <div className="flex items-center justify-between px-3 pb-3">
            <div className="flex items-center gap-1.5 pl-1">
              <span className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full text-[0.75rem] font-medium text-muted-foreground">
                <Icon name="fact_check" size={16} />Scored against your profile
              </span>
              <span className="hidden sm:inline font-mono text-[0.6875rem] text-muted-foreground/70">⏎ add · ⇧⏎ newline</span>
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={!text.trim() || isPending}
              aria-label="Add job"
              className={cn("state-layer inline-flex size-9 items-center justify-center rounded-full transition", text.trim() ? "bg-primary text-primary-foreground" : "bg-surface-3 text-muted-foreground")}
            >
              <Icon name={isPending ? "progress_activity" : "arrow_upward"} size={18} className={isPending ? "animate-spin" : undefined} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
