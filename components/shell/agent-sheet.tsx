"use client";

import Link from "next/link";
import { useTransition } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/mt/button";
import { Icon } from "@/components/mt/icon";
import { Eyebrow } from "@/components/mt/panel";
import { runSearchNow, togglePause } from "@/lib/actions";
import { relative } from "@/lib/format";
import type { AgentState } from "@/lib/types";
import type { Need } from "./app-shell";
import { cn } from "@/lib/utils";

export function AgentSheet({ open, onOpenChange, agent, needs }: { open: boolean; onOpenChange: (o: boolean) => void; agent: AgentState; needs: Need[] }) {
  const [pending, start] = useTransition();
  const log = [...agent.log].reverse().slice(0, 50);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-[400px] flex-col gap-0 p-0 sm:max-w-[400px] border-outline-variant">
        <SheetHeader className="border-b border-outline-variant px-5 py-4">
          <SheetTitle className="flex items-center gap-2 font-display text-[1rem] font-medium">
            <span className={cn("relative inline-flex size-2", !agent.paused && "after:absolute after:inset-0 after:rounded-full after:bg-[var(--domain-opportunity)] after:opacity-60 after:animate-ping")}>
              <span className={cn("relative inline-flex size-2 rounded-full", agent.paused ? "bg-muted-foreground" : "bg-[var(--domain-opportunity)]")} />
            </span>
            Agent
          </SheetTitle>
          <SheetDescription className="sr-only">What the agent is doing and what it needs from you</SheetDescription>
        </SheetHeader>
        <div className="space-y-6 px-5 py-4">
          <section className="space-y-3">
            <Eyebrow>Now</Eyebrow>
            {agent.search && (
              <div className="rounded-2xl border border-outline-variant bg-surface-1 p-3 text-sm">
                <p className="font-medium">Searching your sources</p>
                <p className="mt-0.5 font-mono text-[0.75rem] text-muted-foreground">started {relative(agent.search.startedAt)}{agent.search.progress && ` · scored ${agent.search.progress.done}/${agent.search.progress.total}`}</p>
                {agent.search.progress && (
                  <div className="mt-2 h-1.5 rounded-full bg-surface-3 overflow-hidden"><span className="block h-full bg-primary" style={{ width: `${Math.round((agent.search.progress.done / Math.max(1, agent.search.progress.total)) * 100)}%` }} /></div>
                )}
              </div>
            )}
            {agent.paused && !agent.now ? (
              <p className="text-sm text-muted-foreground">Paused. No scheduled searches until you resume.</p>
            ) : agent.now ? (
              <div className="rounded-2xl border border-outline-variant bg-surface-1 p-3 text-sm">
                <p className="font-medium">{agent.now.task} · {agent.now.target}</p>
                <p className="mt-0.5 font-mono text-[0.75rem] text-muted-foreground">started {relative(agent.now.startedAt)}{agent.now.progress && ` · ${agent.now.progress.done}/${agent.now.progress.total}`}</p>
                {agent.now.progress && (
                  <div className="mt-2 h-1.5 rounded-full bg-surface-3 overflow-hidden"><span className="block h-full bg-primary" style={{ width: `${Math.round((agent.now.progress.done / agent.now.progress.total) * 100)}%` }} /></div>
                )}
              </div>
            ) : agent.search ? null : (
              <p className="text-sm text-muted-foreground">Idle · next run {new Date(agent.nextRunAt).toLocaleString("en-AU", { weekday: "short", hour: "2-digit", minute: "2-digit" })}</p>
            )}
            <div className="flex gap-2">
              <Button size="sm" icon="play_arrow" disabled={pending} onClick={() => start(() => runSearchNow())}>Run search now</Button>
              <Button size="sm" variant="outlined" icon={agent.paused ? "play_arrow" : "pause"} disabled={pending} onClick={() => start(() => togglePause())}>{agent.paused ? "Resume" : "Pause"}</Button>
            </div>
          </section>
          <section className="space-y-2">
            <Eyebrow>Needs you</Eyebrow>
            {needs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing waiting on you.</p>
            ) : (
              <ul className="space-y-0.5">
                {needs.map((n, i) => (
                  <li key={i}>
                    <Link href={`/jobs/${n.id}`} onClick={() => onOpenChange(false)} className="state-layer flex items-center gap-2 rounded-xl px-2 py-2 text-sm no-underline">
                      <Icon name="chevron_right" size={16} className="text-muted-foreground" />
                      <span className="flex-1">{n.company}</span>
                      <span className="text-[0.75rem] text-muted-foreground">{n.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <section className="flex min-h-0 flex-1 flex-col border-t border-outline-variant">
          <div className="px-5 pt-4 pb-2"><Eyebrow>Recent</Eyebrow></div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
            <ul className="space-y-1.5 font-mono text-[0.75rem]">
              {log.map((l, i) => (
                <li key={i} className="flex gap-3">
                  <span className="shrink-0 text-muted-foreground">{new Date(l.at).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}</span>
                  <span>{l.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </SheetContent>
    </Sheet>
  );
}
