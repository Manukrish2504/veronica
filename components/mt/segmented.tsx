"use client";

import { cn } from "@/lib/utils";
import { Icon } from "./icon";

/** MT_v2 analytics/Segmented: pill group, active item lifts on a card. */
export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; icon?: string; count?: number }[]; className?: string }) {
  return (
    <div className={cn("inline-flex items-center rounded-full bg-surface-2 p-0.5", className)} role="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn("state-layer inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[0.8125rem] font-medium transition", active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
          >
            {o.icon && <Icon name={o.icon} size={16} filled={active} />}
            {o.label}
            {o.count !== undefined && <span className="font-mono text-[0.6875rem] text-muted-foreground tabular-nums">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
