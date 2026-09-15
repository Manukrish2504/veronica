"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/mt/icon";
import { IconButton } from "@/components/mt/button";
import { Kbd } from "@/components/mt/pills";
import { UserMenu } from "./user-menu";
import { AgentSheet } from "./agent-sheet";
import type { AgentState } from "@/lib/types";
import type { Need } from "./app-shell";

export function TopNav({ collapsed, onToggleSidebar, profile, agent, needs }: { collapsed: boolean; onToggleSidebar: () => void; profile: { name: string; email: string; initials: string }; agent: AgentState; needs: Need[] }) {
  const [agentOpen, setAgentOpen] = useState(false);
  useEffect(() => {
    const open = () => setAgentOpen(true);
    window.addEventListener("veronica:agent", open);
    return () => window.removeEventListener("veronica:agent", open);
  }, []);

  return (
    <header className="h-14 shrink-0 px-3 md:px-5 flex items-center gap-3 md:gap-5 border-b border-outline-variant bg-background z-30">
      <button
        onClick={onToggleSidebar}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-pressed={!collapsed}
        className="state-layer inline-flex items-center justify-center size-9 rounded-full text-muted-foreground hover:text-foreground shrink-0"
      >
        <Icon name={collapsed ? "menu" : "menu_open"} size={20} />
      </button>

      <Link href="/" className="flex items-center gap-2 shrink-0 no-underline" aria-label="Veronica home">
        <span className="inline-flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground"><Icon name="smart_toy" size={16} filled /></span>
        <span className="font-display text-[1.125rem] font-semibold tracking-tight">Veronica</span>
      </Link>

      <div className="flex-1 max-w-xl mx-auto">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event("veronica:search"))}
          className="flex w-full items-center gap-2 h-9 px-3.5 rounded-full bg-surface-2 text-muted-foreground hover:bg-surface-3 transition cursor-text text-left"
        >
          <Icon name="search" size={16} />
          <span className="flex-1 text-[0.8125rem]">Search jobs, companies, actions…</span>
          <Kbd>⌘K</Kbd>
        </button>
      </div>

      <div className="flex items-center gap-1">
        <span className="relative">
          <IconButton icon="notifications" label="Agent activity" size={36} onClick={() => setAgentOpen(true)} filled={needs.length > 0} />
          {needs.length > 0 && <span className="pointer-events-none absolute -top-0.5 -right-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono text-[0.625rem] font-semibold text-primary-foreground">{needs.length}</span>}
        </span>
        <UserMenu profile={profile} />
      </div>
      <AgentSheet open={agentOpen} onOpenChange={setAgentOpen} agent={agent} needs={needs} />
    </header>
  );
}
