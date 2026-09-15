"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/mt/icon";
import { cn } from "@/lib/utils";
import type { Need, Recent } from "./app-shell";

const NEED_ICON: Record<Need["kind"], string> = { drafts: "rate_review", your_turn: "send", followup: "schedule", apply: "task_alt" };

export function Sidebar({ collapsed, counts, needs, recent }: { collapsed: boolean; counts: { inbox: number; needsYou: number }; needs: Need[]; recent: Recent[] }) {
  const [hovered, setHovered] = useState(false);
  const rail = collapsed && !hovered;
  const floating = collapsed && hovered;

  return (
    <aside
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn("relative shrink-0 h-full bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-[width] duration-250 ease-out", collapsed ? "w-[72px]" : "w-[280px]")}
    >
      <div className={cn("h-full flex flex-col bg-sidebar transition-[width] duration-250 ease-out", rail ? "w-[72px]" : "w-[280px]", floating && "absolute top-0 left-0 z-40 shadow-xl border-r border-sidebar-border")}>
        <nav className="pt-4 px-2 space-y-0.5">
          <RailLink href="/" exact icon="edit_square" label="Ask Veronica" rail={rail} />
          <RailLink href="/inbox" icon="inbox" label="Inbox" rail={rail} count={counts.inbox} />
          <RailLink href="/pipeline" icon="view_kanban" label="Pipeline" rail={rail} count={counts.needsYou} />
        </nav>

        {!rail && (
          <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
            <Section title="Needs you" icon="notifications_active" defaultOpen>
              {needs.length === 0 ? (
                <div className="px-2 text-[0.75rem] text-muted-foreground">Nothing waiting on you.</div>
              ) : (
                needs.map((n, i) => (
                  <Link key={i} href={`/jobs/${n.id}`} className="state-layer flex items-center gap-2 pl-3 pr-2 py-2 rounded-lg text-muted-foreground hover:text-foreground no-underline transition">
                    <Icon name={NEED_ICON[n.kind]} size={15} className="shrink-0" />
                    <span className="flex-1 truncate text-[0.8125rem]">{n.company}</span>
                    <span className="text-[0.625rem] font-mono text-muted-foreground/70 shrink-0">{n.label}</span>
                  </Link>
                ))
              )}
            </Section>
            <Section title="Recent" icon="history" defaultOpen>
              {recent.map((r) => (
                <Link key={r.id} href={`/jobs/${r.id}`} className="state-layer flex items-center gap-2 pl-3 pr-2 py-2 rounded-lg text-muted-foreground hover:text-foreground no-underline transition" title={`${r.title} · ${r.company}`}>
                  <Icon name="work" size={15} className="shrink-0 text-muted-foreground/70" />
                  <span className="flex-1 truncate text-[0.8125rem]">{r.company}</span>
                  <span className="truncate max-w-[110px] text-[0.6875rem] text-muted-foreground/70">{r.title}</span>
                </Link>
              ))}
            </Section>
          </div>
        )}
        {rail && <div className="flex-1" />}

        <nav className="pb-4 px-2">
          <RailLink href="/settings" icon="settings" label="Settings" rail={rail} />
        </nav>
      </div>
    </aside>
  );
}

function RailLink({ href, exact, icon, label, rail, count }: { href: string; exact?: boolean; icon: string; label: string; rail: boolean; count?: number }) {
  const pathname = usePathname();
  const isActive = exact ? pathname === href : pathname.startsWith(href);
  return (
    <Link
      href={href}
      title={rail ? label : undefined}
      className={cn(
        "state-layer flex items-center h-11 rounded-full text-sm font-medium transition no-underline",
        rail ? "justify-center" : "gap-3 px-3",
        isActive ? "bg-secondary-container text-secondary-container-foreground" : "text-foreground/80 hover:text-foreground",
      )}
    >
      <Icon name={icon} size={20} filled={isActive} />
      {!rail && (
        <>
          <span className="flex-1 truncate">{label}</span>
          {count !== undefined && count > 0 && <span className="font-mono text-[0.6875rem] tabular-nums text-muted-foreground">{count}</span>}
        </>
      )}
    </Link>
  );
}

function Section({ title, icon, defaultOpen, children }: { title: string; icon: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div className="mt-5 px-3 flex flex-col">
      <div className="px-2 mb-2 flex items-center justify-between">
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="state-layer flex items-center gap-1 rounded-lg pr-1 text-[0.6875rem] uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground font-medium transition">
          <Icon name="chevron_right" size={13} className={cn("transition-transform", open && "rotate-90")} />
          {title}
        </button>
        <Icon name={icon} size={14} className="text-muted-foreground/70" />
      </div>
      {open && <div className="-mx-1 px-1 pb-1 space-y-0.5">{children}</div>}
    </div>
  );
}
