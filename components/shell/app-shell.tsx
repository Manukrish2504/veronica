"use client";

import { useSyncExternalStore } from "react";
import { TopNav } from "./top-nav";
import { Sidebar } from "./sidebar";
import { CommandMenu } from "@/components/command-menu";
import { LiveRefresh } from "./live-refresh";
import type { AgentState } from "@/lib/types";

export type Need = { id: string; company: string; label: string; kind: "drafts" | "your_turn" | "followup" | "apply" };
export type Recent = { id: string; title: string; company: string };
export type ShellData = {
  profile: { name: string; email: string; initials: string };
  counts: { inbox: number; needsYou: number };
  needs: Need[];
  recent: Recent[];
  agent: AgentState;
  /** True while the agent has work in flight or queued; drives the refresh cadence. */
  busy: boolean;
  jobs: { id: string; title: string; company: string }[];
};

// Sidebar pin (MT_v2 Root.tsx): a stored choice wins, otherwise auto-collapse under 1000px.
const PIN_KEY = "veronica.sidebarPinned.v1";
const PIN_EVENT = "veronica:pin";
const mq = () => window.matchMedia("(max-width: 1000px)");
function subscribe(cb: () => void) {
  const m = mq();
  m.addEventListener("change", cb);
  window.addEventListener(PIN_EVENT, cb);
  return () => { m.removeEventListener("change", cb); window.removeEventListener(PIN_EVENT, cb); };
}
function getCollapsed() {
  try {
    const v = localStorage.getItem(PIN_KEY);
    if (v === "1") return false;
    if (v === "0") return true;
  } catch {}
  return mq().matches;
}

/** MT_v2 Root.tsx shell: top bar, collapsible rail, scrolling main. */
export function AppShell({ data, children }: { data: ShellData; children: React.ReactNode }) {
  const collapsed = useSyncExternalStore(subscribe, getCollapsed, () => false);
  const onToggle = () => {
    try { localStorage.setItem(PIN_KEY, collapsed ? "1" : "0"); } catch {}
    window.dispatchEvent(new Event(PIN_EVENT));
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground">
      <TopNav collapsed={collapsed} onToggleSidebar={onToggle} profile={data.profile} agent={data.agent} needs={data.needs} />
      <div className="flex-1 min-h-0 flex">
        <Sidebar collapsed={collapsed} counts={data.counts} needs={data.needs} recent={data.recent} />
        <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>
      </div>
      <CommandMenu jobs={data.jobs} paused={data.agent.paused} />
      <LiveRefresh busy={data.busy} />
    </div>
  );
}
